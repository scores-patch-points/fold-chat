#!/usr/bin/env node
// eval/ants/primary-eval.mjs — runs a primary-page finder over eval/ants/primary-corpus.json with REAL injected I/O and scores it with primary-oracle.mjs.
//   node eval/ants/primary-eval.mjs --arm baseline|a2|both [--fresh] [--only id,id] [--timeout 150000] [--tag name]
//
// REAL I/O, and why (measured from this Mac, 2026-10-06, see A3-PREREG.md):
//   search   = the chat's OWN search("web") from fold-chat-web.js (DuckDuckGo via the Fold relay worker) called from Node. Measured 2026-10-06: direct DuckDuckGo = 202/blocked from Node AND from headless Chromium today; Brave 429; Mojeek captcha;
//              Bing HTML works but ranks off-topic pages for sentence queries (--bing keeps it as a flagged alternative).
//   readPage = Node fetch (+ HTML→text, PDF via pdftotext); when Node is blocked or gets an empty/JS shell, a REAL headless Chromium (Playwright) loads the page. `via` records which.
//   point    = local Ollama gemma2:2b, temperature 0.
// Web responses are cached in eval/ants/.primary-cache.json (key = query / url) so two arms see the same web snapshot; --fresh bypasses the cache.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyPage, scoreClaim, scoreAll } from "./primary-oracle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, "primary-corpus.json"), "utf8"));
const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf("--" + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const LEAN = !!flag("lean");
const ARM = flag("arm", "baseline"), FRESH = !!flag("fresh"), ONLY = flag("only") ? String(flag("only")).split(",") : null, CLAIM_TIMEOUT = Number(flag("timeout", 150000)), TAG = flag("tag", "");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────── cache + counters ─────────
const CACHE_FILE = path.join(HERE, ".primary-cache.json");
let cache = {}; try { if (!FRESH) cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch {}
const saveCache = () => { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch {} };
const stats = () => ({ search: 0, searchCached: 0, read: 0, readCached: 0, readNode: 0, readBrowser: 0, readFail: 0, point: 0 });
let S = stats();

// ───────── search: Bing from Node ─────────
let lastBing = 0;
const unBing = (h) => { const m = /[?&;]u=a1([A-Za-z0-9_-]+)/.exec(String(h).replace(/&amp;/g, "&")); if (!m) return /^https?:/.test(h) ? h : null; try { return Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch { return null; } };
const strip = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const webMod = await import(pathToFileURL(path.join(ROOT, "fold-chat-web.js")).href);
/** DEFAULT: the chat's OWN web search (fold-chat-web.js search("web") = DuckDuckGo through the Fold relay), the one the product runs. --bing: Bing HTML from Node (measured today to return off-topic pages for sentence queries; kept only as a flagged alternative). */
export async function search(query) {
  if (!flag("bing")) {
    S.search++;
    const key = "d:" + query;
    if (cache[key]) { S.searchCached++; return cache[key]; }
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const r = await webMod.search("web", query); const out = (r.results || []).filter((x) => /^https?:/.test(x.url || "")).map((x) => ({ url: x.url, title: x.title || "", snippet: x.snippet || "" })); if (out.length) { cache[key] = out; saveCache(); return out; } } catch {}
      await sleep(1200 * (attempt + 1));
    }
    return [];
  }
  S.search++;
  const key = "s:" + query;
  if (cache[key]) { S.searchCached++; return cache[key]; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = 900 - (Date.now() - lastBing); if (wait > 0) await sleep(wait); lastBing = Date.now();
    try {
      const r = await fetch("https://www.bing.com/search?q=" + encodeURIComponent(query) + "&setlang=en&cc=us", { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(15000) });
      const t = await r.text(); const out = [];
      for (const b of t.split('<li class="b_algo"').slice(1)) {
        const m = /<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/s.exec(b); if (!m) continue;
        const url = unBing(m[1]); if (!url) continue;
        const sn = /<p[^>]*>(.*?)<\/p>/s.exec(b);
        out.push({ url, title: strip(m[2]), snippet: sn ? strip(sn[1]).slice(0, 300) : "" });
      }
      if (out.length) { cache[key] = out; saveCache(); return out; }
    } catch {}
    await sleep(1500 * (attempt + 1));
  }
  return [];
}

// ───────── readPage: Node fetch, then a real Chromium ─────────
function htmlToText(html) {
  let h = String(html);
  const title = strip((/<title[^>]*>([^]*?)<\/title>/i.exec(h) || [, ""])[1]);
  h = h.replace(/<!--[^]*?-->/g, " ").replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[^]*?<\/\1>/gi, " ").replace(/<(nav|footer|header|aside|form)\b[^>]*>[^]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br|ul|ol|table|blockquote)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  h = h.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return " "; } }).replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return " "; } });
  const text = h.split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()).filter(Boolean).join("\n");
  return { title, text };
}
const SHELL = /(enable javascript|javascript is (required|disabled)|access denied|are you a robot|verify you are (a )?human|captcha|attention required|just a moment|request blocked|403 forbidden|pardon our interruption)/i;
let browser = null, ctx = null;
async function chromium() {
  if (browser) return ctx;
  const { chromium } = await import(pathToFileURL("/private/tmp/fold-e2e/node_modules/playwright/index.mjs").href).catch(() => import("/private/tmp/fold-e2e/node_modules/playwright/index.js"));
  browser = await chromium.launch({ headless: true });
  ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  return ctx;
}
async function readNode(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept": "text/html,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(14000) });
  const ct = r.headers.get("content-type") || "";
  if (/pdf/i.test(ct) || /\.pdf($|\?)/i.test(url)) {
    const buf = Buffer.from(await r.arrayBuffer()); const f = path.join(os.tmpdir(), "primary-eval-" + process.pid + ".pdf"); fs.writeFileSync(f, buf);
    try { const text = execFileSync("pdftotext", ["-l", "8", f, "-"], { maxBuffer: 20e6, timeout: 15000 }).toString(); return { status: r.status, title: url, text, url: r.url }; } finally { try { fs.unlinkSync(f); } catch {} }
  }
  if (!/html|xml|text/i.test(ct)) return { status: r.status, title: "", text: "", url: r.url, nonText: ct };
  const { title, text } = htmlToText(await r.text());
  return { status: r.status, title, text, url: r.url };
}
async function readBrowser(url) {
  const c = await chromium(); const p = await c.newPage();
  try { await p.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 }); await p.waitForTimeout(1500);
    const title = await p.title(); const html = await p.content(); const { text } = htmlToText(html); return { status: 200, title, text, url: p.url() };
  } finally { await p.close().catch(() => {}); }
}
export async function readPage(url) {
  S.read++;
  const key = "r:" + url;
  if (cache[key]) { S.readCached++; return cache[key]; }
  let res = null, via = "node";
  try { res = await readNode(url); } catch { res = null; }
  const weak = !res || res.status >= 400 || res.text.length < 400 || (res.text.length < 2500 && SHELL.test(res.text));
  if (weak && !(res && res.nonText)) {
    try { const b = await readBrowser(url); if (b.text.length > (res?.text.length || 0)) { res = b; via = "playwright"; } } catch {}
  }
  const out = res && res.text.length >= 80 && !(res.status >= 400) ? { ok: true, text: res.text.slice(0, 80000), title: res.title || "", url: res.url || url, via } : { ok: false, text: "", title: "", url, via, why: res ? "status:" + res.status + (res.nonText ? " " + res.nonText : "") + " len:" + res.text.length : "fetch_failed" };
  S[out.ok ? (via === "node" ? "readNode" : "readBrowser") : "readFail"]++;
  cache[key] = out; saveCache(); return out;
}

