import test from "node:test";
import assert from "node:assert/strict";
import { recallAsk, recallOf } from "./fold-chat-recall.js";
import { claimsOfTurn, appendClaims } from "./fold-chat-record.js";

const said = (turn, ...texts) => claimsOfTurn({ turn, pivot: { units: texts.map((t) => ({ kind: "sentence", text: t })) } });
const store = appendClaims(appendClaims([], said(1, "The Eiffel Tower is 330 metres tall.", "It opened in 1889.")), said(2, "Photosynthesis turns light into sugar."));

test("what the fold said before is asked in English, DECLARED; a lookup is not", () => {
  for (const q of ["What did you tell me earlier?", "what did you say?", "Can you repeat that?", "repeat what you just said", "What was your last answer?"]) assert.ok(recallAsk(q), q);
  assert.equal(recallAsk("What did you tell me about the Eiffel Tower?").about, "the Eiffel Tower");
  for (const q of ["What did Napoleon say about Egypt?", "Who built the Eiffel Tower?", "What did you eat?", ""]) assert.equal(recallAsk(q), null, q);
});

test("a bare repeat reads the LAST turn's claims from the store, verbatim, at their address", () => {
  const r = recallOf({ question: "What did you tell me earlier?", claims: store });
  assert.equal(r.turn, 2); assert.equal(r.address, "/t2");
  assert.equal(r.text, "On turn 2 I said: Photosynthesis turns light into sugar.");
});

test("'about X' finds the latest turn that said something bearing on X, not simply the last", () => {
  const r = recallOf({ question: "what did you tell me about the Eiffel Tower", claims: store });
  assert.equal(r.turn, 1);
  assert.equal(r.claims.length, 2);
  assert.match(r.text, /330 metres tall\. It opened in 1889\.$/);
});

test("nothing stored, or nothing bearing on X: null — never answered from a guess", () => {
  assert.equal(recallOf({ question: "what did you tell me earlier?", claims: [] }), null);
  assert.equal(recallOf({ question: "what did you tell me about Napoleon", claims: store }), null);
  assert.equal(recallOf({ question: "Who built it?", claims: store }), null);
});
