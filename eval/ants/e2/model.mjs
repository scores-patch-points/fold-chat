// eval/ants/e2/model.mjs — a load-independent MODEL of each lever from the measured baseline stages (substitute the measured durations; no new run). Printed as "modelled, not measured".
//   node eval/ants/e2/model.mjs
import fs from "node:fs";
import { median, pct, OUT } from "./lib.mjs";
const D = JSON.parse(fs.readFileSync(OUT + "/baseline.json", "utf8"));
const W = JSON.parse(fs.readFileSync(OUT + "/baseline.waterfall.json", "utf8"));
const byId = Object.fromEntries(W.map((r) => [r.id + "|" + r.group, r]));
const rows = [];
for (const t of D.turns) {
  const w = byId[t.id + "|" + t.group]; if (!w) continue;
  const f = t.msg.feed || []; const wb = f.find((e) => e.op === "begin" && e.id === "write"); const r = f.filter((e) => e.op === "end" && /^r:/.test(e.id) && e.at <= (wb ? wb.at : 1e9));
  const lastRead = r.length ? Math.max(...r.map((e) => e.at)) : null; const originGap = wb && lastRead != null ? Math.max(0, wb.at - lastRead) : 0;
  const c0 = t.mark.c0; const calls = w.calls;
  const firstPointer = calls.find((c) => c.p === "pointer"); const restates = calls.filter((c) => c.p === "restate-claim");
  const T = w.T; const wEnd = w.wEnd ?? T;
  // base: answer visible at T
  const provStart = firstPointer ? firstPointer.at : null;                       // provenance begins when the checked answer exists
  const recSpan = restates.length ? (Math.max(...restates.map((c) => c.at + c.ms)) - Math.min(...restates.map((c) => c.at))) : 0;
  const lap = (t.msg.loop?.passes || []).length;
  // REC cost before the pivot = (provStart || T) - wEnd (pivot is ms) minus nothing else
  const checkBeforePivot = Math.max(0, (provStart ?? T) - wEnd);
  rows.push({ id: t.id, group: t.group, T, wEnd, provStart, checkBeforePivot, lap, originGap, recSpan });
}
const timed = rows.filter((r) => r.T > 1500);
const col = (f) => timed.map(f);
const m = (a) => median(a), q9 = (a) => pct(a, 0.9);
const row = (name, f) => { const a = col(f); console.log(name.padEnd(54), "median", (m(a) / 1000).toFixed(1).padStart(5), "s   p90", (q9(a) / 1000).toFixed(1).padStart(5), "s"); return a; };
console.log(`n=${timed.length} timed baseline turns (feed + fetch log)\n`);
row("BASE  time to first visible answer (= total)", (r) => r.T);
row("L1    answer first: provenance after (REC still before)", (r) => r.provStart ?? r.T);
row("L1+L2b answer first, REC laps after too", (r) => Math.min(r.provStart ?? r.T, r.wEnd + 300));
row("L1+L2b+L9  + origin no longer blocks the write (gap -> <=2 s)", (r) => Math.min(r.provStart ?? r.T, r.wEnd + 300) - Math.max(0, r.originGap - 2000));
console.log("\nBASE  turns where REC laps ran before the answer:", timed.filter((r) => r.checkBeforePivot > 5000).length, "of", timed.length, "; their REC span median", (m(timed.filter((r) => r.checkBeforePivot > 5000).map((r) => r.checkBeforePivot)) / 1000).toFixed(1), "s");
console.log("BASE  turns with a provenance step:", timed.filter((r) => r.provStart != null).length, "; its median span", (m(timed.filter((r) => r.provStart != null).map((r) => r.T - r.provStart)) / 1000).toFixed(1), "s");
console.log("BASE  origin gap (last read -> write start): median", (m(col((r) => r.originGap)) / 1000).toFixed(1), "s; turns >= 7 s:", timed.filter((r) => r.originGap >= 7000).length);
fs.writeFileSync(OUT + "/model.rows.json", JSON.stringify(timed, null, 1));
