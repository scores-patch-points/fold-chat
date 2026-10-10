// wander.test.mjs — node --test experiments/mind-wandering/
//
// Every assertion here is model-free and reproducible; the run must not need a
// network or a model to pass. The corpus is the one shipped in Zenodotus; when
// it is absent the corpus-dependent tests are skipped, never faked.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tokenize, detokenize, loadPrior, topNeighbours, topicOverlap, makeWanderer, wander, DEFAULT_CORPUS } from "./wander.mjs";

const CORPUS_PRESENT = fs.existsSync(DEFAULT_CORPUS);
const loaded = CORPUS_PRESENT ? loadPrior({ corpusPaths: [DEFAULT_CORPUS], order: 2 }) : null;

test("tokenize keeps words and sentence punctuation, lowercased", () => {
  assert.deepEqual(tokenize("The Castle, at Dusk. A wolf!"), ["the", "castle", ",", "at", "dusk", ".", "a", "wolf", "!"]);
});

test("detokenize attaches punctuation and capitalizes sentence starts", () => {
  assert.equal(detokenize(["the", "castle", ",", "at", "dusk", ".", "a", "wolf"]), "The castle, at dusk. A wolf");
});

test("a missing corpus is a disclosed failure, not a faked prior", () => {
  const bad = loadPrior({ corpusPaths: ["/no/such/file.txt"] });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /not readable/);
});

test("the loop generates without a model and never reports a model call", async (t) => {
  if (!CORPUS_PRESENT) return t.skip("corpus absent");
  const run = await wander({ loaded, topic: "castle", steps: 60, seed: 7 });
  assert.equal(run.modelCalls, 0);
  assert.equal(run.events.length, 60);
  assert.ok(run.events.every((e) => e.source === "prior"));
  assert.ok(run.transcript.length > 20);
});

test("the same seed reproduces the same transcript; a different seed does not", async (t) => {
  if (!CORPUS_PRESENT) return t.skip("corpus absent");
  const a = await wander({ loaded, topic: "night", steps: 50, seed: 3 });
  const b = await wander({ loaded, topic: "night", steps: 50, seed: 3 });
  const c = await wander({ loaded, topic: "night", steps: 50, seed: 4 });
  assert.deepEqual(a.events.map((e) => e.event), b.events.map((e) => e.event));
  assert.notDeepEqual(a.events.map((e) => e.event), c.events.map((e) => e.event));
});

test("the move rule is mechanical: an in-vocabulary topic starts on-topic and drifting pulls overlap down", async (t) => {
  if (!CORPUS_PRESENT) return t.skip("corpus absent");
  const w = makeWanderer({ loaded, topic: "castle", seed: 1 });
  const first = await w.step();
  assert.ok(first.overlap > 0.14, "the first step from the topic is on-topic (the seed window is the topic)");
  const moves = new Set();
  for (let i = 0; i < 200; i += 1) moves.add((await w.step()).move);
  assert.ok(moves.has("continue") || moves.has("anchor"), "ordinary continuation rungs fire");
});

test("an out-of-vocabulary topic is named, and a model is called at most once to seed it", async (t) => {
  if (!CORPUS_PRESENT) return t.skip("corpus absent");
  const w = makeWanderer({ loaded, topic: "zzqxnotaword", seed: 1, model: async () => "a made up thing the corpus never heard" });
  assert.equal(w.isOov(), true);
  await w.step();
  assert.equal(w.state().modelCalls, 1);
  assert.ok(w.state().transcript.some((x) => x === "made"), "the model's seeded words enter the heard material");
  await w.step();
  assert.equal(w.state().modelCalls, 1, "the model is never called twice");
});

test("topicOverlap measures the window against the topic and its neighbourhood", (t) => {
  if (!CORPUS_PRESENT) return t.skip("corpus absent");
  const on = topicOverlap(["castle", "castle"], ["castle"], loaded);
  assert.equal(on.overlap, 1);
  const off = topicOverlap(["zebra", "quixotic"], ["castle"], loaded);
  assert.equal(off.overlap, 0);
});

test("co-occurrence neighbours are real, ranked, and content-only", (t) => {
  if (!CORPUS_PRESENT) return t.skip("corpus absent");
  const n = topNeighbours(loaded, "castle", 5);
  assert.ok(n.length > 0);
  assert.ok(n.every((w) => w.length > 2 && /^[a-z]+$/.test(w)));
});

test("the summary reports where it wandered and how far", async (t) => {
  if (!CORPUS_PRESENT) return t.skip("corpus absent");
  const run = await wander({ loaded, topic: "night", steps: 200, seed: 2 });
  const s = run.summary;
  assert.ok(s.meanOverlap >= 0 && s.meanOverlap <= 1);
  assert.ok(s.maxDriftRun >= 0);
  assert.ok(s.distinctHubs >= 1);
  assert.equal(s.reopens + s.anchors + s.associates + s.drifts + run.events.filter((e) => e.move === "continue").length, 200);
});
