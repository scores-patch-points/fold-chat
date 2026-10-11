// cues.mjs — by question CUE class (not rung): what each arm gets right, and which single mechanical signals predict "no mechanical arm is correct" (= a model would be needed). Prints markdown.
import { BATTERY, passageSet } from "./lib.mjs";
import { load, cueClass, featuresOf } from "./g.mjs";
import { pagesFor } from "./mech.mjs";
const R = { A: load("A"), A2: load("A2"), S: load("S"), B: load("B"), C: load("C"), D: load("D"), E: load("E"), F: load("F"), Fg: load("Fg"), G: load("G") };
const MECH = process.argv.includes("--walls") ? ["A2", "S", "B", "C", "D", "E"] : ["B", "C", "D", "E"];   // default PRECISE only; --walls adds the passage-wall arms A2, S
const ok = (a, q) => !!R[a].get(q.id)?.grade?.ok;
const nonGap = (a, q) => { const r = R[a].get(q.id); if (!r) return false; if (a === "A2" || a === "S") return !!r.nsnips; if (a === "B") return r.kind === "answer"; return !r.gap; };
const answerable = BATTERY.filter((q) => q.answerable);
const cues = [...new Set(BATTERY.map((q) => cueClass(q.q)))];
const lines = ["| cue class | n (answerable) | any model-free arm correct | A2 | S | C | D+ | F | Fg | G |", "|---|---|---|---|---|---|---|---|---|---|"];
for (const c of cues) {
  const qs = answerable.filter((q) => cueClass(q.q) === c); if (!qs.length) continue;
  const f = (a) => `${qs.filter((q) => ok(a, q)).length}/${qs.length}`;
  const anyM = qs.filter((q) => MECH.some((a) => ok(a, q) && nonGap(a, q))).length;
  lines.push(`| ${c} | ${qs.length} | ${anyM}/${qs.length} | ${f("A2")} | ${f("S")} | ${f("C")} | ${f("D")} | ${f("F")} | ${f("Fg")} | ${f("G")} |`);
}
console.log(lines.join("\n"));
// single-signal predictors of NEEDS-MODEL (answerable questions where no mechanical arm is correct)
const sig = {
  "cue is compare/arithmetic/negation/agree/causal": (q, f) => ["compare", "arithmetic", "negation", "agree", "causal"].includes(f.cue),
  "D+, B and E all returned a gap": (q, f) => !(f.D?.answered || f.B?.answered || f.E?.answered),
  "best sentence covers < 0.6 of the ask's stems": (q, f) => !(f.C?.cov >= 0.6),
  "best sentence lacks a typed filler (digit/name)": (q, f) => !f.C?.shaped,
  "the ask names >= 2 pages": (q, f) => pagesFor(q.q, passageSet(q)).length >= 2,
  "cue is opinion": (q, f) => f.cue === "opinion",
};
const label = (q) => !MECH.some((a) => ok(a, q) && nonGap(a, q));
const rows = { D: R.D, B: R.B, E: R.E, C: R.C };
const out = ["", "| signal | fires | precision (of fires: no mechanical arm correct) | recall (of no-mechanical-correct) |", "|---|---|---|---|"];
const feats = new Map(answerable.map((q) => [q.id, featuresOf(q, rows)]));
const pos = answerable.filter(label).length;
for (const [name, fn] of Object.entries(sig)) {
  const fired = answerable.filter((q) => fn(q, feats.get(q.id)));
  const tp = fired.filter(label).length;
  out.push(`| ${name} | ${fired.length} | ${fired.length ? (tp / fired.length).toFixed(2) : "-"} | ${pos ? (tp / pos).toFixed(2) : "-"} |`);
}
console.log(out.join("\n"));
console.log(`\nanswerable questions with NO correct non-vacuous mechanical arm: ${pos}/${answerable.length}`);
