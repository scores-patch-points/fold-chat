// G1 baseline: the CURRENT classifyTurn + planTurn on the frozen corpus. No model.
import { CORPUS, PRIORS } from "./corpus.mjs";
import { classifyTurn } from "../../../fold-chat-discourse.js";
import { planTurn } from "../../../fold-chat-flow.js";
import { skipsSearch } from "../../../fold-chat-discourse.js";
const WANTS = new Set(["generate", "compose", "transform", "code"]);
const INSTR = /\b(write|writes|essay|esay|poem|story|draft|compose|outline|summar\w*|speech|letter|email|article|haiku|tweet|blog|paragraph|report|translate|list|table|joke|riddle|slogan|tagline|rewrite)\b/i;
const out = { rows: [] };
for (const c of CORPUS) {
  const prior = c.prior ? PRIORS[c.prior] : [];
  const kind = classifyTurn(c.q, { hasMaterial: !!c.hasMaterial });
  const plan = planTurn(c.q, prior, {});
  const searched = !skipsSearch(kind) && plan.mode === "web";
  const query = plan.mode === "web" ? plan.search : null;
  out.rows.push({ set: c.set, q: c.q.slice(0, 70), gold: c.gold.type, kind, wants: WANTS.has(kind), planMode: plan.mode, query, searched, c });
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + "%" : "n/a") + ` (${a}/${b})`;
const R = out.rows;
const pos = R.filter((r) => r.c.gold.wants), neg = R.filter((r) => !r.c.gold.wants);
console.log("== wants-detection (kind in generate|compose|transform|code)");
console.log("recall on wants cases:", pct(pos.filter((r) => r.wants).length, pos.length));
console.log("false wants on negatives:", pct(neg.filter((r) => r.wants).length, neg.length));
const types = [...new Set(pos.map((r) => r.gold))];
for (const t of types) { const rs = pos.filter((r) => r.gold === t); console.log("  ", t.padEnd(12), pct(rs.filter((r) => r.wants).length, rs.length)); }
console.log("== misses"); for (const r of pos.filter((r) => !r.wants)) console.log("  MISS", r.gold.padEnd(11), r.kind.padEnd(9), r.q);
console.log("== false wants"); for (const r of neg.filter((r) => r.wants)) console.log("  FALSE", r.kind.padEnd(9), r.q);
const needSrc = pos.filter((r) => r.c.gold.needsSources);
const impure = needSrc.filter((r) => r.query && INSTR.test(r.query) && !r.c.gold.topicKeys.some((k) => INSTR.test(k)));
const qless = needSrc.filter((r) => !r.query);
console.log("== search text (needsSources cases):", needSrc.length);
console.log("  query contains an instruction/type word:", pct(impure.length, needSrc.length), "| no search at all:", pct(qless.length, needSrc.length));
const ana = pos.filter((r) => r.c.gold.anaphora && r.c.prior && r.c.gold.topicKeys.length);
const anaBad = ana.filter((r) => !(r.query && r.c.gold.topicKeys.every((k) => r.query.toLowerCase().includes(k)) && !INSTR.test(r.query)));
console.log("== anaphora with a thread (topic known):", pct(anaBad.length, ana.length), "wrong query");
for (const r of ana) console.log("   ", r.q.padEnd(44), "->", JSON.stringify(r.query), r.planMode);
const noSrc = pos.filter((r) => !r.c.gold.needsSources && r.kind === "generate");
console.log("== needless search (needsSources=false, kind generate):", pct(noSrc.filter((r) => r.searched).length, noSrc.length));
const thr = pos.filter((r) => r.c.gold.threadOnly);
console.log("== thread-only asks answered from thread:", pct(thr.filter((r) => r.planMode === "thread").length, thr.length));
const gens = pos.filter((r) => r.kind === "generate");
console.log("== of generate-kind turns, queries that are the instruction itself:", pct(gens.filter((r) => r.query && INSTR.test(r.query)).length, gens.length));
console.log(JSON.stringify({ n: R.length, recall: pos.filter((r) => r.wants).length / pos.length, fp: neg.filter((r) => r.wants).length / neg.length }));
