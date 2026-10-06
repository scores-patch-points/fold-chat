// fold-chat-self.test.mjs — the fold answers questions about itself, and does not LOOK UP an ask that has nothing to look up.
import test from "node:test";
import assert from "node:assert/strict";
import { selfAsk, lookupWarranted, SELF_LINE, NO_LOOKUP_LINE } from "./fold-chat-self.js";
import { classifyTurn } from "./fold-chat-discourse.js";
import { skipsSearch } from "./fold-chat-kinds.js";
import { aloneTurn } from "./fold-chat-gaps.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const FW = functionWordsOf("en");

test("asks addressed to the fold are self asks; asks that merely contain the words are not", () => {
  for (const q of ["who are you?", "Who are you", "what are you?", "what can you do?", "are you an AI?", "are you human", "who made you?", "what is your name?", "tell me about yourself", "introduce yourself", "what is the fold?"]) assert.equal(selfAsk(q), true, q);
  for (const q of ["Who Are You album by The Who", "who is the king of France?", "what is photosynthesis?", "who made the Eiffel Tower?", "are you sure the tower is 330 m tall?", "what can I do in Paris?", "", "x".repeat(200)]) assert.equal(selfAsk(q), false, q);
});

test("FALSIFIER (the real failure): 'who are you?' is no longer `research` — it is `self`, skips the search, and the app answers in its own words", () => {
  assert.equal(classifyTurn("who are you?"), "self");
  assert.equal(skipsSearch("self"), true);
  assert.deepEqual(aloneTurn("self"), { notice: { kind: "alone", text: SELF_LINE } });
  assert.equal(classifyTurn("who is the king of France?"), "research", "a real lookup is untouched");
  assert.equal(classifyTurn("who made the Eiffel Tower?"), "research");
  assert.match(SELF_LINE, /I don't answer from memory/);
  assert.ok(!/(sorry|here to listen|how can i help|feel free)/i.test(SELF_LINE), "none of the stock lines the Pivot withholds");
});

test("lookupWarranted: an ask made only of closed-class words has nothing to look up; one content word is enough; a thread-continuing ask is warranted", () => {
  assert.equal(lookupWarranted({ question: "who are you?", fw: FW }).warranted, false);
  assert.equal(lookupWarranted({ question: "what is it?", fw: FW }).warranted, false);
  assert.equal(lookupWarranted({ question: "tell me", fw: FW }).warranted, false, "a request frame names nothing");
  assert.equal(lookupWarranted({ question: "explain photosynthesis", fw: FW }).warranted, true, "...but the topic after it does");
  assert.equal(lookupWarranted({ question: "How tall is the Eiffel Tower?", fw: FW }).warranted, true);
  assert.equal(lookupWarranted({ question: "What is photosynthesis?", fw: FW }).warranted, true);
  assert.equal(lookupWarranted({ question: "Why was it built?", follow: { kind: "carried" }, fw: FW }).warranted, true, "a carried referent is the thing to look up");
  assert.equal(lookupWarranted({ question: "it?", follow: { kind: "elliptical" }, fw: FW }).warranted, true);
  assert.deepEqual(lookupWarranted({ question: "who are you?", fw: null }), { warranted: true, why: "no closed-class prior for this language: not judged", measured: false }, "no prior: today's behaviour stands, said, not guessed");
});

test("the no-lookup line is the fold's own and asks for something to look up", () => {
  assert.deepEqual(aloneTurn("nolookup"), { notice: { kind: "alone", text: NO_LOOKUP_LINE } });
  assert.match(NO_LOOKUP_LINE, /nothing in that for me to look up/i);
});
