// telling.test.mjs — the telling order, mechanically. A being's acts coordinate
// into ONE whole situation-sentence (never a join), connectors are grammatical
// (never causal), story order holds, and every sentence traces to a bound edge.
import test from "node:test";
import assert from "node:assert/strict";
import { tell, threadsOf, scenesOf, joinActs, plaintext, inflect, tellerSubjects, tellerPatients } from "./telling.mjs";

const edges = [
  { s: "anna", v: "cough", o: "days", at: 10 },
  { s: "anna", v: "kiss", o: "prince", at: 15 },
  { s: "prince", v: "enter", o: "court", at: 30 },
];

test("a being's acts join into ONE situation-sentence, grammatical not causal", () => {
  const t = tell({ edges });
  assert.equal(t.telling.length, 1);
  assert.ok(t.telling[0].para.includes("Anna cough days, and kiss prince."), t.telling[0].para);
  assert.ok(t.telling[0].para.includes("Then Prince enter court."), t.telling[0].para);
  assert.ok(!/because|so\b/i.test(t.telling[0].para), "no causal connective the record does not hold");
});

test("the telling keeps grounds — every sentence names its byte addresses", () => {
  const t = tell({ edges });
  assert.deepEqual(t.telling[0].grounds.sort((a, b) => a - b), [10, 15, 30]);
});

test("situations are ordered by story position, not alphabet", () => {
  const th = threadsOf(edges);
  assert.deepEqual(th.map((x) => x.s), ["anna", "prince"]);
  assert.equal(th[0].acts[0].v, "cough");
});

test("threads far apart become separate scenes", () => {
  const far = [{ s: "a", v: "spear", o: "hall", at: 10, delta: 1 }, { s: "b", v: "board", o: "ships", at: 60000, delta: 1 }];
  const t = tell({ edges: far });
  assert.equal(t.scenes, 2);
});

test("a composed sentence the record cannot trace is unjustified, never shipped", () => {
  const t = tell({ edges, witnessEdge: () => false });
  assert.equal(t.lint.accepted, 0);
  assert.equal(t.lint.unjustified.length, 2);
});

test("joinActs: comma + and, never a causal join", () => {
  assert.equal(joinActs([{ v: "cough", o: "days" }, { v: "receive", o: "company" }, { v: "recover", o: "none" }]), "cough days, receive company, and recover none");
  assert.equal(joinActs([{ v: "go", o: null }]), "go");
});
test('inflect adopts a literary-present form ONLY when the material attests it (the doctrine wall)', () => {
  const tokens = new Set(['kisses', 'enter', 'say', 'says']);
  assert.equal(inflect('kiss', tokens), 'kisses', 'attested present adopted');
  assert.equal(inflect('enter', tokens), 'enter', 'enters unattested -> the seam base stands');
  assert.equal(inflect('say', tokens), 'says');
  assert.equal(inflect('cough', tokens), 'cough', 'coughs unattested -> base stands');
  assert.equal(inflect('kiss'), 'kiss', 'no material in view -> no invented form ever');
});

test('tellerSubjects: a recurrent actor or a name may be seated; a once-acting scene-word may not', () => {
  const edges = [
    { s: 'anna', v: 'warn', o: 'prince', at: 1 }, { s: 'anna', v: 'ask', o: 'prince', at: 2 },
    { s: 'anna', v: 'enter', o: 'court', at: 3 }, { s: 'anna', v: 'greet', o: 'princess', at: 4 },
    { s: 'prince', v: 'warn', o: 'anna', at: 5 },
    { s: 'step', v: 'offer', o: 'contrast', at: 6 },
  ];
  const allowed = tellerSubjects(edges, { nameSignals: new Set(['anna', 'prince', 'pierre']) });
  assert.ok(allowed.has('anna'), 'a recurring actor is seated');
  assert.ok(allowed.has('prince'), 'a name is seated regardless of volume');
  assert.ok(!allowed.has('step'), 'a once-acting scene-word cannot open the seat');
});

test('the subject policy threads into the telling: step is not told', () => {
  const edges = [
    { s: 'anna', v: 'warn', o: 'prince', at: 1 }, { s: 'step', v: 'offer', o: 'contrast', at: 6 },
  ];
  const t = tell({ edges, nameSignals: new Set(['anna', 'prince']) });
  const subjects = t.telling.flatMap((p) => p.sentences).map((s) => s.s);
  assert.ok(subjects.every((s) => s !== 'step'));
  assert.ok(subjects.includes('anna'));
});

test('tellerPatients: a told object must be attested as a patient — a name or a recurrent one', () => {
  const edges = [
    { s: 'anna', v: 'ask', o: 'prince', at: 1 },
    { s: 'anna', v: 'pick', o: 'book', at: 2 },
    { s: 'anna', v: 'open', o: 'book', at: 3 },
    { s: 'anna', v: 'close', o: 'book', at: 4 },
    { s: 'step', v: 'offer', o: 'contrast', at: 5 },
  ];
  const patients = tellerPatients(edges, { nameSignals: new Set(['anna', 'prince']) });
  assert.ok(patients.has('prince'), 'a name is a patient it may be told on');
  assert.ok(patients.has('book'), 'a recurrent patient is attested');
  assert.ok(!patients.has('contrast'), 'a once-seated object cannot be told on');
});

test('entities render title-case when the material uses them as names (case-free identity, rendered capital)', () => {
  const t = tell({ edges: [{ s: 'anna', v: 'greet', o: 'prince', at: 1 }], nameSignals: new Set(['anna', 'prince']) });
  assert.match(t.telling[0].para, /Anna greet Prince\./);
  assert.ok(!/greet prince/.test(t.telling[0].para), 'a signalled name never renders lowercase mid-sentence');
  const plain = tell({ edges: [
    { s: 'anna', v: 'open', o: 'book', at: 1 },
    { s: 'anna', v: 'close', o: 'book', at: 2 },
    { s: 'anna', v: 'pass', o: 'book', at: 3 },
  ], nameSignals: new Set(['anna']) });
  assert.ok(/open book/.test(plain.telling[0].para), 'a common noun stays lowercase');
});
