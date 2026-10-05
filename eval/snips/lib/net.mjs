// net.mjs — the study's only door to the network: disk-cached, serialised (>= 1.1 s between real calls), transport-labelled.
// A cached response is replayed byte for byte, so every later stage (pipeline, judge, analysis) is offline and deterministic.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(here, "..", "cache");
fs.mkdirSync(CACHE, { recursive: true });
export const FOLD_RELAY = "https://holodeck-proxy.prometheoid.workers.dev";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex");

export const STATS = { network: 0, cacheHits: 0, byTransport: {}, failures: [] };
const MIN_GAP_MS = 1100;
let last = 0, chain = Promise.resolve();
const gate = () => { const p = chain.then(async () => { const w = last + MIN_GAP_MS - Date.now(); if (w > 0) await sleep(w); last = Date.now(); }); chain = p.catch(() => {}); return p; };

let browser = null, ctx = null, page = null;
async function chromiumPage() {
  if (page) return page;
  const { chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs");
  browser = await chromium.launch({ headless: true });
  ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  page = await ctx.newPage();
  return page;
}
export async function closeNet() { try { if (browser) await browser.close(); } catch {} browser = ctx = page = null; }

const cooldown = new Map();
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
const lastByHost = new Map();
const entryPath = (key) => path.join(CACHE, sha(key));
function readCache(key) {
  const p = entryPath(key);
  if (!fs.existsSync(p + ".json")) return null;
  const meta = JSON.parse(fs.readFileSync(p + ".json", "utf8"));
  const body = fs.existsSync(p + ".body") ? fs.readFileSync(p + ".body") : Buffer.alloc(0);
  return { ...meta, body };
}
function writeCache(key, meta, body) {
  const p = entryPath(key);
  fs.writeFileSync(p + ".body", body);
  fs.writeFileSync(p + ".json", JSON.stringify({ key, ...meta, bytes: body.length }));
}

/** One GET through a named transport. transport: "node" | "chromium". Returns {status, body(Buffer), ctype, ms, transport, cached}. */
export async function get(url, opts = {}) {
  // a 429 is the host asking us to slow down: wait (Retry-After if given, else 15 s) and ask again, twice at most; it is never cached
  let r;
  for (let k = 0; k < 3; k++) {
    r = await get1(url, opts);
    if (r.status !== 429 || /search\.brave\.com|duckduckgo/.test(url)) return r;
    STATS.retries429 = (STATS.retries429 || 0) + 1;
    const wait = Math.min(90000, ((+r.retryAfter || 15) + 4) * 1000);
    const h = hostOf(url); cooldown.set(h, Date.now() + wait);
    await sleep(wait);
  }
  return r;
}
async function get1(url, { transport = "node", cacheFailures = true, timeoutMs = 20000, headers = {} } = {}) {
  const key = transport + " GET " + url;
  const hit = readCache(key);
  if (hit && (hit.status >= 200 && hit.status < 300 || cacheFailures && hit.cacheable !== false && hit.status !== 429 && hit.status < 500 && hit.status !== 0)) { STATS.cacheHits++; return { ...hit, cached: true }; }
  { const h = hostOf(url); const w = (cooldown.get(h) || 0) - Date.now(); if (w > 0) await sleep(w);
    // Wikimedia is the shared, rate-limited host everyone leans on: 2.5 s between calls to it
    if (/wikipedia\.org$/.test(h)) { const w2 = (lastByHost.get("wp") || 0) + 2500 - Date.now(); if (w2 > 0) await sleep(w2); lastByHost.set("wp", Date.now()); } }
  await gate();
  const t0 = Date.now();
  let out;
  try {
    if (transport === "chromium") {
      const pg = await chromiumPage();
      const r = await pg.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      const body = r ? await r.body() : Buffer.alloc(0);
      out = { status: r ? r.status() : 0, body, ctype: r ? (r.headers()["content-type"] || "") : "", retryAfter: r ? r.headers()["retry-after"] : null };
    } else {
      const c = new AbortController(); const id = setTimeout(() => c.abort(), timeoutMs);
      try {
        const r = await fetch(url, { signal: c.signal, headers: { "user-agent": url.includes("wikipedia.org") ? "snipstudy/1.0 (research; read-only)" : UA, ...headers } });
        const buf = Buffer.from(await r.arrayBuffer());
        out = { status: r.status, body: buf, ctype: r.headers.get("content-type") || "", retryAfter: r.headers.get("retry-after") };
      } finally { clearTimeout(id); }
    }
  } catch (e) {
    const why = String((e && e.message) || e).split("\n")[0].slice(0, 120);
    const res = { status: 0, body: Buffer.alloc(0), ctype: "", ms: Date.now() - t0, transport, error: why, cached: false };
    STATS.network++; STATS.byTransport[transport] = (STATS.byTransport[transport] || 0) + 1; STATS.failures.push({ url, transport, why });
    return res;
  }
  const res = { ...out, ms: Date.now() - t0, transport, cached: false, at: new Date().toISOString() };
  STATS.network++; STATS.byTransport[transport] = (STATS.byTransport[transport] || 0) + 1;
  const ok = res.status >= 200 && res.status < 300;
  // relay search answers are only cached when they carry results: a failure is re-asked, never replayed
  const isRelaySearch = url.startsWith(FOLD_RELAY + "/search");
  if (ok || (cacheFailures && !isRelaySearch && res.status !== 429 && res.status < 500)) writeCache(key, { url, transport, status: res.status, ctype: res.ctype, ms: res.ms, at: res.at, cacheable: !isRelaySearch }, res.body);
  if (!ok) STATS.failures.push({ url, transport, why: "HTTP " + res.status });
  return res;
}

const BLOCKED = /api\.allorigins\.win|api\.codetabs\.com|corsproxy\.io|cors\.eu\.org|thingproxy\.freeboard\.io|r\.jina\.ai|api\.microlink\.io/;
/** A fetch() with the app's signature, routed by destination, that the app's own readText/search can run on. */
export function makeFetch(tape = null) {
  return async function fetchImpl(url, opts = {}) {
    const u = String(url);
    if (BLOCKED.test(u)) throw new Error("harness: third-party proxy not used");
    const viaRelay = u.startsWith(FOLD_RELAY);
    const isApi = /\/w\/api\.php|api\.github\.com|archive\.org\/advancedsearch|api\.openalex\.org|api\.crossref\.org/.test(u);
    const transport = viaRelay || isApi ? "node" : "chromium";
    // the app aborts a gateway after its own budget; honour it where the transport allows
    const r = await get(u, { transport, timeoutMs: viaRelay ? 25000 : 10000 });
    if (tape) tape.push({ target: u, transport, status: r.status, ms: r.ms, cached: !!r.cached, bytes: r.body.length, body: r.body, error: r.error });
    if (r.status === 0) throw new Error(r.error || "no answer");
    const st = r.status < 200 || r.status > 599 ? 502 : r.status;
    return new Response(st === 204 || st === 304 ? null : r.body, { status: st, headers: { "content-type": r.ctype || "text/html" } });
  };
}
