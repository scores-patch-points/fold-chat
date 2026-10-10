// eval/ants/e2/engines.mjs — each search engine's REAL latency from node (the same `search()` the page calls, a timing fetch injected).
//   node eval/ants/e2/engines.mjs  → out/engines.json
import { save } from "./lib.mjs";
const web = await import("../../../fold-chat-web.js");
const QS = ["What is the capital of Australia?", "Who painted the Mona Lisa?", "How tall is the Eiffel Tower?", "Who discovered penicillin?", "Marie Curie Nobel Prize"];
const SCOPES = ["web", "wikipedia", "github", "archive", "openalex", "crossref"];
const rows = [];
const timed = (log) => async (u, o) => { const t0 = performance.now(); try { const r = await fetch(u, o); log.push({ u: String(u).slice(0, 80), ms: performance.now() - t0, status: r.status }); return r; } catch (e) { log.push({ u: String(u).slice(0, 80), ms: performance.now() - t0, err: String(e.name) }); throw e; } };
for (const q of QS) {
  // all scopes at once, like searchWeb does
  await Promise.all(SCOPES.map(async (s) => { const log = []; const t0 = performance.now(); let n = null, err = null; try { const out = await web.search(s, q, 0, { fetchImpl: timed(log) }); n = out.results.length; } catch (e) { err = String(e.message || e).slice(0, 80); } rows.push({ scope: s, q, ms: performance.now() - t0, n, err, calls: log.length }); }));
}
const by = {};
for (const r of rows) (by[r.scope] ||= []).push(r);
const summ = Object.fromEntries(Object.entries(by).map(([s, a]) => { const ms = a.map((x) => x.ms).sort((x, y) => x - y); return [s, { n: a.length, ok: a.filter((x) => !x.err && x.n).length, median: Math.round(ms[ms.length >> 1]), max: Math.round(ms[ms.length - 1]), errs: a.filter((x) => x.err).map((x) => x.err).slice(0, 2) }]; }));
console.log(JSON.stringify(summ, null, 1));
save("engines.json", { rows, summ });
