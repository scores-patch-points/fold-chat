// report.mjs — assembles the ladder tables from results/*.jsonl (reads only; prints markdown). node report.mjs [--md out.md]
import fs from "node:fs";
import path from "node:path";
import { BATTERY, RESULTS, bootCI, mean, median, passageSet, norm } from "./lib.mjs";
import { load } from "./g.mjs";
const ARMS = ["A", "A2", "S", "B", "C", "D", "E", "F", "Fg", "Fo", "G", "Gw", "Gl", "Gs"];
const NAME = { S: "S salientSources", Fo: "Fo gemma2:2b on oracle evidence", A: "A strand (Wikipedia lead path)", A2: "A2 strand (generic sentence path)", B: "B slot pipeline", C: "C A+fold/narrow", D: "D+ figure/date binder", E: "E door+janus", F: "F gemma2:2b on strand", Fg: "Fg gemma2:2b on gold ctx", G: "G composite" };
const rows = Object.fromEntries(ARMS.map((a) => [a, load(a)]));
const rungs = [...new Set(BATTERY.map((q) => q.rung))].sort((a, b) => a - b);
const qsOf = (r) => BATTERY.filter((q) => q.rung === r);
export const okOf = (arm, q) => { const r = rows[arm].get(q.id); return r ? (r.grade?.ok ? 1 : 0) : null; };
const pct = (x) => (x == null || Number.isNaN(x) ? "  - " : (100 * x).toFixed(0).padStart(3) + "%");
export function cell(arm, r) {
  const xs = qsOf(r).map((q) => okOf(arm, q)).filter((x) => x != null);
  if (!xs.length) return null;
  const m = mean(xs), [lo, hi] = bootCI(xs);
  return { n: xs.length, k: xs.reduce((a, b) => a + b, 0), m, lo, hi };
}
export function ceiling(arm, { from = 1, to = 15, thr = 0.7 } = {}) {
  let first = null, robust = null;
  for (const r of rungs) { if (r < from || r > to) continue; const c = cell(arm, r); if (!c) continue; if (first == null && c.m < thr) first = r; if (robust == null && c.hi < thr) robust = r; }
  return { first, robust };
}
export function answerRate(arm, r) {
  const xs = qsOf(r).map((q) => rows[arm].get(q.id)).filter(Boolean);
  if (!xs.length) return null;
  const gapOf = (x) => (arm === "A" || arm === "A2" || arm === "S" ? !x.nsnips : arm === "B" ? x.kind !== "answer" : arm === "F" || arm === "Fg" || arm === "Fo" ? !String(x.text || "").trim() : arm === "G" ? !String(x.text || "").trim() : !!x.gap);
  return xs.filter((x) => !gapOf(x)).length / xs.length;
}
export function table() {
  const out = [];
  out.push("| rung | n | " + ARMS.map((a) => a).join(" | ") + " |");
  out.push("|---|---|" + ARMS.map(() => "---").join("|") + "|");
  for (const r of rungs) {
    out.push(`| R${r} | ${qsOf(r).length} | ` + ARMS.map((a) => { const c = cell(a, r); return c ? `${c.k}/${c.n} ${pct(c.m).trim()}` : "-"; }).join(" | ") + " |");
  }
  return out.join("\n");
}
export { rows, rungs, qsOf, ARMS, NAME, pct };
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(table());
  for (const a of ARMS) { const c = ceiling(a); const c2 = ceiling(a, { to: 13 }); console.log(a, "ceiling (first rung <70%, R1-15):", c.first, "robust:", c.robust, "| R1-13 only:", c2.first, c2.robust); }
}

