// eval/swarm/lib.mjs — the ONE harness every swarm agent uses, so 100 site tests are comparable.
//
//   import * as H from "/Users/mlacy/Documents/3.0/the-fold/eval/swarm/lib.mjs";
//   const page = await H.fetchPage(url);     // Chromium (Node's fetch is bot-challenged), cached on disk, >=1.2 s apart per host
//   const out  = await H.snip(page, ask);    // the NO-MODEL ladder; every snip checked verbatim against the page
//   const who  = await H.contact(page);      // how a person could reach the creator: email / form / none (+ where)
//   await H.close();                         // always, at the end
//
// Rules baked in: public pages only, no login, no paywall circumvention, polite pacing, responses cached under cache/,
// contact ADDRESSES are never returned (only kind + where), nothing is ever sent anywhere.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "/private/tmp/fold-e2e/node_modules/playwright/index.mjs";

const SNAP = process.env.FOLD_SNAP || "/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/079c90f2-e828-4baf-8c6c-5d90024766de/scratchpad/swarm-snap";
const CACHE = path.join(path.dirname(new URL(import.meta.url).pathname), "cache");
fs.mkdirSync(CACHE, { recursive: true });
const { recipeDataFromHtml } = await import(SNAP + "/fold-chat-web.js");
const { contactsFromHtml, pickContact } = await import(SNAP + "/fold-chat-contact.js");
const { impressionOf } = await import(SNAP + "/fold-chat-impression.js");

let browser = null, ctx = null; const lastHit = new Map();
export async function close() { try { await browser?.close(); } catch {} browser = null; ctx = null; }
async function context() {
  if (!ctx) { browser = await chromium.launch(); ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", locale: "en-US" }); }
  return ctx;
}

/** Fetch a public page as a browser would. Returns { ok, status, url, finalUrl, html, blocked, why, cached }. */
export async function fetchPage(url, { timeoutMs = 20000, refresh = false } = {}) {
  const key = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
  const f = path.join(CACHE, key + ".json");
  if (!refresh && fs.existsSync(f)) return { ...JSON.parse(fs.readFileSync(f, "utf8")), cached: true };
  const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
  const wait = (lastHit.get(host) || 0) + 1200 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  const c = await context(); const p = await c.newPage(); let out;
  try {
    const r = await p.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }); await p.waitForTimeout(1200);
    const html = await p.content(); const status = r ? r.status() : 0;
    const blocked = status >= 400 || (/access denied|just a moment|captcha|are you a robot|unusual traffic|enable javascript and cookies|request blocked/i.test(html.slice(0, 4000)) && html.length < 20000);
    out = { ok: !blocked && html.length > 500, status, url, finalUrl: p.url(), html: html.slice(0, 1_500_000), blocked, why: blocked ? "HTTP " + status + " or a block page" : "" };
  } catch (e) { out = { ok: false, status: 0, url, finalUrl: url, html: "", blocked: false, why: String(e.message).slice(0, 100) }; }
  finally { await p.close(); }
  try { fs.writeFileSync(f, JSON.stringify(out)); } catch {}
  return out;
}

const dec = (s) => String(s ?? "").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s) => dec(s).replace(/<[^>]+>/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
export function visibleText(html) { return dec(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function jsonLdStrings(html) { const out = []; for (const m of String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === "object") Object.values(n).forEach(walk); else if (typeof n === "string") out.push(n); }; walk(JSON.parse(m[1].trim())); } catch {} } return out; }
function metaStrings(html) { return [...String(html).matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']*)["']/gi)].map((m) => m[1]); }

/** THE verbatim check: is this snip literally in the page (visible text, structured-data strings, or meta description)?
 *  A snip may contain ellipses ('...' / the ellipsis character) between pieces; every piece must be in the page. */
export function isVerbatim(snipText, html) {
  const strip = (x) => x.replace(/^(?:ingredients|steps|instructions|q|a|starts|where|price|phone|hours)\s*:\s*/i, "").replace(/^(?:\d+\.|-|\u2022)\s+/, "").trim();
  const parts = String(snipText ?? "").split(/\n|\u2026|\.\.\./).map((x) => strip(norm(x))).filter((x) => x.length > 3);
  if (!parts.length) return false;
  const hay = norm(visibleText(html)) + " " + jsonLdStrings(html).map(norm).join(" ") + " " + metaStrings(html).map(norm).join(" ");
  return parts.every((part) => hay.includes(part));
}

