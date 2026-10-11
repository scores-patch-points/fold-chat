// eval/ants/e2/components.mjs — per-config COMPONENT timings from the feeds + fetch logs (a lever is judged on the component it changes, where the end-to-end noise is smaller than the signal).
//   node eval/ants/e2/components.mjs matrix [matrix2]
import fs from "node:fs";
import path from "node:path";
import { median, pct, OUT } from "./lib.mjs";
const labels = process.argv.slice(2).length ? process.argv.slice(2) : ["matrix"];
const turns = [];
for (const f of fs.readdirSync(OUT)) for (const l of labels) if (f.startsWith(l + "-w") && f.endsWith(".json")) turns.push(...JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")).turns);
const by = {};
for (const t of turns) {
  if (!t.msg || !t.mark) continue; const f = t.msg.feed || []; const w = f.find((e) => e.op === "begin" && e.id === "write"); const cut = w ? w.at : Infinity;
  const rb = f.filter((e) => e.op === "begin" && /^r:/.test(e.id) && e.at <= cut), re = f.filter((e) => e.op === "end" && /^r:/.test(e.id) && e.at <= cut);
  const qb = f.filter((e) => e.op === "begin" && /^q:/.test(e.id) && e.at <= cut), qe = f.filter((e) => e.op === "end" && /^q:/.test(e.id) && e.at <= cut);
  const r0 = rb.length ? Math.min(...rb.map((e) => e.at)) : null, r1 = re.length ? Math.max(...re.map((e) => e.at)) : null;
  const q0 = qb.length ? Math.min(...qb.map((e) => e.at)) : null, q1 = qe.length ? Math.max(...qe.map((e) => e.at)) : null;
  const c0 = t.mark.c0;
  const direct = (t.f || []).filter((x) => x.cls === "direct" && x.t1 != null && !/holodeck|wikipedia/.test(x.u) && x.status == null).map((x) => x.t1 - x.t0);
  const answer = t.e2?.answerAt != null ? t.e2.answerAt - c0 : t.mark.ttfa;
  const laps = f.filter((e) => e.op === "line" && /Reframe, lap/.test(e.title || "")).length;
  const rec = (t.msg.loop && t.msg.loop.passes) ? t.msg.loop.passes.length : 0;
  (by[t.cfg] ||= []).push({ id: t.id, search: q1 != null ? q1 - q0 : null, reads: r0 != null ? r1 - r0 : null, readsEnd: r1, gap: w && r1 != null ? w.at - r1 : null, writeAt: w ? w.at : null, direct, nRead: re.length, rec, answer });
}
const s = (v) => (v == null ? "-" : (v / 1000).toFixed(1));
console.log("cfg  n | search span med | reads span med p90 max | origin gap med p90 | write starts at (med) | failed direct fetches: n, mean s | turns with REC laps");
for (const [k, a] of Object.entries(by).sort()) {
  const d = a.flatMap((x) => x.direct);
  console.log(k.padEnd(4), String(a.length).padStart(2), "|", s(median(a.map((x) => x.search))).padStart(6), "|", s(median(a.map((x) => x.reads))).padStart(6), s(pct(a.map((x) => x.reads), 0.9)).padStart(5), s(Math.max(...a.map((x) => x.reads ?? 0))).padStart(5), "|", s(median(a.map((x) => x.gap))).padStart(5), s(pct(a.map((x) => x.gap), 0.9)).padStart(5), "|", s(median(a.map((x) => x.writeAt))).padStart(6), "|", String(d.length).padStart(4), s(d.length ? d.reduce((x, y) => x + y, 0) / d.length : null).padStart(5), "|", a.filter((x) => x.rec > 0).length);
}
