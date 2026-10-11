// eval/ants/e2/quality.mjs — quality per config on the same 16 ground-truth questions: correct (frozen regex), Pivot kept share, fell back to the sources, provenance verified, REC marks.   node eval/ants/e2/quality.mjs matrix [matrix2 matrix3]
import fs from "node:fs";
import path from "node:path";
import { OUT } from "./lib.mjs";
import { CONFIGS } from "./configs.mjs";
const labels = process.argv.slice(2).length ? process.argv.slice(2) : ["matrix"];
const turns = [];
for (const f of fs.readdirSync(OUT)) for (const l of labels) if (f.startsWith(l + "-w") && f.endsWith(".json") && !f.includes(".rows")) turns.push(...JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")).turns.map((t) => ({ ...t, label: l })));
const by = {}; for (const t of turns) if (t.msg) ((by[t.label + ":" + t.cfg] ||= []).push(t));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
console.log("run:cfg   n  correct  pivot kept share  fell back to sources  provenance verified (turns w/ pointer)  REC: turns marked still-failing  | name");
for (const [k, a] of Object.entries(by).sort()) {
  const piv = a.filter((t) => t.msg.pivot && t.msg.pivot.stats && t.msg.pivot.stats.in);
  const kept = avg(piv.map((t) => t.msg.pivot.stats.kept / t.msg.pivot.stats.in));
  const strand = a.filter((t) => t.msg.authored === "sources").length;
  const pv = a.filter((t) => t.msg.provenance && t.msg.provenance.verified > 0).length;
  const prov = a.filter((t) => t.msg.provenance).length;
  const rec = a.filter((t) => t.msg.loop && !t.msg.loop.cleared).length;
  console.log(k.padEnd(9), String(a.length).padStart(2), `${a.filter((t) => t.correct).length}/${a.length}`.padStart(7), (kept == null ? "-" : kept.toFixed(2)).padStart(12), String(strand).padStart(14), `${pv}/${prov}`.padStart(22), String(rec).padStart(30), "  |", CONFIGS[k.split(":")[1]]?.name || "");
}
