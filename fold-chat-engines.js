// fold-chat-engines.js — searching the web DIRECTLY, for the Fold as a browser extension.
//
// In an extension the background worker holds host permissions: it fetches any origin with no CORS
// wall, from the user's own address — so the Cloudflare relay (a shared datacenter IP that DuckDuckGo
// and Brave throttle: 408/429 → 502 on ~2 of 3 calls, 15–18 s to fail) is not on the path at all.
// What an engine returns here is an HTML page; this module is the PURE half — page in, results out,
// the way the khora's organs/web.js::parseSearchResults is for DuckDuckGo — plus the one policy that
// matters for speed: ask the engines at once, take the first that gives results, and let a refusal
// (a bot challenge answers in ~200 ms) cost nothing.
//
// SCRAPING IS FRAGILE BY NATURE: a page that is large but parses to nothing means the markup changed,
// and that is said as such (`shape`), never reported as "the web had nothing" (the khora's rule: a
// gap is a result).

import { parseSearchResults } from "./vendor/khora/native/organs/web.js";

const decode = (s) => String(s ?? "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&#x27;/g, "'");
const text = (h) => decode(String(h ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Brave Search's server-rendered results. Class names are build-hashed, so this keys only on the
 *  stable markers: `data-type="web"` blocks, the first absolute link, `class="title …"`, and the
 *  first content paragraph. */
export function parseBrave(html) {
  const h = String(html ?? "");
  const blocks = h.split(/(?=<div class="snippet[^"]*" data-pos="\d+" data-type="web")/).slice(1);
  const seen = new Set(), results = [];
  for (const b of blocks) {
    const url = (/<a[^>]*href="(https?:\/\/[^"]+)"/i.exec(b) || [])[1];
    if (!url) continue;
    const u = decode(url);
    if (seen.has(u)) continue;
    const title = text((/class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(b) || [])[1]);
    const after = b.slice(b.search(/class="[^"]*\btitle\b/i));
    const sn = /<(?:div|p)[^>]*class="[^"]*(?:snippet-description|content)\b[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p)>/i.exec(after) || /<p[^>]*>([\s\S]*?)<\/p>/i.exec(after);
    if (!title) continue;
    seen.add(u);
    results.push({ title, url: u, snippet: text(sn && sn[1]).slice(0, 300) });
  }
  // A big page with nothing parsed is a change of markup, said so.
  if (!results.length) return { results: [], blocked: false, shape: h.length > 20000 ? "the page is large but nothing parsed — the engine's markup may have changed" : "no results page" };
  return { results, blocked: false };
}

/** DuckDuckGo's html face, through the khora's own parser (a challenge page is `blocked`). */
export const parseDdg = (html) => parseSearchResults(html);

export const ENGINES = Object.freeze([
  { id: "brave", label: "Brave Search", url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web`, parse: parseBrave },
  { id: "ddg", label: "DuckDuckGo", url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, parse: parseDdg },
]);

/**
 * Ask the engines AT ONCE; the first to return `min` results wins. A refusal costs only its own
 * (short) answer. Returns { results, engine, blocked:[ids], tried:[{id,ms,n,why}] }.
 */
export async function searchDirect(q, { fetchImpl = fetch, engines = ENGINES, min = 5, timeoutMs = 8000, now = Date.now } = {}) {
  const tried = [];
  const ctl = new AbortController();
  const run = async (e) => {
    const t0 = now();
    try {
      const c = new AbortController(); const id = setTimeout(() => c.abort(), timeoutMs);
      const onAbort = () => c.abort(); ctl.signal.addEventListener("abort", onAbort, { once: true });
      let r; try { r = await fetchImpl(e.url(q), { signal: c.signal }); } finally { clearTimeout(id); ctl.signal.removeEventListener("abort", onAbort); }
      const html = await r.text();
      const p = e.parse(html);
      const n = (p.results || []).length;
      tried.push({ id: e.id, ms: now() - t0, n, why: p.blocked ? "challenge" : n ? null : (p.shape || (r.ok ? "no results" : "HTTP " + r.status)) });
      return n >= min ? { engine: e.id, results: p.results } : null;
    } catch (err) {
      tried.push({ id: e.id, ms: now() - t0, n: 0, why: (err && err.name === "AbortError") ? "no answer in time" : String((err && err.message) || err).slice(0, 60) });
      return null;
    }
  };
  const win = await new Promise((resolve) => {
    let pending = engines.length;
    for (const e of engines) run(e).then((v) => { if (v) { ctl.abort(); resolve(v); } else if (--pending === 0) resolve(null); });
  });
  return { results: win ? win.results : [], engine: win ? win.engine : null, blocked: tried.filter((t) => t.why === "challenge").map((t) => t.id), tried };
}
