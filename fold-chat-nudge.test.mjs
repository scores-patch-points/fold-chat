// A bare nudge ("well?") after a turn that wrote nothing is that earlier ask again — never a web search for the word.
// Measured 2026-10-05 in the live app: "who is the president of the UK?" was stopped; "well?" then searched the literal word and
// answered with advertising copy and the article on water wells. Every test below names what would prove the fix wrong.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isNudge, unansweredAsk, turnPlan } from "./fold-chat-thread.js";
import { planTurn } from "./fold-chat-flow.js";
import { classifyTurn } from "./fold-chat-discourse.js";

const ASK = "who is the president of the UK?";
const STOPPED = [{ role: "user", content: ASK }, { role: "assistant", content: "", mode: "chat", notices: [{ kind: "stopped", text: "Stopped — no answer was written." }] }];
const ANSWERED = [{ role: "user", content: "what is the capital of France?" }, { role: "assistant", content: "Paris is the capital of France.", mode: "chat" }];

test("THE BUG: 'well?' after a stopped turn retries the stopped ask — it is not searched as a word", () => {
  for (const nudge of ["well?", "Well?", "so?", "and?", "any luck?", "hmm?", "anything?", "still there?"]) {
    const p = planTurn(nudge, STOPPED);
    assert.equal(p.mode, "web", nudge);
    assert.equal(p.search, ASK, `${nudge}: what is searched is the earlier ask`);
    assert.equal(p.retry, ASK);
    assert.equal(p.said, nudge, "the person's own words are never rewritten");
    assert.equal(p.kind, "retry");
  }
});

test("a stopped turn that left NO assistant message at all is still owed", () => {
  assert.equal(planTurn("well?", [{ role: "user", content: ASK }]).search, ASK);
});

test("the retry survives repeated nudges and repeated stops (it walks back over nudges and empty turns)", () => {
  const msgs = [...STOPPED, { role: "user", content: "well?" }, { role: "assistant", content: "", notices: [{ kind: "stopped" }] }, { role: "user", content: "so?" }, { role: "assistant", content: "" }];
  assert.equal(unansweredAsk(msgs), ASK);
  assert.equal(planTurn("well?", msgs).search, ASK);
});

test("FALSIFIER: it retries the NEWEST unanswered ask, never an older ask that was answered", () => {
  const msgs = [...ANSWERED, { role: "user", content: ASK }, { role: "assistant", content: "" }];
  assert.equal(planTurn("well?", msgs).search, ASK);
  // …and when the newest was answered, nothing is owed: the nudge is about THAT answer, with no search at all
  const done = [...STOPPED, { role: "user", content: "well?" }, { role: "assistant", content: "The UK has no president; the head of government is the Prime Minister.", mode: "chat" }];
  assert.equal(unansweredAsk(done), null);
  const p = planTurn("well?", done);
  assert.equal(p.mode, "thread"); assert.equal(p.search, null); assert.equal(p.retry, undefined);
});

test("FALSIFIER: a nudge after an ANSWER never goes to the web as a word — it is about the answer; with nothing earlier it is the cold gap", () => {
  for (const nudge of ["well?", "so?", "and?", "then?"]) {
    const p = planTurn(nudge, ANSWERED);
    assert.equal(p.mode, "thread", nudge); assert.equal(p.search, null, nudge); assert.equal(p.modelMay, true);
    assert.match(p.thread.answer, /Paris/);
    const cold = planTurn(nudge, []);
    assert.equal(cold.mode, "cold-gap", nudge); assert.equal(cold.search, null); assert.equal(cold.modelMay, false);
  }
});

test("FALSIFIER: a real question is never a nudge, whatever word it opens with", () => {
  for (const q of [
    "well, who won the 1998 world cup?", "so what is the capital of France?", "and what about Lyon?", "then who was king?", "what is a well?",
    "well water safety", "so you think it's Paris?", "anything about cats", "any good pasta recipes?", "continue the story about the dragon", "answer: Paris",
  ]) {
    assert.ok(!isNudge(q), q);
    const p = planTurn(q, STOPPED);
    assert.notEqual(p.kind, "retry", q);
    assert.notEqual(p.search, ASK, q + ": the stopped ask is not smuggled in");
  }
  // a stopped turn followed by a REAL new question searches the new question, not the stopped one
  assert.equal(planTurn("who is the prime minister of the UK?", STOPPED).search, "who is the prime minister of the UK?");
});

test("FALSIFIER: the Continue button's own 'Continue.' is not hijacked after an answer; after an unanswered ask it IS a retry", () => {
  for (const q of ["Continue.", "go on", "keep going"]) {
    const p = planTurn(q, ANSWERED);
    assert.equal(p.kind, "standalone", q + ": left on the old path, exactly as before this change");
    assert.equal(p.mode, "web", q); assert.equal(p.modelMay, false); assert.notEqual(p.reason, "nudge-with-thread");
  }
  assert.equal(planTurn("go on", STOPPED).search, ASK);
  assert.equal(planTurn("Continue.", STOPPED).search, ASK);
});

test("FALSIFIER: an unanswered ask in the AGENT lane is not retried as a chat web search", () => {
  const msgs = [{ role: "user", content: "build me a todo app" }, { role: "assistant", content: "", mode: "agent" }];
  assert.equal(unansweredAsk(msgs), null);
  assert.notEqual(planTurn("well?", msgs).kind, "retry");
  const msgs2 = [{ role: "user", content: "build me a todo app" }, { role: "assistant", content: "done", mode: "agent" }];
  assert.equal(unansweredAsk(msgs2), null);
});

test("existing follow-ups are untouched: 'what?' with nothing earlier is still the cold gap; a stopped turn does not make 'what?' a retry", () => {
  assert.equal(turnPlan("what?", STOPPED).mode, "cold-gap");
  assert.equal(turnPlan("why?", ANSWERED).mode, "thread");
  assert.equal(turnPlan("i want a chewier one", [{ role: "user", content: "show me a cookie recipe" }, { role: "assistant", content: "Brown butter cookies.", mode: "chat" }]).kind, "elliptical");
});

test("the retried ask is read as the ASK it is: classified research, not as the chat word 'well?'", () => {
  assert.equal(classifyTurn("well?"), "chat");
  assert.equal(classifyTurn(planTurn("well?", STOPPED).retry), "research");
});

test("WIRING: the live turn reads, classifies, searches and writes the retried ask — and keeps what the person said", () => {
  const src = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
  assert.match(src, /const question = follow\.retry \|\| said;/);
  assert.match(src, /classifyTurn\(question, \{ hasMaterial/);
  assert.doesNotMatch(src, /classifyTurn\(lastUserText\(s\)/, "the kind must be read from the retried ask, not the nudge");
  assert.match(src, /record\.followed = \{ kind: follow\.kind, said,/);
});

test("FALSIFIER: the citation under a thread answer names the ask the nudge picked back up, never the nudge itself", () => {
  const msgs = [...STOPPED, { role: "user", content: "well?" }, { role: "assistant", content: "The UK has no president; the Prime Minister leads the government.", mode: "chat" }];
  const p = planTurn("well?", msgs);
  assert.equal(p.mode, "thread");
  assert.equal(p.thread.ask, ASK);
  assert.equal(p.thread.askIndex, 0);
});
