// fold-chat-outside.test.mjs — THE OUTSIDE INTERPRETER, FALSIFIED.
//
// The claim: a turn can stop on signals OUTSIDE its own residual — NEW GROUND
// (a search that adds nothing) and a REPEATED STATE (the turn returned to where
// it was). experiment-recursion.mjs proved the residual alone cannot close the
// loop; these are the signals that can.
//
// FALSIFIED AND FIXED (each is a test below):
//   F1 · an exact-state guard is fooled by WORDING DRIFT — the same situation
//        re-described reads as a new state. Fixed: the guard ALSO stops on
//        passes that added no new ground (maxStalePasses).
//   F2 · a domain-only source identity called a DIFFERENT PAGE on a known host
//        "no new ground". Fixed: keyOf is host + path (query dropped).
import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf, novelGround, createProgressGuard, stateOf, isConverging } from "./fold-chat-outside.js";

const M = (source, text = "x") => ({ source, text });

test("novelGround: the first read is all new; the same sources read again are none", () => {
  const seen = new Set();
  const a = novelGround([M("a.example"), M("b.example")], seen);
  assert.deepEqual(a.novel, ["a.example", "b.example"]);
  for (const k of a.keys) seen.add(k);
  const b = novelGround([M("a.example"), M("b.example")], seen);
  assert.deepEqual(b.novel, [], "the same ground is not new");
});

test("F2 · novelGround: a DIFFERENT page on a known host IS new ground", () => {
  const seen = new Set(["a.example/x"]);
  assert.deepEqual(novelGround([{ url: "https://a.example/y" }], seen).novel, ["a.example/y"], "a new page is new ground");
});

test("keyOf: host + path, query dropped; www and case folded", () => {
  assert.equal(keyOf({ url: "https://www.Example.com/a?q=1" }), "example.com/a");
  assert.equal(keyOf({ url: "https://a.example/x" }), "a.example/x");
  assert.notEqual(keyOf({ url: "https://a.example/x" }), keyOf({ url: "https://a.example/y" }));
  assert.equal(keyOf({ url: "https://a.example/x?utm=1" }), keyOf({ url: "https://a.example/x" }));
});

test("stateOf: the same ground in a different order is the SAME state", () => {
  const a = stateOf({ ground: ["a.example", "b.example"], need: "sources", finding: "nope", outline: "hero\ncards" });
  const b = stateOf({ ground: ["b.example", "a.example"], need: "sources", finding: "nope", outline: "hero  cards" });
  assert.equal(a, b);
});

test("createProgressGuard: the SECOND sighting of an exact state is stagnant", () => {
  const g = createProgressGuard();
  assert.equal(g.note({ sig: "s1", groundSize: 1 }).stagnant, false);
  assert.equal(g.note({ sig: "s2", groundSize: 2 }).stagnant, false);
  assert.equal(g.note({ sig: "s1", groundSize: 2 }).stagnant, true, "an exact cycle stops");
});

test("F1 · createProgressGuard: a cycle under WORDING DRIFT is still caught (no new ground)", () => {
  const g = createProgressGuard();
  assert.equal(g.note({ sig: stateOf({ ground: ["a"], need: "the JavaScript implementation", finding: "x is not defined" }), groundSize: 1 }).stagnant, false);
  const b = g.note({ sig: stateOf({ ground: ["a"], need: "a working JS implementation for it", finding: "the page rendered nothing" }), groundSize: 1 });
  assert.equal(b.stagnant, true, "same ground, re-described, stopped by the no-new-ground rule");
  assert.equal(b.grew, false);
});

test("createProgressGuard: new ground resets the stale count (a turn that is learning runs on)", () => {
  const g = createProgressGuard();
  g.note({ sig: "s1", groundSize: 1 });
  assert.equal(g.note({ sig: "s2", groundSize: 1 }).stagnant, true);
  const back = g.note({ sig: "s3", groundSize: 2 });
  assert.equal(back.grew, true);
  assert.equal(back.stagnant, false, "new ground is progress");
});

test("isConverging: a settling residual is left to the DMD; a flat or rising one is not", () => {
  assert.equal(isConverging([8, 4, 2]), true);
  assert.equal(isConverging([9, 9, 9]), false, "flat is NOT converging — the stale rule may stop it");
  assert.equal(isConverging([2, 4, 8]), false, "rising is not converging");
  assert.equal(isConverging([8, 4]), false, "two points are not a trajectory");
});
