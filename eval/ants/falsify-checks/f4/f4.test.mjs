// F4 — falsify the "I couldn't point to a sentence … unsupported" notice. Claims and thresholds: eval/ants/F4-PREREG.md (written before any run).
// A FAILING test here is a REFUTED pre-registered claim, not a harness bug. Results are written to results/ and never edited by hand.
//   node --test eval/ants/falsify-checks/f4/f4.test.mjs            (deterministic: oracle / stumble / near / keyword / always-NONE pointers)
//   F4_MODULE=<copy>  …                                             (run the same harness against a mutated copy of the module)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, MODULE_PATH, run, rate, needlePointer, stumblePointer, nonePointer, lexicalPointer } from "./f4-lib.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const mutated = !!process.env.F4_MODULE;
const OUT = path.join(HERE, "results", mutated ? "oracle-results-MUTATED.json" : "oracle-results.json");

const R = { module: MODULE_PATH, at: new Date().toISOString(), supported: [], nonclaims: [], falsesupported: [] };
for (const c of CASES.supported) {
  const oracle = await run({ answer: c.answer, pages: c.pages, point: needlePointer(c.gold) });
  const stumble = await run({ answer: c.answer, pages: c.pages, point: stumblePointer(c.gold) });
  const lexical = await run({ answer: c.answer, pages: c.pages, point: lexicalPointer() });
  R.supported.push({ id: c.id, kind: c.kind, answer: c.answer, oracle, stumble, lexical });
}
for (const c of CASES.nonclaims) {
  const none = await run({ answer: c.answer, pages: c.pages, point: nonePointer() });
  const lexical = await run({ answer: c.answer, pages: c.pages, point: lexicalPointer() });
  R.nonclaims.push({ id: c.id, answer: c.answer, none, lexical });
}
for (const c of CASES.falsesupported) {
  const near = await run({ answer: c.answer, pages: c.pages, point: needlePointer(c.near) });
  const lexical = await run({ answer: c.answer, pages: c.pages, point: lexicalPointer() });
  R.falsesupported.push({ id: c.id, type: c.type, answer: c.answer, near, lexical });
}
const S = R.supported, N = R.nonclaims, F = R.falsesupported;
R.summary = {
  P1_oracle_unsupported: rate(S, (x) => x.oracle.none),
  P1_oracle_unsupported_excluding_structural: rate(S.filter((x) => !/structural|long-page/.test(x.kind)), (x) => x.oracle.none),
  P1_oracle_failed_ids: S.filter((x) => x.oracle.none).map((x) => `${x.id}:${x.oracle.why}`),
  P1_oracle_gold_never_offered: S.filter((x) => x.oracle.none && x.oracle.log.every((l) => !l.goldOffered)).map((x) => x.id),
  P1_lexical_unsupported: rate(S, (x) => x.lexical.none),
  P3_stumble_rescued_of_oracle_ok: (() => { const ok = S.filter((x) => !x.oracle.none); return { n: ok.length, k: ok.filter((x) => !x.stumble.none).length, rate: ok.filter((x) => !x.stumble.none).length / ok.length }; })(),
  P4_notice_fires_on_nonclaims_with_NONE_pointer: rate(N, (x) => x.none.none),
  P5_lexical_verified_on_nonclaims: rate(N, (x) => !x.lexical.none),
  P5_lexical_verified_ids: N.filter((x) => !x.lexical.none).map((x) => `${x.id}: ${x.answer} => ${x.lexical.quote}`),
  P6_near_verified_on_false: rate(F, (x) => !x.near.none),
  P6_by_type: Object.fromEntries([...new Set(F.map((x) => x.type))].map((t) => [t, rate(F.filter((x) => x.type === t), (x) => !x.near.none)])),
  P7_lexical_verified_on_false: rate(F, (x) => !x.lexical.none),
  P7_by_type: Object.fromEntries([...new Set(F.map((x) => x.type))].map((t) => [t, rate(F.filter((x) => x.type === t), (x) => !x.lexical.none)])),
};
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
const T = R.summary;
const diag = (t, o) => t.diagnostic(JSON.stringify(o));

test("P1 (Q2): with an ORACLE pointer the notice fires on <= 2 of 25 supported answers", (t) => { diag(t, [T.P1_oracle_unsupported, T.P1_oracle_failed_ids, T.P1_oracle_unsupported_excluding_structural]); assert.ok(T.P1_oracle_unsupported.k <= 2, `fired on ${T.P1_oracle_unsupported.k}/25: ${T.P1_oracle_failed_ids.join(" | ")}`); });
test("P3 (Q2): a pointer that stumbles once is rescued by the retry on >= 90% of the oracle-verifiable cases", (t) => { diag(t, T.P3_stumble_rescued_of_oracle_ok); assert.ok(T.P3_stumble_rescued_of_oracle_ok.rate >= 0.9, JSON.stringify(T.P3_stumble_rescued_of_oracle_ok)); });
test("P4 (Q3): the notice fires on <= 1 of 18 assertion-free answers even when the pointer says NONE (the correct reply)", (t) => { diag(t, T.P4_notice_fires_on_nonclaims_with_NONE_pointer); assert.ok(T.P4_notice_fires_on_nonclaims_with_NONE_pointer.k <= 1, `fired on ${T.P4_notice_fires_on_nonclaims_with_NONE_pointer.k}/18`); });
test("P5 (Q3): a keyword pointer gets a verified source for <= 1 of 18 assertion-free answers", (t) => { diag(t, [T.P5_lexical_verified_on_nonclaims, T.P5_lexical_verified_ids]); assert.ok(T.P5_lexical_verified_on_nonclaims.k <= 1, T.P5_lexical_verified_ids.join(" | ")); });
test("P6 (Q4): pointed at the sentence a false claim was derived from, the verifier accepts <= 2 of 24 seeded-wrong claims", (t) => { diag(t, [T.P6_near_verified_on_false, T.P6_by_type]); assert.ok(T.P6_near_verified_on_false.k <= 2, `accepted ${T.P6_near_verified_on_false.k}/24 ${JSON.stringify(T.P6_by_type)}`); });
test("P7 (Q4): a keyword pointer gets a verified source for <= 2 of 24 seeded-wrong claims", (t) => { diag(t, [T.P7_lexical_verified_on_false, T.P7_by_type]); assert.ok(T.P7_lexical_verified_on_false.k <= 2, `accepted ${T.P7_lexical_verified_on_false.k}/24 ${JSON.stringify(T.P7_by_type)}`); });
test("P8b (Q4): a fabricated figure that appears nowhere in the sentence IS caught (0 of 4 verified)", (t) => { diag(t, T.P6_by_type["figure-absent"]); assert.equal(T.P6_by_type["figure-absent"].k, 0); });
test("P9c (Q5, static): the notice text names or quotes the claim it is about (any of the 25 supported + 24 false cases)", () => {
  const all = [...S.map((x) => ({ claim: x.answer, narr: x.oracle.narr })), ...F.map((x) => ({ claim: x.answer, narr: x.near.narr }))];
  const naming = all.filter((x) => x.narr.includes(x.claim) || /\bsentence (one|1|first)\b|\bfirst sentence\b/i.test(x.narr));
  assert.ok(naming.length >= all.length * 0.9, `${naming.length}/${all.length} notices identify the sentence they judge`);
});