function ldNodes(html) { const out = []; for (const m of String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === "object") { out.push(n); if (n["@graph"]) walk(n["@graph"]); } }; walk(JSON.parse(m[1].trim())); } catch {} } return out; }
const typesOf = (n) => [].concat(n["@type"] || []).map(String);
const has = (n, re) => typesOf(n).some((t) => re.test(t));
const S = (v) => (typeof v === "string" ? dec(v).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : v && typeof v === "object" && v.name ? S(v.name) : "");

/** Structured blocks a page DECLARES (rung a). Each: { rung:'a', type, label, text } where text is page data, verbatim. */
export function structured(html) {
  const out = [];
  for (const n of ldNodes(html)) {
    if (has(n, /^Recipe$/i)) { const r = recipeDataFromHtml(`<script type="application/ld+json">${JSON.stringify(n)}</script>`); if (r) out.push({ rung: "a", type: "Recipe", label: r.name, text: ["Ingredients:", ...r.ingredients.map((x) => "- " + x), "Steps:", ...r.steps.map((x, i) => i + 1 + ". " + x)].join("\n") }); }
    else if (has(n, /^HowTo$/i)) { const steps = [].concat(n.step || []).flatMap((x) => (x && x.itemListElement ? x.itemListElement : [x])).map((x) => S(x && (x.text || x.name))).filter(Boolean); if (steps.length) out.push({ rung: "a", type: "HowTo", label: S(n.name), text: steps.map((x, i) => i + 1 + ". " + x).join("\n") }); }
    else if (has(n, /^FAQPage$/i)) { const qa = [].concat(n.mainEntity || []).map((q) => [S(q.name), S(q.acceptedAnswer && q.acceptedAnswer.text)]).filter(([a, b]) => a && b); if (qa.length) out.push({ rung: "a", type: "FAQPage", label: S(n.name) || "FAQ", text: qa.slice(0, 6).map(([q, a]) => "Q: " + q + "\nA: " + a).join("\n\n") }); }
    else if (has(n, /^QAPage$/i) || (has(n, /^Question$/i) && (n.acceptedAnswer || n.suggestedAnswer))) { const q = has(n, /^Question$/i) ? n : n.mainEntity; const a = q && (q.acceptedAnswer || [].concat(q.suggestedAnswer || [])[0]); if (q && a) out.push({ rung: "a", type: "QAPage", label: S(q.name), text: "Q: " + S(q.name) + "\nA: " + S(a.text) }); }
    else if (has(n, /Article|BlogPosting|NewsArticle|Report|ScholarlyArticle/i)) { const t = S(n.abstract) || S(n.description) || S(n.articleBody).slice(0, 700); if (t.length > 40) out.push({ rung: "a", type: typesOf(n)[0], label: S(n.headline) || S(n.name), text: t }); }
    else if (has(n, /^Product$/i)) { const o = [].concat(n.offers || [])[0] || {}; const t = [S(n.description), o.price ? "Price: " + o.price + " " + (o.priceCurrency || "") : ""].filter(Boolean).join("\n"); if (t.length > 20) out.push({ rung: "a", type: "Product", label: S(n.name), text: t }); }
    else if (has(n, /Event$/i)) { const t = [S(n.description), n.startDate ? "Starts: " + n.startDate : "", n.location ? "Where: " + (S(n.location) || S(n.location && n.location.address)) : ""].filter(Boolean).join("\n"); if (t.length > 20) out.push({ rung: "a", type: "Event", label: S(n.name), text: t }); }
    else if (has(n, /^JobPosting$/i)) { const t = [S(n.title), S(n.hiringOrganization), S(n.description).slice(0, 500)].filter(Boolean).join("\n"); out.push({ rung: "a", type: "JobPosting", label: S(n.title), text: t }); }
    else if (has(n, /LocalBusiness|Restaurant|Store|Organization/i) && (n.telephone || n.address || n.openingHours)) { const t = [S(n.description), n.telephone ? "Phone: " + n.telephone : "", n.openingHours ? "Hours: " + [].concat(n.openingHours).join(", ") : ""].filter(Boolean).join("\n"); if (t.length > 15) out.push({ rung: "a", type: typesOf(n)[0], label: S(n.name), text: t }); }
    else if (has(n, /VideoObject|PodcastEpisode|Course|Dataset|Book|Movie|MusicRecording|SoftwareApplication/i)) { const t = S(n.description); if (t.length > 40) out.push({ rung: "a", type: typesOf(n)[0], label: S(n.name), text: t }); }
  }
  return out;
}

