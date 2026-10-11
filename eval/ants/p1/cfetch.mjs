// cfetch.mjs — a disk-cached fetch (url+body keyed) so slot-pipeline runs are reproducible after the first live call. Live network is allowed; every response is stored under p1/cache/.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { HERE } from "./lib.mjs";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 the-fold-eval-p1/1.0";
let last = 0, chain = Promise.resolve();
const gate = () => { const p = chain.then(async () => { const w = last + 2000 - Date.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); last = Date.now(); }); chain = p.catch(() => {}); return p; };
const DIR = path.join(HERE, "cache", "net"); fs.mkdirSync(DIR, { recursive: true });
export const NET = { live: 0, hit: 0, fail: 0, offline: false };
export async function cfetch(url, o = {}) {
  const key = crypto.createHash("sha1").update(String(url) + "|" + (o.method || "GET") + "|" + (typeof o.body === "string" ? o.body : "")).digest("hex");
  const f = path.join(DIR, key + ".json");
  if (fs.existsSync(f)) { NET.hit++; const c = JSON.parse(fs.readFileSync(f, "utf8")); return new Response(c.body, { status: c.status, headers: c.headers }); }
  if (NET.offline) { NET.fail++; return new Response("", { status: 504 }); }
  try {
    let r;
    for (let k = 0; k < 7; k++) { await gate(); r = await fetch(url, { ...o, headers: { "user-agent": UA, ...(o.headers || {}) }, signal: o.signal }); if (r.status !== 429) break; await new Promise((x) => setTimeout(x, Math.max(3000 * (k + 1), 1000 * (+r.headers.get("retry-after") || 1)))); }
    const body = await r.text();
    if (r.status === 200) { fs.writeFileSync(f, JSON.stringify({ url: String(url), status: r.status, headers: { "content-type": r.headers.get("content-type") || "text/plain" }, body })); }
    NET.live++;
    return new Response(body, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "text/plain" } });
  } catch (e) { NET.fail++; throw e; }
}
