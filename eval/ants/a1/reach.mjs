// A1: for every footnote URL the lane met (ceiling.json reads + node-chain reads + live trails), compare (a) Node plain fetch status, (b) Node readText, (c) the real BROWSER page's readText (direct → CORS fail → relay chain), same timeout (6 s) as the lane.
import fs from "node:fs";
import { openChat } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
import * as web from "../../../fold-chat-web.js";
const here = (f) => new URL(f, import.meta.url);
const urls = new Set();
for (const e of JSON.parse(fs.readFileSync(here("./ceiling.json"))).flatMap((r) => r.reads || [])) urls.add(e.url);
for (const s of JSON.parse(fs.readFileSync(here("./node-chain.json")))) for (const c of s.perClaim) for (const r of c.reads || []) { if (r.url) urls.add(r.url); if (r.archived) urls.add(r.archived); }
for (const r of JSON.parse(fs.readFileSync(here("./browser2-run.json")))) for (const t of r.a1.calls[0].trails) for (const x of t.trail.tried || []) if (x.url && /^http/.test(x.url)) urls.add(x.url);
const list = [...urls].filter((u) => !/wikipedia\.org/.test(u));
console.log("urls", list.length);
const nodeStatus = async (u) => { const t = Date.now(); try { const c = new AbortController(); const id = setTimeout(() => c.abort(), 8000); const r = await fetch(u, { signal: c.signal, redirect: "follow" }); clearTimeout(id); return { status: r.status, ms: Date.now() - t }; } catch (e) { return { err: String(e.cause?.code || e.name), ms: Date.now() - t }; } };
const nodeRead = async (u) => { const t = Date.now(); const x = await web.readText(u, { fetchImpl: fetch, memo: web.makeMemo(), timeoutMs: 6000 }); return { ok: x.ok, via: x.via, err: x.error, len: (x.text || "").length, ms: Date.now() - t }; };
const browser = await chromium.launch();
const { ctx, page } = await openChat(browser);
const out = [];
for (const u of list) {
  const n = await nodeStatus(u), nr = await nodeRead(u);
  const b = await page.evaluate(async (u) => { const w = await import("/fold-chat-web.js"); const t = Date.now(); try { const x = await w.readText(u, { fetchImpl: (a, o) => fetch(a, o), memo: w.makeMemo(), timeoutMs: 6000 }); return { ok: x.ok, via: x.via, err: x.error, len: (x.text || "").length, ms: Date.now() - t }; } catch (e) { return { threw: String(e), ms: Date.now() - t }; } }, u);
  out.push({ u, nodeFetch: n, nodeRead: nr, browserRead: b });
  console.log(u.slice(0, 80).padEnd(80), "| nodeFetch", n.status || n.err, "| nodeRead", nr.ok ? "ok:" + nr.via : "FAIL", "| browser", b.ok ? "ok:" + b.via : "FAIL:" + (b.err || b.threw), b.ms + "ms");
}
fs.writeFileSync(here("./reach.json"), JSON.stringify(out, null, 1));
await browser.close();
