// eval/ants/c3/score-door.mjs — K1: the khora read door's relation signal on the C3 battery (reads door-raw.json from collect-door.mjs; no network).
// Rule, fixed in C3-PREREG.md before the run: ACCEPT iff some claim relation and some sentence relation share a verb stem AND their two ends overlap in content stems IN THE SAME ORDER.
// `swapped` = same verb stem, ends overlap crosswise only. Coverage = both sides produced >= 1 relation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ground from "../../../fold-chat-ground.js";
import { functionWordsOf } from "../../../fold-chat-snippets.js";
import { report } from "./lib.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const SET = process.env.C3_SET ? "-" + process.env.C3_SET : "";   // C3_SET=cf → the counterfactual control (battery-cf.json, results-*-cf.json)
const door = JSON.parse(fs.readFileSync(path.join(here, `door-raw${SET}.json`), "utf8"));
const battery = JSON.parse(fs.readFileSync(path.join(here, `battery${SET}.json`), "utf8"));
const fw = functionWordsOf("en");
const stems = (t) => new Set(ground.tokenize(String(t ?? "")).filter((x) => x.length > 2 && !fw.has(x)).map((x) => ground.stemOf(x)));
const share = (a, b) => [...a].some((x) => b.has(x));
const ends = (r) => [r.participants?.[0]?.surface, r.participants?.[1]?.surface].map(stems);
const verb = (r) => ground.stemOf(String(r.relation || "").toLowerCase());
export function relationSignal(claimRels, sentRels) {
  let agree = false, swapped = false;
  for (const c of claimRels || []) for (const s of sentRels || []) {
    if (verb(c) !== verb(s)) continue;
    const [c1, c2] = ends(c), [s1, s2] = ends(s);
    if (share(c1, s1) && share(c2, s2)) agree = true;
    else if (share(c1, s2) && share(c2, s1)) swapped = true;
  }
  return { agree, swapped };
}
// EXPLORATORY, written AFTER the first K1 run (post-hoc, not pre-registered): K1s = same verb stem AND every content stem of each claim end is in the same-position sentence end.
const subset = (a, b) => [...a].every((x) => b.has(x));
export function strictRelationSignal(claimRels, sentRels) {
  for (const c of claimRels || []) for (const s of sentRels || []) {
    if (verb(c) !== verb(s)) continue;
    const [c1, c2] = ends(c), [s1, s2] = ends(s);
    if (c1.size && c2.size && subset(c1, s1) && subset(c2, s2)) return true;
  }
  return false;
}
const rows = door.pairs.map((r) => {
  const p = battery.pairs.find((x) => x.id === r.id);
  const sig = relationSignal(r.claim.relations, r.sentence.relations);
  const cov = (r.claim.relations || []).length > 0 && (r.sentence.relations || []).length > 0;
  return { id: p.id, label: p.label, loose: !!p.loose, type: p.type, K1: sig.agree ? "ACCEPT" : "REJECT", K1s: strictRelationSignal(r.claim.relations, r.sentence.relations) ? "ACCEPT" : "REJECT", swapped: sig.swapped, covered: cov, claimRel: (r.claim.relations || []).length, sentRel: (r.sentence.relations || []).length, jointReferents: (r.joint.referents || []).length, singleReferents: (r.claim.referents || []).length + (r.sentence.referents || []).length };
});
fs.writeFileSync(path.join(here, `results-door${SET}.json`), JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
console.log(report("K1 relation-agree", rows, "K1"));
console.log(report("K1s (post-hoc, exploratory)", rows, "K1s"));
const cov = rows.filter((r) => r.covered);
console.log(`coverage (both sides >=1 relation): ${cov.length}/30  by label: ` + ["E", "T", "C", "U"].map((l) => `${l} ${rows.filter((r) => r.label === l && r.covered).length}/${rows.filter((r) => r.label === l).length}`).join("  "));
console.log(`claims with >=1 relation: ${rows.filter((r) => r.claimRel).length}/30; sentences with >=1 relation: ${rows.filter((r) => r.sentRel).length}/30`);
console.log(`single-text referents total: ${rows.reduce((a, r) => a + r.singleReferents, 0)} (60 reads); joint-text pairs with >=1 referent: ${rows.filter((r) => r.jointReferents).length}/30`);
console.log("swapped flagged:", rows.filter((r) => r.swapped).map((r) => `${r.id}${r.label}`).join(" ") || "none");
console.log(rows.map((r) => `${r.id}${r.label}${r.loose ? "*" : ""}:${r.K1[0]}${r.swapped ? "S" : ""}${r.covered ? "" : "-"}`).join(" "));
