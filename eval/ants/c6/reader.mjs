// reader.mjs — the page reader C6 injects into fetchVoice: Node fetch first; a real Chromium (Playwright, as A3 did) when Node's read is weak. Keeps the HTML (authorship markup) as well as the text.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(HERE, "cache");
fs.mkdirSync(CACHE_DIR, { recursive: true });
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SHELL = /(enable javascript|javascript is (required|disabled)|access denied|are you a robot|verify you are (a )?human|captcha|attention required|just a moment|request blocked|403 forbidden|pardon our interruption)/i;
const key = (u) => path.join(CACHE_DIR, crypto.createHash("sha1").update(u).digest("hex").slice(0, 16) + ".json");
let browser = null, ctx = null;
async function chromium() {
  if (ctx) return ctx;
  const { chromium } = await import(pathToFileURL("/private/tmp/fold-e2e/node_modules/playwright/index.mjs").href).catch(() => import("/private/tmp/fold-e2e/node_modules/playwright/index.js"));
  browser = await chromium.launch({ headless: true }); ctx = await browser.newContext({ userAgent: UA, locale: "en-US" }); return ctx;
}
export async function closeReader() { try { await browser?.close(); } catch {} browser = ctx = null; }
const plainish = (t) => String(t).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
async function viaNode(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,text/plain;q=0.9,*/*;q=0.5", "accept-language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  const ct = r.headers.get("content-type") || "";
  if (!/html|xml|text/i.test(ct)) return { status: r.status, url: r.url, nonText: ct };
  const body = await r.text();
  return /html/i.test(ct) ? { status: r.status, url: r.url, html: body, ct } : { status: r.status, url: r.url, text: body, ct };
}
async function viaBrowser(url) {
  const c = await chromium(); const p = await c.newPage();
  try { await p.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 }); await p.waitForTimeout(1500); return { status: 200, url: p.url(), html: await p.content() }; } finally { await p.close().catch(() => {}); }
}
/** read(url) → { ok, html?, text?, title?, url, via, status, why? } ; cached on disk so a re-run classifies the same bytes. */
export async function read(url) {
  const f = key(url);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  let res = null, via = "node";
  try { res = await viaNode(url); } catch (e) { res = { error: String(e.message || e) }; }
  const len = res ? plainish(res.html || res.text || "").length : 0;
  const weak = !res || res.error || res.status >= 400 || len < 500 || (len < 3000 && SHELL.test(res.html || res.text || ""));
  if (weak && !(res && res.nonText)) { try { const b = await viaBrowser(url); if (plainish(b.html).length > len) { res = b; via = "playwright"; } } catch (e) { res = res || { error: String(e.message || e) }; } }
  const text = res?.html || res?.text || "";
  const out = text && plainish(text).length >= 80 && !(res.status >= 400) ? { ok: true, html: res.html || null, text: res.html ? null : res.text, url: res.url || url, via, status: res.status } : { ok: false, url, via, status: res?.status ?? null, why: res?.error || (res?.nonText ? "non_text:" + res.nonText : "status_" + res?.status + "_or_empty") };
  fs.writeFileSync(f, JSON.stringify(out));
  return out;
}