// ───────── point: local Ollama gemma2:2b, temperature 0 ─────────
export async function point(messages) {
  S.point++;
  const r = await fetch("http://127.0.0.1:11434/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "gemma2:2b", messages, stream: false, options: { temperature: 0, num_ctx: 4096 } }), signal: AbortSignal.timeout(90000) });
  const j = await r.json(); return String(j?.message?.content ?? "");
}

// ───────── arms ─────────
/** BASELINE: search the claim, keep the first non-Wikipedia page that reads, no verification. */
async function baseline({ claim }) {
  const trail = [];
  const hits = await search(claim);
  for (const h of hits) {
    const host = hostOf(h.url);
    if (/(^|\.)wikipedia\.org$/i.test(host)) { trail.push({ query: claim, url: h.url, host, verdict: "skipped", why: "wikipedia" }); continue; }
    const pg = await readPage(h.url);
    if (!pg.ok) { trail.push({ query: claim, url: h.url, host, verdict: "unreadable", why: pg.why }); continue; }
    trail.push({ query: claim, url: h.url, host, verdict: "kept" });
    return { passages: [{ ref: "[B1]", title: pg.title || h.title, url: pg.url || h.url, text: pg.text, origin: true, foundVia: { host: "en.wikipedia.org" } }], trail };
  }
  return { passages: [], trail };
}
/** The encyclopedia page's text for a claim (what the chat has in hand when it asks for a primary page): Wikipedia's own search on the question, top hit's plain-text extract. Real data; cached. */
async function indexTextFor(question) {
  const key = "w:" + question; if (cache[key] !== undefined) return cache[key];
  let out = null;
  try {
    const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&gsrsearch=" + encodeURIComponent(question) + "&prop=extracts&explaintext=1&format=json&origin=*", { headers: { "user-agent": "fold-eval/1.0 (research)" }, signal: AbortSignal.timeout(15000) });
    const j = await r.json(); const pg = Object.values(j?.query?.pages || {})[0]; if (pg?.extract) out = { title: pg.title, text: pg.extract };
  } catch {}
  cache[key] = out; saveCache(); return out;
}
async function a2Module() {
  const f = path.join(ROOT, "fold-chat-primary.js");
  if (!fs.existsSync(f)) throw new Error("fold-chat-primary.js not present yet");
  const m = await import(pathToFileURL(f).href + "?t=" + Date.now());
  if (typeof m.findPrimary !== "function") throw new Error("fold-chat-primary.js has no findPrimary export");
  return m.findPrimary;
}
async function fwEn() { const m = await import(pathToFileURL(path.join(ROOT, "fold-chat-function-words.js")).href); return new Set(m.FUNCTION_WORDS.en); }

const withTimeout = (p, ms) => new Promise((resolve) => { const t = setTimeout(() => resolve({ timedOut: true }), ms); p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); resolve({ error: String(e?.stack || e).slice(0, 400) }); }); });

