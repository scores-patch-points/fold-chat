// make-tables.mjs — every number in P1-RESULTS.md comes from here. node make-tables.mjs > results/tables.md
import { BATTERY, bootCI, mean, median } from "./lib.mjs";
import * as R from "./report.mjs";
import { load } from "./g.mjs";
const { rows, rungs, qsOf, ARMS, cell, ceiling, pct } = R;
const P = (s) => console.log(s);
P("## Ladder: rung x arm, correct/n and %, (95% bootstrap CI), v2 grading for composed arms\n");
P("| rung | n | " + ARMS.join(" | ") + " |"); P("|---|---|" + ARMS.map(() => "---").join("|") + "|");
for (const r of rungs) P(`| R${r} | ${qsOf(r).length} | ` + ARMS.map((a) => { const c = cell(a, r); return c ? `${c.k}/${c.n} ${Math.round(c.m * 100)}% (${Math.round(c.lo * 100)}-${Math.round(c.hi * 100)})` : "-"; }).join(" | ") + " |");
P("\n## Ceilings (first rung with accuracy < 70%; robust = first rung whose CI upper bound < 70%)\n");
P("| arm | ceiling R1-15 | robust | rungs >= 70% (point estimate) |"); P("|---|---|---|---|");
for (const a of ARMS) { const c = ceiling(a); const ok = rungs.filter((r) => { const x = cell(a, r); return x && x.m >= 0.7; }); P(`| ${a} | ${c.first ?? "none"} | ${c.robust ?? "none"} | ${ok.map((r) => "R" + r).join(" ") || "-"} |`); }
P("\n## v1 (pre-registered grader) vs v2 (post-hoc regrade) for composed arms: correct/n per rung\n");
P("| arm | " + rungs.map((r) => "R" + r).join(" | ") + " | all |"); P("|---|" + rungs.map(() => "---").join("|") + "|---|");
for (const a of ["B", "D", "E", "F", "Fg", "Fo"]) {
  const v1 = load(a, { v1: true }), v2 = load(a);
  const f = (m, qs) => qs.filter((q) => m.get(q.id)?.grade?.ok).length;
  const cells = rungs.map((r) => { const qs = qsOf(r); if (!v2.size) return "-"; return `${f(v1, qs)}->${f(v2, qs)}`; });
  P(`| ${a} | ${cells.join(" | ")} | ${f(v1, BATTERY)}->${f(v2, BATTERY)} |`);
}
P("\n## Answer rate (non-gap) and precision when answering, per arm (R1-13)\n");
P("| arm | answered | correct when answered |"); P("|---|---|---|");
for (const a of ARMS) { let n = 0, ans = 0, ok = 0; for (const q of BATTERY.filter((q) => q.rung <= 13)) { const r = rows[a].get(q.id); if (!r) continue; n++; const gap = (a === "A" || a === "A2" || a === "S") ? !r.nsnips : a === "B" ? r.kind !== "answer" : (a === "F" || a === "Fg" || a === "Fo") ? (!String(r.text || "").trim() || (r.grade?.why === "refused-answerable")) : a === "G" ? !String(r.text || "").trim() : !!r.gap; if (!gap) { ans++; if (r.grade?.ok) ok++; } } if (n) P(`| ${a} | ${ans}/${n} | ${ans ? Math.round(100 * ok / ans) + "%" : "-"} (${ok}/${ans}) |`); }
P("\n## Abstention discrimination\n"); P(R.abstain());
P("\n## Groundedness of returned text\n"); P(R.groundTable());
P("\n## Wall time (ms, median)\n"); P(R.timeTable());
for (const a of ["A", "A2", "S", "B", "C", "D", "E", "F", "Fo", "G"]) { if (!rows[a].size) continue; P(`\n### Error taxonomy: ${a}\n`); P(R.taxonomyTable(a)); }

// ── the model-free ENVELOPE per rung: the share of questions where at least one model-free arm is correct (an oracle's choice, so an UPPER bound on any composite) ──
P("\n## Model-free envelope per rung (any arm correct, oracle choice; R14/R15 count only arms that did not simply abstain on everything)\n");
P("| rung | n | any model-free arm (walls allowed) | any PRECISE model-free arm (B, C, D+, E: no passage walls) | F (strand) | Fo (oracle evidence) |");
P("|---|---|---|---|---|---|");
const ok = (a, q) => !!rows[a].get(q.id)?.grade?.ok;
const answered = (a, q) => { const r = rows[a].get(q.id); if (!r) return false; if (a === "A" || a === "A2" || a === "S") return !!r.nsnips; if (a === "B") return r.kind === "answer"; return !r.gap; };
for (const r of rungs) {
  const qs = qsOf(r);
  if (r >= 14) { P(`| R${r} | ${qs.length} | - (no model-free arm separates unanswerable from answerable: see abstention table) | - | ${qs.filter((q) => ok("F", q)).length}/${qs.length} | ${rows.Fo.size ? qs.filter((q) => ok("Fo", q)).length + "/" + qs.length : "-"} |`); continue; }
  const any = qs.filter((q) => ["A", "A2", "S", "B", "C", "D", "E"].some((a) => ok(a, q) && answered(a, q))).length;
  const prec = qs.filter((q) => ["B", "C", "D", "E"].some((a) => ok(a, q) && answered(a, q))).length;
  P(`| R${r} | ${qs.length} | ${any}/${qs.length} (${Math.round(100 * any / qs.length)}%) | ${prec}/${qs.length} (${Math.round(100 * prec / qs.length)}%) | ${qs.filter((q) => ok("F", q)).length}/${qs.length} | ${qs.filter((q) => ok("Fo", q)).length}/${qs.length} |`);
}