/** The whole NO-MODEL ladder. Returns { snips:[{rung,type,label,text,chars,verbatim}], firstRung, structuredTypes, blockedLike }.
 *  rungs: a = declared structured block, b = meta description, c = sentences that differ the ask (impressionOf), d = lexical baseline. */
export async function snip(page, ask = "") {
  const html = page.html || ""; const snips = [];
  for (const b of structured(html)) snips.push({ ...b, chars: b.text.length, verbatim: isVerbatim(b.text, html) });
  const meta = metaStrings(html).map(dec).find((x) => x.length > 60);
  if (meta) snips.push({ rung: "b", type: "meta-description", label: "page description", text: meta, chars: meta.length, verbatim: isVerbatim(meta, html) });
  const vis = visibleText(html);
  if (vis.length > 200 && ask) {
    try { const e = impressionOf(vis.slice(0, 40000), ask, { budget: 900 }); if (e && e.text && e.text.length > 60) snips.push({ rung: "c", type: "impression", label: "sentences that differ the ask", text: e.text, chars: e.text.length, verbatim: isVerbatim(e.text, html) }); }
    catch (err) { snips.push({ rung: "c", type: "impression-error", label: String(err.message).slice(0, 60), text: "", chars: 0, verbatim: false }); }
  }
  if (ask) {
    const terms = [...new Set(norm(ask).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 3))];
    const sents = []; { const re = /[^.!?]*[.!?]+(?:\s+|$)|[^.!?]+$/g; let m; while ((m = re.exec(vis)) !== null) { const t = m[0].trim(); if (t.length > 30 && t.length < 400) sents.push({ t, at: m.index, end: m.index + m[0].length }); } }
    let best = null;
    for (let i = 0; i + 2 < sents.length; i++) { const w3 = sents.slice(i, i + 3); const sc = terms.filter((t) => norm(w3.map((x) => x.t).join(" ")).includes(t)).length; if (!best || sc > best.sc) best = { sc, w3 }; }
    if (best && best.sc > 0) { const text = best.w3.map((x, k) => (k && best.w3[k - 1].end < x.at - 1 ? " \u2026 " : k ? " " : "") + x.t).join(""); snips.push({ rung: "d", type: "lexical-baseline", label: "top 3 sentences by overlap", text, chars: text.length, verbatim: isVerbatim(text, html) }); }
  }
  return { snips, firstRung: (snips[0] || {}).rung || null, structuredTypes: snips.filter((s) => s.rung === "a").map((s) => s.type), blockedLike: /cookie|consent|subscribe|sign in|log in/i.test(vis.slice(0, 600)) };
}

/** How could a person reach this page's creator? Follows the site's OWN contact/about pages (<=2, same site). Never returns an address. */
export async function contact(page) {
  const found = contactsFromHtml(page.html || "", page.finalUrl || page.url);
  let pick = pickContact(found); const tried = [];
  if (pick.kind === "none") {
    for (const u of found.pages.slice(0, 2)) {
      const p2 = await fetchPage(u); tried.push({ page: u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60), ok: p2.ok }); if (!p2.ok) continue;
      const f2 = contactsFromHtml(p2.html, p2.finalUrl || u); pick = pickContact(f2);
      if (pick.kind !== "none") { pick.where += " (on their " + (/about/i.test(u) ? "about" : "contact") + " page)"; break; }
    }
  }
  return { kind: pick.kind, where: pick.where || null, triedPages: tried, author: found.author || "", sawContactLinks: found.pages.length };
}