async function runArm(arm) {
  const fw = await fwEn();
  const useIndex = arm === "a2idx";
  const fn = arm === "a2" || arm === "a2idx" ? await a2Module() : baseline;
  const rows = [];
  for (const c of corpus.claims) {
    if (ONLY && !ONLY.includes(c.id)) continue;
    S = stats(); const t0 = Date.now();
    const idx = useIndex ? await indexTextFor(c.question) : null;
    const out = await withTimeout(Promise.resolve(fn({ claim: LEAN ? c.claimLean : c.claim, sentence: LEAN ? c.claimLean : c.claim, indexHost: "en.wikipedia.org", search, readPage, point, fw, limits: {}, ...(idx ? { indexText: idx.text, indexUrl: null } : {}) })), CLAIM_TIMEOUT);
    const res = out && !out.timedOut && !out.error ? out : { passages: [], trail: [] };
    const sc = scoreClaim(res, c, corpus);
    const row = { ...sc, shape: c.shape, claim: LEAN ? c.claimLean : c.claim, ms: Date.now() - t0, io: { ...S }, timedOut: !!out?.timedOut, error: out?.error || null, trail: (res.trail || []).slice(0, 40), passages: (res.passages || []).map((p) => ({ ref: p.ref, title: p.title, url: p.url, foundVia: p.foundVia || null, textHead: String(p.text || "").slice(0, 400), textLen: String(p.text || "").length })) };
    rows.push(row);
    console.log(`${arm.padEnd(8)} ${c.id.padEnd(20)} ${row.reach ? "REACH" : row.abstained ? "none " : row.mirrorFA ? "MIRROR" : "miss "} pages=${row.pages.length} mirrorFA=${row.mirrorFA} wrongFA=${row.wrongFA} ${row.pages.map((p) => p.cls + ":" + p.host).join(" | ")} (${(row.ms / 1000).toFixed(0)}s, search ${row.io.search} read ${row.io.read} point ${row.io.point}${out?.timedOut ? " TIMEOUT" : ""}${out?.error ? " ERROR " + out.error.slice(0, 80) : ""})`);
  }
  return rows;
}

