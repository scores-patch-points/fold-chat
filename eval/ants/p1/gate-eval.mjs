// gate-eval.mjs — how well does the pure gate (g.mjs escalate) predict "a model is needed"? odd/even halves; prints markdown + writes results/gate.json
import fs from "node:fs";
import path from "node:path";
import { BATTERY, RESULTS } from "./lib.mjs";
import { load } from "./g.mjs";
const GARM = (process.argv.find((a) => a.startsWith("--arm=")) || "--arm=G").slice(6);
const G = load(GARM), rows = { A: load("A"), A2: load("A2"), S: load("S"), B: load("B"), C: load("C"), D: load("D"), E: load("E"), F: load("F"), Fg: load("Fg") };
const per = {}; const half = new Map();
for (const q of BATTERY) { per[q.rung] = (per[q.rung] || 0) + 1; half.set(q.id, per[q.rung] % 2 ? "odd" : "even"); }
const gapOf = (a, r) => (a === "A" || a === "A2" ? !r.nsnips : a === "B" ? r.kind !== "answer" : ["F", "Fg"].includes(a) ? !String(r.text || "").trim() : !!r.gap);
const MECH = (process.argv.includes("--walls") ? ["A2", "S", "B", "C", "D", "E"] : ["B", "C", "D", "E"]);   // default: PRECISE model-free arms only (no passage walls: the user rejects "answering by snippage"); --walls adds A2 and S
const stat = (ids) => {
  let n = 0, trusted = 0, trustedOk = 0, mechOk = 0, mechOkTrusted = 0, esc = 0, escJust = 0, escUseful = 0, needModel = 0, needModelEsc = 0, gapRoute = 0, gapRouteOk = 0, gOk = 0, fOk = 0;
  for (const q of BATTERY) {
    if (!ids(q)) continue; const g = G.get(q.id); if (!g) continue; n++;
    const anyMech = MECH.some((a) => rows[a].get(q.id)?.grade?.ok && (q.answerable ? !gapOf(a, rows[a].get(q.id)) : false));
    const f = rows.F.get(q.id); const fAfter = g.escalated ? g.grade.ok : !!f?.grade?.ok;   // F as the product would speak it (after the pivot) if escalated, else raw F ok
    if (g.grade.ok) gOk++; if (f?.grade?.ok) fOk++;
    if (g.stage === "gap") { gapRoute++; if (g.grade.ok) gapRouteOk++; continue; }
    if (!g.escalated) { trusted++; if (g.grade.ok) trustedOk++; } else { esc++; if (!anyMech) escJust++; if (g.grade.ok) escUseful++; }
    if (anyMech) { mechOk++; if (!g.escalated) mechOkTrusted++; }
    if (!anyMech && f?.grade?.ok) { needModel++; if (g.escalated) needModelEsc++; }
  }
  const r = (a, b) => (b ? +(a / b).toFixed(2) : null);
  return { n, G_acc: r(gOk, n), F_acc: r(fOk, n), trusted, trust_precision: r(trustedOk, trusted), mech_correct: mechOk, trust_recall_of_mech_correct: r(mechOkTrusted, mechOk), escalated: esc, escalation_precision_no_mech_arm_correct: r(escJust, esc), escalation_then_correct: r(escUseful, esc), model_needed: needModel, model_needed_recall: r(needModelEsc, needModel), gap_routed: gapRoute, gap_routed_correct: r(gapRouteOk, gapRoute) };
};
const out = { odd: stat((q) => half.get(q.id) === "odd"), even: stat((q) => half.get(q.id) === "even"), all: stat(() => true), byRung: {} };
for (const r of [...new Set(BATTERY.map((q) => q.rung))]) out.byRung[r] = stat((q) => q.rung === r);
fs.writeFileSync(path.join(RESULTS, GARM === "G" ? "gate.json" : `gate-${GARM}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ odd: out.odd, even: out.even }, null, 1));
