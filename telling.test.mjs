// telling.test.mjs — the telling order, mechanically. A being's acts coordinate
// into ONE whole situation-sentence (never a join), connectors are grammatical
// (never causal), story order holds, and every sentence traces to a bound edge.
import test from "node:test";
import assert from "node:assert/strict";
import { tell, threadsOf, scenesOf, joinActs, plaintext } from "./telling.mjs";

const edges = [
  { s: "anna", v: "cough", o: "days", at: 10 },
  { s: "anna", v: "receive", o: "company", at: 20 },
  { s: "prince", v: "enter", o: "court", at: 30 },
];

test("a being's acts join into ONE situation-sentence, grammatical not causal", () => {
  const t = tell({ edges });
  assert.equal(t.telling.length, 1);
  assert.ok(t.telling[0].para.includes("Anna cough days, and receive company"), t.telling[0].para);
  assert.ok(t.telling[0].para.includes("Then Prince enter court."), t.telling[0].para);
  assert.ok(!/because|so\b/i.test(t.telling[0].para), "no causal connective the record does not hold");
});

test("the telling keeps grounds — every sentence names its byte addresses", () => {
  const t = tell({ edges });
  assert.deepEqual(t.telling[0].grounds.sort((a, b) => a - b), [10, 20, 30]);
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