// fold-chat-require.test.mjs — THE ASK FOLDED, THE JOIN MECHANICAL. FALSIFIED.
//
// The claim: EVA can grade a product against an ask of ANY size without a model
// holding either whole — the ask folds into bounded addressed spans, each read
// locally into verbatim-verified atoms; the product is the observed render; the
// join is set membership. No family of patterns is recognised anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { askSpans, atomsFrom, missingAtoms, unreadSpans, atomLine } from "./fold-chat-require.js";

test("askSpans: bounded addressable spans; a long sentence is hard-wrapped", () => {
  const spans = askSpans("Build it. And make it work.", { max: 400 });
  assert.equal(spans.length, 2);
  assert.equal(spans[0].text, "Build it.");
  assert.equal(spans[0].start, 0);
  const long = askSpans("x".repeat(900), { max: 400 });
  assert.deepEqual(long.map((s) => s.text.length), [400, 400, 100]);
  assert.equal(long[2].end, 900);
});

test("atomsFrom: kept only if VERBATIM in the span it came from (an invented atom is dropped)", () => {
  const span = { text: "a tip calculator with 10%, 15% and 20% buttons", start: 0, end: 46 };
  const atoms = atomsFrom("10%\n15%\n20%\n25%\nA purple dragon", span);
  assert.deepEqual(atoms.map((a) => a.text), ["10%", "15%", "20%"], "25% and the dragon are not in the ask");
  assert.equal(atoms[0].span.start, 0);
});

test("missingAtoms: a required atom the render does not show is the finding; a shown one is not", () => {
  const atoms = [{ text: "10%" }, { text: "15%" }, { text: "20%" }];
  const shown = { labels: ["10%", "15%"], text: "" };
  assert.deepEqual(missingAtoms(atoms, shown).map((a) => a.text), ["20%"]);
  assert.deepEqual(missingAtoms(atoms, { labels: ["10%", "15%", "20%"] }), []);
});

test("unreadSpans: a span that yielded no atom is a NAMED GAP, never a silent pass", () => {
  const spans = askSpans("Build a page. Make it pretty. Show 10% and 20%.");
  const atoms = atomsFrom("10%\n20%", spans[2]);
  assert.deepEqual(unreadSpans(spans, atoms).map((s) => s.text.trim()), ["Build a page.", "Make it pretty."]);
});

test("GENERALITY (the anti-overfit control): the SAME machinery serves two different asks", () => {
  // Neither branch knows what a percentage or a button is — the ask is read.
  const buttons = askSpans("build a toolbar with Save, Cancel and Delete buttons")[0];
  const percents = askSpans("build a tip calculator with 10%, 15% and 20% buttons")[0];
  const ba = atomsFrom("Save\nCancel\nDelete", buttons);
  const pa = atomsFrom("10%\n15%\n20%", percents);
  assert.deepEqual(ba.map((a) => a.text), ["Save", "Cancel", "Delete"]);
  assert.deepEqual(pa.map((a) => a.text), ["10%", "15%", "20%"]);
  assert.deepEqual(missingAtoms(ba, { labels: ["Save", "Cancel"] }).map((a) => a.text), ["Delete"]);
});

test("atomLine: the join only ever needs a handful of atoms, never a document", () => {
  assert.equal(atomLine([{ text: "10%" }, { text: "15%" }, { text: "20%" }]), "10%, 15%, 20%");
  assert.equal(atomLine([{ text: "x" }], { limit: 1 }), "x");
});
