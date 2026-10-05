// fold-chat-discourse.test.mjs — the discourse classifier: the lesson that a
// "write …" turn is a generation request (write it now), not a lookup to be
// searched and quizzed, and that a greeting is neither searched nor grounded.

import test from "node:test";
import assert from "node:assert/strict";
import { classifyTurn, checkable, recordable, wantsWeb, GENERATE_NUDGE, generationArtifact } from "./fold-chat-discourse.js";

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

test("a bare conversational continuation is chat, never a research lookup", () => {
  for (const q of ["well?", "well", "so?", "and?", "go on", "continue", "right?", "really?", "hmm", "got it"]) {
    assert.equal(classifyTurn(q), "chat", q);
  }
});

test("the continuation rule is narrow — real questions stay research", () => {
  for (const q of ["why?", "who is the president?", "what is a closure?", "how many people live there?"]) {
    assert.equal(classifyTurn(q), "research", q);
  }
  // A continuation that opens a longer turn is not swallowed by the marker.
  assert.equal(classifyTurn("well, who is the president?"), "research");
});

test("every turn but a greeting carries a grounding record (always grounded)", () => {
  assert.equal(recordable("research"), true);
  assert.equal(recordable("chat"), true);
  assert.equal(recordable("generate"), true, "a writing request grounds too — it writes from what it read");
  assert.equal(recordable("smalltalk"), false, "a greeting is not a claim");
});

test("only turns with CLAIMS are checked — a poem or essay has none (no void, no unsourced marks)", () => {
  assert.equal(checkable("research"), true);
  assert.equal(checkable("chat"), true);
  assert.equal(checkable("generate"), false, "a writing request has no claim to score, however it was searched");
  assert.equal(checkable("smalltalk"), false);
  assert.equal(classifyTurn("write a short poem about autumn in Nashville"), "generate");
  assert.equal(checkable(classifyTurn("write a short poem about autumn in Nashville")), false);
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

test("a prose artifact ask routes to penelope's generation; html/app keeps the fold's build", () => {
  assert.equal(generationArtifact("write an essay about dolphins"), "text");
  assert.equal(generationArtifact("compose a report on the audit"), "text");
  assert.equal(generationArtifact("draft a blog post"), "text");
  assert.equal(generationArtifact("create a landing page"), null, "penelope has no html adapter — the fold's own build keeps it");
  assert.equal(generationArtifact("hi"), null);
});

test("a demand for proof or a comparison is research, so it searches", () => {
  // "prove it" after a claim, and a multi-entity comparison with no wh-word:
  // both seek facts and must route to research (and thus web search when on).
  assert.equal(classifyTurn("prove it"), "research");
  assert.equal(classifyTurn("cite this"), "research");
  assert.equal(classifyTurn("source?"), "research");
  assert.equal(classifyTurn("Compare the founding dates and first leaders of Canberra, Brasília, Ottawa, and Washington, D.C."), "research");
  assert.equal(wantsWeb(classifyTurn("prove it"), true), true, "a proof demand searches when web is on");
  // A "write a comparison" is still a writing turn, never a lookup.
  assert.equal(classifyTurn("write a comparison of the two reports"), "generate");
  // A greeting is still smalltalk; a bare nudge is still chat.
  assert.equal(classifyTurn("hi"), "smalltalk");
  assert.equal(classifyTurn("well?"), "chat");
});