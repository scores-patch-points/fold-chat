// report12.mjs — the three mechanical summarisers on R12 (lead-3, salientSentences(3), the door-referent fold) vs the strand (A) and the model (F): coverage of the 5 key facts, invented figures/names.
import { BATTERY, mean } from "./lib.mjs";
import { rows } from "./report.mjs";
import { gradeSummary } from "./lib.mjs";
const qs = BATTERY.filter((q) => q.rung === 12);
const line = (name, get) => { const cs = [], oks = []; for (const q of qs) { const t = get(q); if (t == null) continue; const g = gradeSummary(q, t); cs.push(g.coverage); oks.push(g.ok ? 1 : 0); } return cs.length ? `| ${name} | ${cs.length} | ${mean(cs).toFixed(2)} | ${oks.reduce((a, b) => a + b, 0)}/${oks.length} |` : null; };
const out = ["| summariser | pages | mean key-fact coverage (of 5) | graded correct (cov>=0.6, nothing invented) |", "|---|---|---|---|"];
for (const l of [
  line("lead-3 (first three sentences)", (q) => rows.C.get(q.id)?.sum_lead3?.text),
  line("salientSentences(3) (fold-chat-present)", (q) => rows.C.get(q.id)?.sum_salience3?.text),
  line("EO-fold: door referents, central claims as their own sentences", (q) => rows.C.get(q.id)?.sum_fold?.text),
  line("A: strand (Wikipedia lead)", (q) => rows.A.get(q.id)?.text),
  line("F: gemma2:2b on the strand", (q) => rows.F.get(q.id)?.text),
  line("Fg: gemma2:2b on the page head", (q) => rows.Fg.get(q.id)?.text),
]) if (l) out.push(l);
console.log(out.join("\n"));
const per = qs.map((q) => { const f = rows.C.get(q.id); return f ? `${q.pages[0]}: fold ${gradeSummary(q, f.sum_fold?.text || "").coverage.toFixed(1)} lead3 ${gradeSummary(q, f.sum_lead3?.text || "").coverage.toFixed(1)} sal ${gradeSummary(q, f.sum_salience3?.text || "").coverage.toFixed(1)}` : null; }).filter(Boolean);
console.log(per.join("\n"));