// ───────────── groundedness: share of an output's sentences that are (a) verbatim spans of a passage, (b) re-derivable (every number and every content stem is on the passages), (c) neither ─────────────
import { stems, sentencesOfText } from "./ctx.mjs";
const pageCache = new Map();
const poolOf = (q) => { if (!pageCache.has(q.id)) { const ps = passageSet(q); pageCache.set(q.id, { text: norm(ps.map((p) => p.text).join(" ")), stems: new Set(stems(ps.map((p) => p.text).join(" "))), nums: new Set((ps.map((p) => p.text).join(" ").match(/\d[\d,.]*\d|\d/g) || []).map((x) => x.replace(/,/g, ""))) }); } return pageCache.get(q.id); };
export function groundedness(q, text) {
  const pool = poolOf(q);
  const sents = norm(text).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3);
  let verb = 0, derived = 0, free = 0;
  for (const s of sents) {
    const core = s.replace(/\s*\(.*?\)\s*$/, "").replace(/[.!?]+$/, "");
    if (pool.text.includes(norm(s)) || (core.length > 12 && pool.text.includes(norm(core)))) { verb++; continue; }
    const nums = (s.match(/\d[\d,.]*\d|\d/g) || []).map((x) => x.replace(/[,.]$/, "").replace(/,/g, ""));
    const stemsOk = stems(s).every((w) => pool.stems.has(w));
    const numsOk = nums.every((n) => pool.nums.has(n) || n.length <= 2);
    if (stemsOk && numsOk) derived++; else free++;
  }
  return { n: sents.length, verb, derived, free };
}
export function groundTable(arms = ["A", "A2", "S", "B", "C", "D", "E", "F", "Fg", "Fo", "G"]) {
  const lines = ["| arm | sentences | verbatim | re-derivable | neither |", "|---|---|---|---|---|"];
  for (const a of arms) { let n = 0, v = 0, d = 0, f = 0; for (const q of BATTERY) { const r = rows[a].get(q.id); if (!r || !String(r.text || "").trim()) continue; const g = groundedness(q, r.text); n += g.n; v += g.verb; d += g.derived; f += g.free; } if (n) lines.push(`| ${a} | ${n} | ${(100 * v / n).toFixed(0)}% | ${(100 * d / n).toFixed(0)}% | ${(100 * f / n).toFixed(0)}% |`); }
  return lines.join("\n");
}
// ───────────── time ─────────────
export function timeTable() {
  const lines = ["| arm | median ms (all) | median ms R1-5 | median ms R6-13 |", "|---|---|---|---|"];
  for (const a of ARMS) { const rs = BATTERY.map((q) => ({ q, r: rows[a].get(q.id) })).filter((x) => x.r && Number.isFinite(x.r.ms)); if (!rs.length) continue; const m = (f) => { const v = rs.filter(f).map((x) => x.r.ms); return v.length ? Math.round(median(v)) : "-"; }; lines.push(`| ${a} | ${m(() => true)} | ${m((x) => x.q.rung <= 5)} | ${m((x) => x.q.rung >= 6 && x.q.rung <= 13)} |`); }
  return lines.join("\n");
}
// ───────────── abstention discrimination: does the arm say "gap" more on unanswerable (R14-15) than on answerable (R1-13)? ─────────────
export function abstain() {
  const lines = ["| arm | gap rate on answerable R1-13 | gap rate on unanswerable R14-15 | discrimination |", "|---|---|---|---|"];
  for (const a of ARMS) {
    const xs = BATTERY.map((q) => ({ q, r: rows[a].get(q.id) })).filter((x) => x.r);
    if (!xs.length) continue;
    const isGap = (r) => (a === "A" || a === "A2" || a === "S" ? !r.nsnips : a === "B" ? r.kind !== "answer" : ["F", "Fg", "Fo"].includes(a) ? (!String(r.text || "").trim() || r.refused) : a === "G" ? !String(r.text || "").trim() : !!r.gap);
    const ans = xs.filter((x) => x.q.answerable), un = xs.filter((x) => !x.q.answerable);
    if (!ans.length || !un.length) continue;
    const ga = ans.filter((x) => isGap(x.r)).length / ans.length, gu = un.filter((x) => isGap(x.r)).length / un.length;
    lines.push(`| ${a} | ${(100 * ga).toFixed(0)}% | ${(100 * gu).toFixed(0)}% | ${(100 * (gu - ga)).toFixed(0)} pts |`);
  }
  return lines.join("\n");
}

// ───────────── error taxonomy: what exactly broke, per arm per rung ─────────────
const nPage = (t) => norm(passageSet({ id: "x", rung: 0, pages: [t] }).find((p) => p._gold)?.text || "");
const goldPageTexts = (q) => q.pages.map((t) => ({ t, text: nPage(t) }));
export function classify(arm, q) {
  const r = rows[arm].get(q.id); if (!r) return null;
  if (r.grade?.ok) return "correct";
  const why = r.grade?.why || "";
  if (!q.answerable) return arm === "F" || arm === "Fg" || arm === "Fo" ? "answered-instead-of-declining" : "returned-material-instead-of-a-gap";
  if (arm === "A" || arm === "A2" || arm === "C" || arm === "S") {
    if (why === "gap-on-answerable") return "gap-on-answerable (coverage rule withheld)";
    if (why === "coref-dangling") return "coreference: pronoun sentence without the entity";
    const paras = String(r.text || "").split(/\n+/).map(norm).filter((p) => p.length > 20);
    const gps = goldPageTexts(q);
    const present = gps.filter((g) => paras.some((p) => g.text.includes(p) || g.text.includes(p.slice(12, 90))));
    if (present.length < gps.length) return gps.length > 1 && present.length ? "multi-page: one gold page missing from the snips" : "retrieval: gold page not among the snips";
    return "wrong sentence: gold page quoted, the needed fact is not in the snip";
  }
  if (arm === "B") return r.kind === "handoff" ? `handoff:${r.why}` : r.kind === "gap" ? `gap:${r.why}` : r.kind === "contest" ? "contest (rows disagree)" : r.kind === "answer" ? (why === "coref-dangling" ? "answer = the row's own pronoun-led sentence (He/She, entity unnamed)" : "wrong answer (slot filler)") : "other";
  if (arm === "D" || arm === "E") return r.gap ? `gap:${String(r.why || "").split(":")[0].slice(0, 40)}` : `wrong value (${r.skill || "relation"})`;
  if (arm === "F" || arm === "Fg" || arm === "Fo") {
    const starved = arm === "F" && rows.A2.get(q.id) && !rows.A2.get(q.id).grade?.ok;   // F is handed A2's strand: if that strand lacks the evidence the model could not have answered
    const kind = why === "refused-answerable" ? "refused although asked" : r.refused ? "declined / wrong" : `wrong answer (${why})`;
    return arm === "F" ? (starved ? `retrieval-starved (strand lacked the evidence): ${kind}` : `reasoning/format, evidence WAS in the strand: ${kind}`) : kind;
  }
  if (arm === "G") return r.escalated ? `escalated then ${r.grade?.why}` : `mechanical ${r.stage} wrong (${r.grade?.why})`;
  return why;
}
export function taxonomy(arm) {
  const out = {};
  for (const q of BATTERY) { const c = classify(arm, q); if (!c) continue; ((out[q.rung] ??= {})[c] ??= 0); out[q.rung][c]++; }
  return out;
}
export function taxonomyTable(arm) {
  const t = taxonomy(arm); const lines = [];
  for (const r of rungs) { const o = t[r]; if (!o) continue; const items = Object.entries(o).filter(([k]) => k !== "correct").sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`); lines.push(`- R${r} (${o.correct || 0}/${qsOf(r).length} correct): ${items.join("; ") || "-"}`); }
  return lines.join("\n");
}
