// eval/ants/e2/compare.mjs — the paired before/after table from out/<label>-w*.json:  node eval/ants/e2/compare.mjs matrix [more labels]
import fs from "node:fs";
import path from "node:path";
import { median, pct, OUT } from "./lib.mjs";
import { CONFIGS } from "./configs.mjs";
const labels = process.argv.slice(2).length ? process.argv.slice(2) : ["matrix"];
const turns = [];
for (const f of fs.readdirSync(OUT)) for (const l of labels) if (f.startsWith(l + "-w") && f.endsWith(".json") && !f.includes(".rows")) turns.push(...JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")).turns);
const ok = turns.filter((t) => t.t && t.t.ttfa != null);
const byCfg = {}; for (const t of ok) (byCfg[t.cfg] ||= {})[t.id] = t;
const s = (v) => (v == null ? "  -" : (v / 1000).toFixed(1).padStart(5));
const A = byCfg.A || {};
console.log("cfg  n   ttfa(med) p90   | ttd(med)   | all-checks done (med) | correct | paired vs A: median d-ttfa  faster in | median d-all  faster in | model calls before the answer (med) | name");
const out = {};
for (const [k, m] of Object.entries(byCfg).sort()) {
  const ts = Object.values(m);
  const ids = Object.keys(m).filter((id) => A[id]);
  const d = (key) => ids.map((id) => m[id].t[key] - A[id].t[key]);
  const dF = d("ttfa"), dAll = d("all");
  const before = ts.map((t) => { const c0 = t.mark.c0; const lim = (t.t.ttfa ?? 0) + 50; return (t.f || []).filter((f) => f.cls === "model" && f.t1 != null && f.t1 - c0 <= lim).length; });
  const row = { n: ts.length, ttfa: median(ts.map((t) => t.t.ttfa)), p90: pct(ts.map((t) => t.t.ttfa), 0.9), ttd: median(ts.map((t) => t.t.ttd)), all: median(ts.map((t) => t.t.all)), correct: ts.filter((t) => t.correct).length, dF: median(dF), fasterF: dF.filter((x) => x < 0).length, nPair: ids.length, dAll: median(dAll), fasterAll: dAll.filter((x) => x < 0).length, mb: median(before) };
  out[k] = row;
  console.log(k.padEnd(4), String(row.n).padStart(2), "  ", s(row.ttfa), s(row.p90), "  |", s(row.ttd), "  |", s(row.all), "           |", `${row.correct}/${row.n}`.padStart(5), "  |", k === "A" ? "   (reference)" : `${s(row.dF)}   ${row.fasterF}/${row.nPair}`, "      |", k === "A" ? "" : `${s(row.dAll)}   ${row.fasterAll}/${row.nPair}`, "      |", String(row.mb ?? "-").padStart(4), "|", CONFIGS[k]?.name || "");
}
fs.writeFileSync(path.join(OUT, "compare.json"), JSON.stringify(out, null, 1));
// per-question wide table
const ids = [...new Set(ok.map((t) => t.id))];
console.log("\nper question: ttfa s (correct?) by config");
for (const id of ids) console.log(id.padEnd(11), Object.keys(byCfg).sort().map((k) => { const t = byCfg[k][id]; return t ? `${k}:${s(t.t.ttfa).trim()}${t.correct ? "" : "x"}` : `${k}:-`; }).join("  "));
