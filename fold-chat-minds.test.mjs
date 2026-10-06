// Corrections: a referent the person refuses is not carried again (fold-chat-minds.js, fold-chat-mind.js resolveQuestion). Pure.
import test from "node:test";
import assert from "node:assert/strict";
import { correctionOp, addOp, rejectedSurfaces, emptyMinds, carryNotice, mindLog, personMind, mindsClause } from "./fold-chat-minds.js";
import { followUp } from "./fold-chat-thread.js";
import { hintsFor } from "./fold-chat-hints.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";

const EN = hintsFor("en");
const thread = [
  { role: "user", content: "Who is Ada Lovelace?" },
  { role: "assistant", content: "Ada Lovelace was an English mathematician who wrote the first published algorithm for Babbage's Analytical Engine.", authored: "sources" },
];
const referents = admitReferents(emptyReferents(), { question: "Who is Ada Lovelace?", answer: "Ada Lovelace was an English mathematician.", titles: ["Ada Lovelace"] });

test("without a correction the pronoun carries the last answer's referent", () => {
  const f = followUp("what happened to her?", thread, { referents, hints: EN });
  assert.equal(f.kind, "carried");
  assert.ok(f.carried.length >= 1);
});

test("a rejected referent is not carried again (control above carries it)", () => {
  const minds = addOp(emptyMinds(), correctionOp("carry-rejected", f0().carried[0], 1));
  const f = followUp("what happened to her?", thread, { referents, hints: EN, rejected: rejectedSurfaces(minds) });
  assert.notEqual(f.kind, "carried");   // the one person in the record was refused; "her" does not fall back to a non-person
  assert.ok(!f.carried.some((c) => rejectedSurfaces(minds).includes(c)));
});

function f0() { return followUp("what happened to her?", thread, { referents, hints: EN }); }

test("ops are append-only and typed", () => {
  const a = emptyMinds(), b = addOp(a, correctionOp("carry-rejected", "Ada Lovelace", 1));
  assert.equal(a.ops.length, 0);
  assert.deepEqual(rejectedSurfaces(b), ["Ada Lovelace"]);
  assert.throws(() => correctionOp("nope", "x", 1));
  assert.throws(() => correctionOp("carry-rejected", "  ", 1));
});

test("a carried turn says what it was read as; a standalone one says nothing", () => {
  const n = carryNotice(f0(), 2);
  assert.equal(n.kind, "carry"); assert.deepEqual(n.carried, ["Ada Lovelace"]); assert.match(n.text, /Ada Lovelace/);
  assert.equal(carryNotice(followUp("Who is Grace Hopper?", thread, { referents, hints: EN })), null);
});

test("personMind projects through khora's perspective organ: refusals and what was shown, a typed gap when empty", () => {
  assert.equal(personMind({ messages: [] }).measured, false);
  const session = { minds: addOp(emptyMinds(), correctionOp("carry-rejected", "Ada Lovelace", 2)), messages: [
    { role: "user", content: "x" }, { role: "assistant", content: "y", grounding: { sources: [{ address: "https://a.example/1" }, { address: "https://a.example/1" }, { address: "https://b.example/2" }] } } ] };
  const p = personMind(session);
  assert.equal(p.measured, true);
  assert.deepEqual(p.refused, ["Ada Lovelace"]);
  assert.deepEqual(p.shown, ["https://a.example/1", "https://b.example/2"]);   // deduped: shown once
  assert.equal(mindLog(session).length, 3);
  assert.deepEqual(mindLog(session), mindLog(session));   // recomputed from the record, never cached: same content
});

test("the summary clause names only what the person refused", () => {
  assert.equal(mindsClause({ messages: [] }), "");
  assert.match(mindsClause({ minds: addOp(emptyMinds(), correctionOp("carry-rejected", "Ada Lovelace", 1)) }), /not to read their questions as being about Ada Lovelace/);
});

test("M3: a refusal lives on its own session; another session carries as before", () => {
  const a = { minds: addOp(emptyMinds(), correctionOp("carry-rejected", "Ada Lovelace", 1)) }, b = { minds: emptyMinds() };
  assert.deepEqual(rejectedSurfaces(a.minds), ["Ada Lovelace"]);
  assert.deepEqual(rejectedSurfaces(b.minds), []);
  assert.equal(followUp("what happened to her?", thread, { referents, hints: EN, rejected: rejectedSurfaces(b.minds) }).kind, "carried");
});
