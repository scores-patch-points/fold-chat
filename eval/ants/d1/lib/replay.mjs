// lib/replay.mjs — record/replay fetch. First sight of a request: (mode "record") the real network answers and the response is stored by key;
// later runs replay the stored response byte-for-byte. Mode "replay" never touches the network (a miss is a typed 504 and is counted in `misses`).
// The unreachable `holodeck-proxy` web scope (502 from node, measured by probe-search.mjs) is recorded as a synthetic instant 502 so a battery does not wait 27 s per search.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STORE_FILE = path.join(HERE, "../corpus/store.json");
const UA = "the-fold-eval-d1/1.0 (falsification battery; contact: repo owner)";

export function loadStore() { try { return JSON.parse(fs.readFileSync(STORE_FILE, "utf8")); } catch { return {}; } }
export function saveStore(store) { fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true }); let disk = {}; try { disk = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")); } catch {} Object.assign(store, { ...disk, ...store }); const tmp = STORE_FILE + "." + process.pid + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(store)); fs.renameSync(tmp, STORE_FILE); }   // merge with what other recorders wrote
const keyOf = (u, o) => createHash("sha1").update(String(u) + "\n" + String((o && o.method) || "GET") + "\n" + String((o && o.body) || "")).digest("hex");

export function makeReplayFetch({ mode = "replay", store = loadStore(), onRequest = null, throttleMs = 1100 } = {}) {
  let last = 0, dirty = 0, blockedUntil = 0, chain = Promise.resolve();
  const stats = { requests: 0, hits: 0, recorded: 0, misses: 0, synthetic: 0 };
  const f = async (u, o = {}) => {
    const url = typeof u === "string" ? u : u && u.url ? u.url : String(u);
    stats.requests++;
    if (onRequest) { try { onRequest(url, o); } catch {} }
    const k = keyOf(url, o);
    let rec = store[k];
    if (!rec && /holodeck-proxy/i.test(url)) { rec = { status: 502, body: "", synthetic: true, url }; store[k] = rec; dirty++; stats.synthetic++; }
    if (!rec) {
      if (mode !== "record") { stats.misses++; return new Response("", { status: 504, statusText: "not recorded" }); }
      let res = null;
      // ONE real request at a time, a global cool-down honoured by every waiter (the swarm shares an IP; a 429 on one is a 429 on all)
      const turn = (chain = chain.then(async () => {
        for (let i = 0; i < 8; i++) {
          const wait = Math.max(0, Math.max(last + throttleMs, blockedUntil) - Date.now()); if (wait) await new Promise((r) => setTimeout(r, wait));
          last = Date.now();
          try { res = await fetch(url, { ...o, headers: { "user-agent": UA, ...(o.headers || {}) }, signal: AbortSignal.timeout(25000) }); } catch (e) { res = null; }
          if (res && res.status === 429) { const ra = Number(res.headers.get("retry-after")) || 20; blockedUntil = Date.now() + (ra + 3 + i * 5) * 1000; res = null; continue; }
          break;
        }
      }));
      await turn;
      if (!res) { rec = { status: 599, body: "", url, networkError: true }; }
      else rec = { status: res.status, body: await res.text(), url, ct: res.headers.get("content-type") || "" };
      store[k] = rec; dirty++; stats.recorded++;
      if (dirty >= 25 && mode === "record") { saveStore(store); dirty = 0; }
    } else stats.hits++;
    return new Response(rec.body, { status: rec.status, headers: { "content-type": rec.ct || "application/json" } });
  };
  f.flush = () => { if (dirty && mode === "record") { saveStore(store); dirty = 0; } };
  f.stats = stats; f.store = store;
  return f;
}
