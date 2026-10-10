// G1 baseline over ALL five corpora: the ORIGINAL classifyTurn (git HEAD copy) + planTurn, against the same gold, next to the new reading.
import fs from "node:fs";
import { CORPUS as C1, PRIORS } from "./corpus.mjs";
import { CORPUS2 } from "./corpus2.mjs";
import { CORPUS3, PRIORS3 } from "./corpus3.mjs";
import { CORPUS4 } from "./corpus4.mjs";
import { CORPUS5 } from "./corpus5.mjs";
import { classifyTurn as oldClassify } from "../../../.g1-old-discourse.js";
import { classifyTurn as newClassify, skipsSearch } from "../../../fold-chat-discourse.js";
import { planTurn } from "../../../fold-chat-flow.js";
import { describeOutput } from "../../../fold-chat-outputtype.js";
const WANTS = new Set(["generate", "compose", "transform", "code"]);
const INSTR = /\b(write|essay|poem|story|draft|compose|outline|summar\w*|speech|letter|email|article|haiku|tweet|blog|paragraph|report|translate|joke|riddle|slogan|tagline|rewrite|escribe|ensayo|poema|écris|poème|напиши|эссе)\b/i;
const sets = [["r1", C1, PRIORS], ["r2", CORPUS2, PRIORS], ["r3", CORPUS3, PRIORS3], ["r4", CORPUS4, PRIORS3], ["r5", CORPUS5, PRIORS3]];
const rows = [];
for (const [name, corpus, pri] of sets) for (const c of corpus) {
  const prior = c.prior ? pri[c.prior] : [];
  const ko = oldClassify(c.q, { hasMaterial: !!c.hasMaterial }), kn = newClassify(c.q, { hasMaterial: !!c.hasMaterial });
  const plan = planTurn(c.q, prior, {});
  const d = describeOutput(c.q, { prior, hasMaterial: !!c.hasMaterial });
  rows.push({ set: name, c, ko, kn, oldQuery: plan.mode === "web" ? plan.search : null, oldSearches: !skipsSearch(ko) && plan.mode === "web", d });
}
const pct = (a, b) => `${b ? (100 * a / b).toFixed(1) : "n/a"}% (${a}/${b})`;
const pos = rows.filter((r) => r.c.gold.wants), neg = rows.filter((r) => !r.c.gold.wants);
const o = { n: rows.length, wants: pos.length, negatives: neg.length };
o.old = { recall: pct(pos.filter((r) => WANTS.has(r.ko)).length, pos.length), falseWants: pct(neg.filter((r) => WANTS.has(r.ko)).length, neg.length) };
o.neu_classifyTurn = { recall: pct(pos.filter((r) => WANTS.has(r.kn) || r.kn === "research" && r.c.gold.needsSources).length, pos.length), falseWants: pct(neg.filter((r) => WANTS.has(r.kn)).length, neg.length) };
o.neu_typeExact = pct(rows.filter((r) => r.d.type === r.c.gold.type).length, rows.length);
const perType = {};
for (const r of pos) { const t = r.c.gold.type; (perType[t] ||= { n: 0, old: 0, neu: 0 }); perType[t].n++; if (WANTS.has(r.ko)) perType[t].old++; if (r.d.type === t) perType[t].neu++; }
o.perType = Object.fromEntries(Object.entries(perType).map(([t, v]) => [t, `old wants ${v.old}/${v.n} | new exact type ${v.neu}/${v.n}`]));
const need = pos.filter((r) => r.c.gold.needsSources && r.c.gold.topicKeys.length);
o.queryHasInstruction_old = pct(need.filter((r) => r.oldQuery && INSTR.test(r.oldQuery)).length, need.length);
o.queryHasInstruction_new = pct(need.filter((r) => r.d.searchQuery && INSTR.test(r.d.searchQuery)).length, need.length);
o.queryHasTopic_old = pct(need.filter((r) => r.oldQuery && r.c.gold.topicKeys.every((k) => r.oldQuery.toLowerCase().includes(k)) && !INSTR.test(r.oldQuery)).length, need.length);
o.queryHasTopic_new = pct(need.filter((r) => r.d.searchQuery && r.c.gold.topicKeys.every((k) => r.d.searchQuery.toLowerCase().includes(k)) && !INSTR.test(r.d.searchQuery)).length, need.length);
const ana = pos.filter((r) => r.c.gold.anaphora && r.c.gold.topicKeys.length && r.c.prior);
o.anaphora = { n: ana.length, old_correct_topic_in_query: pct(ana.filter((r) => r.oldQuery && r.c.gold.topicKeys.every((k) => r.oldQuery.toLowerCase().includes(k)) && !INSTR.test(r.oldQuery)).length, ana.length), new_correct_topic: pct(ana.filter((r) => r.d.topic && r.c.gold.topicKeys.every((k) => r.d.topic.toLowerCase().includes(k))).length, ana.length) };
const nosrc = pos.filter((r) => !r.c.gold.needsSources && !["code"].includes(r.c.gold.type));
o.needlessSearch = { n: nosrc.length, old_searches: pct(nosrc.filter((r) => r.oldSearches).length, nosrc.length), new_flagged_needsSources_false: pct(nosrc.filter((r) => r.d.wants && !r.d.needsSources).length, nosrc.length) };
const wrongSrc = pos.filter((r) => r.d.type === r.c.gold.type && r.d.needsSources !== r.c.gold.needsSources);
o.needsSourcesWrong_new = wrongSrc.length;
const langs = pos.filter((r) => /[Ѐ-ӿ一-鿿]|\b(escribe|écris|ensayo|poème|schreibe|redacta|hazme|rédige|necesito|dame|fais-moi|écris-moi)\b/i.test(r.c.q));
o.nonEnglishWants = { n: langs.length, old: pct(langs.filter((r) => WANTS.has(r.ko)).length, langs.length), new_type_exact: pct(langs.filter((r) => r.d.type === r.c.gold.type).length, langs.length) };
console.log(JSON.stringify(o, null, 1));
fs.writeFileSync(new URL("./baseline-vs-new.json", import.meta.url), JSON.stringify(o, null, 1));
const disagree = rows.filter((r) => r.d.type !== r.c.gold.type).map((r) => `${r.set} ${r.c.q} => ${r.d.type} (gold ${r.c.gold.type})`);
console.log("new-reading type disagreements with gold:", disagree);
