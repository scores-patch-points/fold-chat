// fold-chat-discourse.test.mjs — the discourse classifier: the lesson that a
// "write …" turn is a generation request (write it now), not a lookup to be
// searched and quizzed, and that a greeting is neither searched nor grounded.

import test from "node:test";
import assert from "node:assert/strict";
import { classifyTurn, checkable, wantsWeb, GENERATE_NUDGE } from "./fold-chat-discourse.js";

test("greetings classify as smalltalk", () => {
  for (const q of ["hi", "hey", "Hello", "good morning", "how are you", "thanks!", "bye"]) {
    assert.equal(classifyTurn(q), "smalltalk", q);
  }
});

test("a write request is a GENERATION turn, never a research turn", () => {
  for (const q of [
    "write an essay about dolphins",
    "write about the potential extinction of dolphins",
    "compose a poem about the sea",
    "draft a short story",
    "create a landing page",
    "make me an outline for a talk",
    "write a report on the audit",
  ]) {
    assert.equal(classifyTurn(q), "generate", q);
  }
});

test("a question of fact is a research turn", () => {
  for (const q of [
    "who is the president?",
    "when was the Office created",
    "what is a closure",
    "how many people live there",
    "tell me about the Marden Act",
  ]) {
    assert.equal(classifyTurn(q), "research", q);
  }
});

test("a bare statement is chat", () => {
  assert.equal(classifyTurn("their extinction"), "chat");
  assert.equal(classifyTurn("ok"), "chat");
});

test("only research/chat turns may carry a grounding disclosure", () => {
  assert.equal(checkable("research"), true);
  assert.equal(checkable("chat"), true);
  assert.equal(checkable("generate"), false);
  assert.equal(checkable("smalltalk"), false);
});

test("web search runs only for a research turn with web on", () => {
  assert.equal(wantsWeb("research", true), true);
  assert.equal(wantsWeb("generate", true), false, "a write request is never front-loaded with a search");
  assert.equal(wantsWeb("smalltalk", true), false);
  assert.equal(wantsWeb("chat", true), false);
  assert.equal(wantsWeb("research", false), false);
});

test("the generate nudge tells the fold to write it now, not interview", () => {
  assert.match(GENERATE_NUDGE, /Write it now/);
  assert.match(GENERATE_NUDGE, /Do not ask them what topics/);
});