function listing(arm, rows, totals) {
  const L = [`# primary-eval listing — arm ${arm} — ${new Date().toISOString()}`, "", "Every page the arm returned, for a person to judge (the oracle's class is a host+text check, not a judgement). `reach` = expected host AND page text carries the claim's say-regexes; `unlisted_passes_text` is NOT counted as reach.", "", "Totals: `" + JSON.stringify(totals) + "`", ""];
  for (const r of rows) {
    L.push(`## ${r.id} (${r.shape}) — ${r.reach ? "REACH" : r.abstained ? "no page returned" : r.mirrorFA ? "MIRROR FALSE ACCEPT" : "returned pages, none reach"}`, `claim: ${r.claim}`, "");
    if (!r.pages.length) L.push("(no pages)", "");
    r.pages.forEach((p, i) => { const pp = r.passages[i]; L.push(`- **${p.cls}** (${p.why}) ${p.url}`, `  title: ${p.title || pp?.title || ""}${pp?.foundVia ? "  foundVia: " + JSON.stringify(pp.foundVia) : ""}`, `  text head: ${String(pp?.textHead || "").replace(/\s+/g, " ").slice(0, 260)}`); });
    if (r.trail.length) { L.push("", "  trail:"); for (const t of r.trail.slice(0, 12)) L.push(`  - ${t.verdict}${t.why ? " (" + t.why + ")" : ""} ${t.host || ""} ${t.url || ""}${t.query ? "  q=" + String(t.query).slice(0, 70) : ""}`); }
    L.push("");
  }
  return L.join("\n");
}

const arms = ARM === "both" ? ["baseline", "a2"] : [ARM];
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
for (const arm of arms) {
  let rows;
  try { rows = await runArm(arm); } catch (e) { console.error("arm", arm, "could not run:", e.message); continue; }
  const totals = scoreAll(rows);
  console.log(`\n== ${arm}: reach ${totals.reach}/${totals.claims} (${(100 * totals.reachRate).toFixed(0)}%)  mirrorFA ${totals.mirrorFA_pages} pages/${totals.mirrorFA_claims} claims  wrongFA ${totals.wrongFA_pages} pages/${totals.wrongFA_claims} claims  unlistedPass ${totals.unlistedPass_pages}  abstained ${totals.abstained}\n`);
  const base = `primary-eval-${arm}${LEAN ? "-lean" : ""}${TAG ? "-" + TAG : ""}-${stamp}`;
  fs.writeFileSync(path.join(HERE, base + ".json"), JSON.stringify({ arm, at: new Date().toISOString(), fresh: FRESH, totals, rows }, null, 1));
  fs.writeFileSync(path.join(HERE, base + "-listing.md"), listing(arm, rows, totals));
  console.log("wrote", base + ".json", "and", base + "-listing.md");
}
if (browser) await browser.close();
