// concepts.test.mjs — drawing concepts from the universe of priors, model-free.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConceptUniverse, makeConceptMuller } from "./concepts.mjs";

const U = loadConceptUniverse();

test("the concept universe loads: Concepticon sets, relations, fields", (t) => {
  if (!U.ok) return t.skip(U.reason);
  assert.ok(U.stats.concepts > 3000);
  assert.ok(U.stats.relations > 100);
  assert.ok(U.stats.fields > 5);
  assert.equal(U.concepts.get(U.byGloss.get("HOME")).gloss, "HOME");
});

test("a thought seeds real concepts", async (t) => {
  if (!U.ok) return t.skip(U.reason);
  const m = await makeConceptMuller({ think: "the guest at the door", universe: U });
  const seeds = m.record().seeds;
  assert.ok(seeds.includes("GUEST"));
  assert.ok(seeds.includes("DOOR"));
});

test("each step sets down a concept with a definition, and the chain is tied", async (t) => {
  if (!U.ok) return t.skip(U.reason);
  const m = await makeConceptMuller({ think: "food and wine", seed: 2, universe: U });
  let last = null;
  for (let i = 0; i < 10; i += 1) {
    const r = m.step();
    assert.ok(r.sentence.includes("—"), "a concept statement carries its gloss and definition");
    assert.ok(r.field, "every concept names its semantic field");
    if (last) assert.ok(last.next && last.next.gloss, "the previous step named where it went");
    last = r;
  }
});

test("the same seed reproduces the same concepts; a different seed does not", async (t) => {
  if (!U.ok) return t.skip(U.reason);
  const run = async (seed) => { const m = await makeConceptMuller({ think: "night and memory", seed, universe: U }); const a = []; for (let i = 0; i < 12; i += 1) a.push(m.step().concept.gloss); return a; };
  assert.deepEqual(await run(7), await run(7));
  assert.notDeepEqual(await run(7), await run(8));
});

test("no model is called", async (t) => {
  if (!U.ok) return t.skip(U.reason);
  const m = await makeConceptMuller({ think: "the sea", seed: 1, universe: U });
  for (let i = 0; i < 5; i += 1) m.step();
  assert.match(m.record().basis, /no model called/);
});
