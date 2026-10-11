// janus.test.mjs — the reasoning pass, model-free and reproducible.
import { test } from "node:test";
import assert from "node:assert/strict";
import { edgesFromEvents, runThroughJanus, logicalTranscript } from "./janus.mjs";
import { detokenize } from "./wander.mjs";

const ev = (...tokens) => tokens.map((event, i) => ({ n: i + 1, event, move: i % 3 === 0 ? "drift" : "continue", overlap: 0.1, grain: 2 }));

test("edges are consecutive content words, punctuation and short tokens dropped", () => {
  const e = edgesFromEvents(ev("castle", ",", "the", "wall", ".", "castle"));
  assert.deepEqual(e.map((x) => [x.from, x.to]), [["castle", "wall"], ["wall", "castle"]]);
});

test("a word leading to two different words is a standing contradiction — Janus refutes the second", () => {
  // castle→wall, then wall→door, then wall→window: wall now has two values.
  const events = ev("castle", "wall", "door", "wall", "window");
  const j = runThroughJanus(events);
  const refuted = j.refuted.map((r) => `${r.edge.from}→${r.edge.to}`);
  assert.ok(refuted.includes("wall→window"), "the second value for wall is refuted");
  assert.ok(!refuted.includes("wall→door"), "the first value stands");
  assert.ok(j.kept >= 3);
  assert.equal(j.verdict.ok, true, "the kept spine is coherent");
  assert.ok(j.probe.caught >= j.kept, "every kept claim was probed for a counterexample");
});

test("a word preceding itself is a circular contradiction", () => {
  const j = runThroughJanus(ev("castle", "wall", "wall"));
  assert.ok(j.refuted.some((r) => r.kind === "circular"));
});

test("the logical transcript drops exactly the refused transitions' words", () => {
  const events = ev("castle", "wall", "door", "wall", "window");
  const j = runThroughJanus(events);
  const kept = logicalTranscript(j, detokenize);
  assert.ok(!/window/.test(kept), "the refuted word is not in the logical transcript");
  assert.ok(/castle/i.test(kept) && /door/i.test(kept));
});

test("a clean chain keeps everything and probes cleanly", () => {
  const j = runThroughJanus(ev("castle", "wall", "window", "garden", "forest"));
  assert.equal(j.refuted.length, 0);
  assert.equal(j.verdict.ok, true);
});
