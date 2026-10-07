// C1 real I/O for the measurement: cached fetch (Wikipedia API answers from A1's cache, else a live GET cached here), the chat's own web search, and a page reader
// (Node fetch, then a real headless Chromium when blocked/empty — the same recipe as A3's primary-eval.mjs). Everything cached in c1/cache.json (seeded from A3's cache), so every arm sees one web snapshot.
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { createHash } from "node:crypto"; import { execFileSync } from "node:child_process"; import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const CACHE = path.join(HERE, "cache.json"), SEED = path.join(HERE, "../.primary-cache.json"), A1CACHE = path.join(HERE, "../a1/cache");
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { try { cache = JSON.parse(fs.readFileSync(SEED, "utf8")); } catch {} }
const save = () => { try { fs.writeFileSync(CACHE, JSON.stringify(cache)); } catch {} };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const stats = { search: 0, searchCached: 0, read: 0, readCached: 0, readNode: 0, readBrowser: 0, readFail: 0, readMs: [] };
const webMod = await import(pathToFileURL(path.join(ROOT, "fold-chat-web.js")).href);
export const web = webMod;

/** GET fetch with a disk cache (Wikipedia parse API: A1's cache by sha1 of the URL first). */
export async function cachedFetch(u, o = {}) {
  const s = String(u);
  const k1 = path.join(A1CACHE, createHash("sha1").update(s).digest("hex") + ".json");
  if (fs.existsSync(k1)) return new Response(fs.readFileSync(k1, "utf8"), { status: 200 });
  const key = "f:" + s; if (cache[key]) return new Response(cache[key].body, { status: cache[key].status });
  for (let i = 0; i < 6; i++) {
    const r = await fetch(u, { ...o, headers: { "user-agent": "fold-eval/1.0 (research)", ...(o.headers || {}) } });
    if (r.status === 429) { await sleep((Number(r.headers.get("retry-after")) || 10) * 1000 + 500); continue; }
    const body = await r.text(); if (r.ok) { cache[key] = { status: r.status, body }; save(); } return new Response(body, { status: r.status });
  }
  return new Response("", { status: 429 });
}
export async function search(query) {
  stats.search++; const key = "d:" + query;
  if (cache[key]) { stats.searchCached++; return cache[key]; }
  for (let a = 0; a < 3; a++) {
    try { const r = await webMod.search("web", query); const out = (r.results || []).filter((x) => /^https?:/.test(x.url || "")).map((x) => ({ url: x.url, title: x.title || "", snippet: x.snippet || "" })); if (out.length) { cache[key] = out; save(); return out; } } catch {}
    await sleep(1200 * (a + 1));
  }
  return [];
}
const strip = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function htmlToText(html) {
  let h = String(html); const title = strip((/<title[^>]*>([^]*?)<\/title>/i.exec(h) || [, ""])[1]);
  h = h.replace(/<!--[^]*?-->/g, " ").replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[^]*?<\/\1>/gi, " ").replace(/<(nav|footer|header|aside|form)\b[^>]*>[^]*?<\/\1>/gi, " ").replace(/<\/(p|div|li|h[1-6]|tr|section|article|br|ul|ol|table|blockquote)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  h = h.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return " "; } }).replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return " "; } });
  return { title, text: h.split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()).filter(Boolean).join("\n") };
}
const SHELL = /(enable javascript|javascript is (required|disabled)|access denied|are you a robot|verify you are (a )?human|captcha|attention required|just a moment|request blocked|403 forbidden|pardon our interruption)/i;
let browser = null, ctx = null;
async function chromium() { if (ctx) return ctx; const { chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs"); browser = await chromium.launch({ headless: true }); ctx = await browser.newContext({ userAgent: UA, locale: "en-US" }); return ctx; }
export const closeBrowser = async () => { if (browser) await browser.close(); };
async function readNode(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(14000) });
  const ct = r.headers.get("content-type") || "";
  if (/pdf/i.test(ct) || /\.pdf($|\?)/i.test(url)) { const buf = Buffer.from(await r.arrayBuffer()); const f = path.join(os.tmpdir(), "c1-" + process.pid + ".pdf"); fs.writeFileSync(f, buf); try { return { status: r.status, title: url, text: execFileSync("pdftotext", ["-l", "8", f, "-"], { maxBuffer: 20e6, timeout: 15000 }).toString(), url: r.url }; } finally { try { fs.unlinkSync(f); } catch {} } }
  if (!/html|xml|text/i.test(ct)) return { status: r.status, title: "", text: "", url: r.url, nonText: ct };
  const { title, text } = htmlToText(await r.text()); return { status: r.status, title, text, url: r.url };
}
async function readBrowser(url) { const c = await chromium(); const p = await c.newPage(); try { await p.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 }); await p.waitForTimeout(1500); const { text } = htmlToText(await p.content()); return { status: 200, title: await p.title(), text, url: p.url() }; } finally { await p.close().catch(() => {}); } }
/** the origin.js `read` contract: (url) → { ok, text, title, url, via } */
export async function readPage(url) {
  stats.read++; const key = "r:" + url;
  if (cache[key]) { stats.readCached++; return cache[key]; }
  const t0 = Date.now(); let res = null, via = "node";
  try { res = await readNode(url); } catch { res = null; }
  const weak = !res || res.status >= 400 || res.text.length < 400 || (res.text.length < 2500 && SHELL.test(res.text));
  if (weak && !(res && res.nonText)) { try { const b = await readBrowser(url); if (b.text.length > (res?.text.length || 0)) { res = b; via = "playwright"; } } catch {} }
  const out = res && res.text.length >= 80 && !(res.status >= 400) ? { ok: true, text: res.text.slice(0, 80000), title: res.title || "", url: res.url || url, via, ms: Date.now() - t0 } : { ok: false, text: "", title: "", url, via, ms: Date.now() - t0, why: res ? "status:" + res.status + " len:" + res.text.length : "fetch_failed" };
  stats[out.ok ? (via === "node" ? "readNode" : "readBrowser") : "readFail"]++; stats.readMs.push(out.ms);
  cache[key] = out; save(); return out;
}
