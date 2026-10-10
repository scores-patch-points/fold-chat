// G1 measurement of describeOutput on the frozen corpus. `--final` prints held failures individually; default prints only dev failures and held aggregates.
import { CORPUS as C1, PRIORS } from "./corpus.mjs";
import { CORPUS2 } from "./corpus2.mjs";
import { CORPUS3, PRIORS3 } from "./corpus3.mjs";
import { CORPUS4 } from "./corpus4.mjs";
import { CORPUS5 } from "./corpus5.mjs";
const R5 = process.argv.includes("--corpus5"), R4 = process.argv.includes("--corpus4") || R5, R3 = process.argv.includes("--corpus3") || R4, R2 = process.argv.includes("--corpus2");
const CORPUS = R5 ? CORPUS5 : R4 ? CORPUS4 : R3 ? CORPUS3 : R2 ? CORPUS2 : C1;
import { describeOutput } from "../../../fold-chat-outputtype.js";
import { classifyTurn } from "../../../fold-chat-discourse.js";
const final = process.argv.includes("--final");
const INSTR = /\b(write|essay|poem|story|draft|compose|outline|summar\w*|speech|letter|email|article|haiku|tweet|blog|paragraph|report|translate|joke|riddle|slogan|tagline|rewrite)\b/i;
const keysIn = (s, keys) => keys.every((k) => String(s || "").toLowerCase().includes(k));
const sameGaps = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const subset = (got, want) => Object.entries(want || {}).every(([k, v]) => typeof v === "object" ? JSON.stringify(got?.[k]) === JSON.stringify(v) || (v.n != null && got?.[k]?.n === v.n && got?.[k]?.unit === v.unit) || (v.label && got?.[k]?.label === v.label) : String(got?.[k]) === String(v));
const rows = [];
for (const c of CORPUS) {
  const prior = c.prior ? (R3 ? PRIORS3 : PRIORS)[c.prior] : [];
  const d = describeOutput(c.q, { prior, hasMaterial: !!c.hasMaterial });
  const g = c.gold;
  const r = { c, d, set: c.set, q: c.q.slice(0, 80), fails: [] };
  r.wantsOk = d.wants === g.wants;
  r.typeOk = d.type === g.type;
  if (!r.typeOk) r.fails.push(`type ${d.type} != ${g.type}`);
  if (g.wants && r.typeOk) {
    if (g.topicKeys.length) { const ok = keysIn(d.topic, g.topicKeys); r.topicOk = ok; if (!ok) r.fails.push(`topic ${JSON.stringify(d.topic)} lacks ${g.topicKeys}`); }
    r.srcOk = d.needsSources === g.needsSources; if (!r.srcOk) r.fails.push(`needsSources ${d.needsSources} != ${g.needsSources}`);
    const act = (d.voidIfMissing || []).filter((x) => x.active === true).map((x) => x.gap);
    r.voidOk = sameGaps(act, g.voids || []); if (!r.voidOk) r.fails.push(`voids [${act}] != [${g.voids}]`);
    if (d.needsSources && d.topic) { r.qOk = !!d.searchQuery && !INSTR.test(d.searchQuery); if (!r.qOk) r.fails.push(`searchQuery ${JSON.stringify(d.searchQuery)}`); }
    else { r.qOk = d.searchQuery == null; if (!r.qOk) r.fails.push(`searchQuery should be null: ${d.searchQuery}`); }
    if (g.constraints) { r.conOk = subset(d.constraints, g.constraints); if (!r.conOk) r.fails.push(`constraints ${JSON.stringify(d.constraints)} vs ${JSON.stringify(g.constraints)}`); }
    if (g.material) { r.matOk = d.material === g.material; if (!r.matOk) r.fails.push(`material ${d.material} != ${g.material}`); }
    if (g.steps) { const st = (d.steps || []).map((s) => s.type); r.stepOk = JSON.stringify(st) === JSON.stringify(g.steps); if (!r.stepOk) r.fails.push(`steps ${st} != ${g.steps}`); }
    if (g.threadOnly) { /* planTurn-side, not described here */ }
  }
  r.kind = classifyTurn(c.q, { hasMaterial: !!c.hasMaterial });
  rows.push(r);
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + "%" : "n/a") + ` (${a}/${b})`;
const view = (subsetName) => {
  const R = subsetName === "all" ? rows : rows.filter((r) => r.set === subsetName);
  const pos = R.filter((r) => r.c.gold.wants), neg = R.filter((r) => !r.c.gold.wants);
  const tp = pos.filter((r) => r.d.wants);
  const out = {
    n: R.length,
    recall: pct(tp.length, pos.length), falseWants: pct(neg.filter((r) => r.d.wants).length, neg.length),
    typeExact: pct(R.filter((r) => r.typeOk).length, R.length),
    topic: pct(pos.filter((r) => r.topicOk === true).length, pos.filter((r) => r.topicOk !== undefined).length),
    needsSources: pct(pos.filter((r) => r.srcOk === true).length, pos.filter((r) => r.srcOk !== undefined).length),
    voids: pct(pos.filter((r) => r.voidOk === true).length, pos.filter((r) => r.voidOk !== undefined).length),
    searchQuery: pct(pos.filter((r) => r.qOk === true).length, pos.filter((r) => r.qOk !== undefined).length),
    constraints: pct(pos.filter((r) => r.conOk === true).length, pos.filter((r) => r.conOk !== undefined).length),
    material: pct(pos.filter((r) => r.matOk === true).length, pos.filter((r) => r.matOk !== undefined).length),
    steps: pct(pos.filter((r) => r.stepOk === true).length, pos.filter((r) => r.stepOk !== undefined).length),
  };
  return out;
};
const perType = {};
for (const r of rows.filter((r) => r.c.gold.wants)) { const t = r.c.gold.type; (perType[t] ||= [0, 0]); perType[t][1]++; if (r.typeOk) perType[t][0]++; }
console.log("ALL ", JSON.stringify(view("all")));
if (!(R2 || R3)) { console.log("DEV ", JSON.stringify(view("dev")));
console.log("HELD", JSON.stringify(view("held"))); }
console.log("per-type exact:", Object.entries(perType).map(([t, [a, b]]) => `${t} ${a}/${b}`).join("  "));
for (const r of rows) if (r.fails.length && (final || r.set === "dev" || r.set === "r2" || r.set === "r3" || r.set === "r4" || r.set === "r5")) console.log(`[${r.set}] FAIL ${r.q}\n      ${r.fails.join(" | ")}`);
if (!final) console.log(`(held failures hidden: ${rows.filter((r) => r.set === "held" && r.fails.length).length} cases; run with --final)`);
const kn = rows.filter((r) => !r.c.gold.wants && ["generate", "compose", "transform", "code"].includes(r.kind));
console.log("classifyTurn false-wants on negatives:", kn.length, final ? kn.map((r) => r.q) : "");
export { rows };
