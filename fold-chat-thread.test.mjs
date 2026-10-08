// The conversation is a source: follow-ups resolve against the thread before any search (fold-chat-thread.js). Pure.
import test from "node:test";
import assert from "node:assert/strict";
import { isMeta, isElliptical, threadOf, topicOf, followUp, turnPlan, threadPrompt, threadNotice, coldFollowUpNotice, isConversationRef, referencedThread, missingAnswerNotice, addressesThread } from "./fold-chat-thread.js";
import { hintsFor } from "./fold-chat-hints.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";
import { looksBlocked } from "./fold-chat-web.js";
import { snipsOf } from "./fold-chat-strand.js";

const COOKIE_ASK = "Show me a good chocolate chip cookie recipe";
const cookieThread = [
  { role: "user", content: COOKIE_ASK },
  { role: "assistant", content: "Cream the butter and both sugars until light. Fold in the flour and chocolate chips, then bake at 350F for 11 minutes.", authored: "sources" },
];
const EN = hintsFor("en");

test("meta asks: a request about the previous answer, closed list, nothing else in the ask", () => {
  for (const q of ["what?", "What?", "why?", "huh", "explain that", "Can you explain that?", "shorter", "I don't get it", "what do you mean?", "simpler please".replace(" please", ""), "tl;dr", "which one?", "say that again", "Why is that?"]) assert.ok(isMeta(q), q);
  for (const q of ["what is a cookie", "why is the sky blue", "who founded Nashville", "explain quantum entanglement to me in detail please", "what time is it in Tokyo"]) assert.ok(!isMeta(q), q);
});

test("elliptical asks: short, no name of their own, leaning on the last topic", () => {
  for (const q of ["i want a chewier one", "something crispier", "make it spicier", "what about a vegan one", "another one", "less sweet"]) assert.ok(isElliptical(q), q);
  for (const q of ["Who founded Nashville?", "how do I tie a tie", "what is the capital of France", "tell me about the history of the Roman Empire and its fall", "hi"]) assert.ok(!isElliptical(q), q);
});

test("THE CHEWIER FAILURE: 'i want a chewier one' after a cookie recipe is searched WITH the cookie topic, not as a literal phrase", () => {
  const f = followUp("i want a chewier one", cookieThread, { hints: EN });
  assert.equal(f.kind, "elliptical");
  assert.equal(f.said, "i want a chewier one");                     // the person's words are never rewritten
  assert.equal(f.topic, "chocolate chip cookie recipe");
  assert.equal(f.query, "chewier chocolate chip cookie recipe");
  assert.match(f.query, /cookie/); assert.match(f.query, /chewier/);
  assert.equal(turnPlan("i want a chewier one", cookieThread, { hints: EN }).mode, "web");
});

test("a follow-up chain keeps the ORIGINAL topic (a follow-up is not itself a topic)", () => {
  const msgs = [...cookieThread, { role: "user", content: "i want a chewier one" }, { role: "assistant", content: "Use more brown sugar and an extra egg yolk for chew." }];
  assert.equal(followUp("and less sweet", msgs, { hints: EN }).query, "less sweet chocolate chip cookie recipe", "the own words (a comparative keeps its direction) + the topic");
  assert.equal(threadOf(msgs).topicAsk, COOKIE_ASK);
});

test("a standalone ask is searched as asked, even with a thread", () => {
  const f = followUp("Who founded the city of Nashville, and when?", cookieThread, { hints: EN });
  assert.equal(f.kind, "standalone"); assert.equal(f.query, f.said);
});

test("the pronoun path is resolveQuestion's: a trigger + a referent record carries; without a record nothing carries", () => {
  const rec = admitReferents(emptyReferents(), { question: "Who founded Nashville?", answer: "Nashville was founded in 1779 by James Robertson and John Donelson.", sources: [{ title: "Wikipedia — Nashville, Tennessee" }] });
  const f = followUp("what happened to him later in life?", [{ role: "user", content: "Who founded Nashville?" }, { role: "assistant", content: "Nashville was founded in 1779 by James Robertson." }], { referents: rec, hints: EN });
  assert.equal(f.kind, "carried");
  assert.ok(f.carried.length >= 1 && f.query.includes(f.carried[0]));
  assert.equal(f.said, "what happened to him later in life?");
});

test("meta WITH an earlier answer: no search, the model may reply from that turn alone, and the turn is cited", () => {
  const p = turnPlan("what?", cookieThread, { hints: EN });
  assert.equal(p.mode, "thread"); assert.equal(p.search, null); assert.equal(p.modelMay, true);
  assert.equal(p.thread.turn, 1); assert.equal(p.thread.ask, COOKIE_ASK);
  const pr = threadPrompt(p.thread);
  assert.match(pr, /Answer ONLY from the earlier turn/); assert.ok(pr.includes("Cream the butter"));
  const n = threadNotice(p.thread);
  assert.equal(n.kind, "thread"); assert.equal(n.turn, 1);
  assert.match(n.text, /^Answered from this conversation, turn 1 \(your question: “Show me a good chocolate chip cookie recipe”\)\./);
});

test("FALSIFIER: a cold 'what?' with an empty thread must NOT produce a model answer, and is not searched", () => {
  for (const msgs of [[], [{ role: "user", content: "hello" }], [{ role: "assistant", content: "", notices: [{ kind: "error", text: "x" }] }]]) {
    const p = turnPlan("what?", msgs, { hints: EN });
    assert.equal(p.mode, "cold-gap", JSON.stringify(msgs));
    assert.equal(p.modelMay, false); assert.equal(p.search, null);
  }
  assert.match(coldFollowUpNotice().text, /nothing earlier in this chat/); assert.equal(coldFollowUpNotice().kind, "alone");
});

test("an agent turn or a gap with no text is nothing to follow", () => {
  assert.equal(threadOf([{ role: "user", content: "x" }, { role: "assistant", content: "", mode: "chat", notices: [{ kind: "stopped" }] }]).has, false);
  assert.equal(threadOf([{ role: "user", content: "build x" }, { role: "assistant", content: "done", mode: "agent" }]).has, false);
});

test("topicOf keeps the nouns", () => {
  assert.equal(topicOf(COOKIE_ASK), "chocolate chip cookie recipe");
  assert.equal(topicOf("What is the best way to learn the guitar?"), "learn guitar");
});

// ── #1: a request about the conversation's OWN earlier answers is a follow-up, not a literal search ──
const FOUR = [
  { role: "user", content: "Who founded Nashville?" }, { role: "assistant", content: "James Robertson and John Donelson founded Nashville in 1779." },
  { role: "user", content: "What is the population?" }, { role: "assistant", content: "Nashville's population is about 700,000." },
  { role: "user", content: "Who is the mayor?" }, { role: "assistant", content: "The mayor is Freddie O'Connell." },
  { role: "user", content: "What about the council?" }, { role: "assistant", content: "The Metro Council has 40 members." },
];

test("isConversationRef: asks about the conversation's own answers, not a fresh comparison", () => {
  for (const q of [
    "compare what you said in your first answer",
    "In your second answer, quote the exact sentence you relied on and name its source.",
    "combine your four answers into one paragraph, then list the parts that are not grounded",
    "quote the exact sentence you relied on",
    "summarize your last response",
    "You just gave a rule. Does the same rule cover the Audit Committee?",
    "In your last answer, which museum is it in?",
  ]) assert.ok(isConversationRef(q), q);
  for (const q of [
    "compare the French and American revolutions",
    "summarize the article about the Roman Empire",
    "What is the capital of France?",
    "Who founded the city of Nashville, and when?",
    "list the parts of a cell",
    "Compare the answers of Plato and Aristotle about justice.",
  ]) assert.ok(!isConversationRef(q), q);
});

test("a conversation-reference follow-up is planned as a THREAD turn (no search), grounded in the answers it names", () => {
  const p = turnPlan("compare what you said in your first answer with your last", FOUR);
  assert.equal(p.mode, "thread"); assert.equal(p.search, null); assert.equal(p.modelMay, true); assert.equal(p.kind, "conversation-ref");
  assert.equal(p.thread.has, true); assert.equal(p.thread.answers.length, 2);
  assert.deepEqual(p.thread.answers.map((a) => a.turn), [1, 4]);
  const pr = threadPrompt(p.thread);
  assert.match(pr, /Answer ONLY from the earlier turn/); assert.ok(pr.includes("James Robertson")); assert.ok(pr.includes("40 members"));

  const all = turnPlan("combine your four answers into one paragraph", FOUR);
  assert.equal(all.mode, "thread"); assert.equal(all.thread.answers.length, 4);
  assert.ok(all.thread.answer.includes("James Robertson") && all.thread.answer.includes("Freddie O'Connell"));

  const second = turnPlan("quote the exact sentence you relied on in your second answer", FOUR);
  assert.equal(second.mode, "thread"); assert.equal(second.thread.answers.length, 1); assert.equal(second.thread.turn, 2);
  assert.ok(second.thread.answer.includes("700,000"));
});

test("FALSIFIER: a fresh comparison names its own entities, so it is still searched as asked", () => {
  assert.equal(turnPlan("compare the French and American revolutions", FOUR).mode, "web");
  assert.equal(followUp("compare the French and American revolutions", FOUR, { hints: EN }).kind, "standalone");
  // with nothing earlier to refer to, it falls through to the normal plan (a first-turn ask still searches)
  assert.equal(turnPlan("combine your four answers", []).mode, "web");
});

test("FALSIFY (long-chat trap 1): a WORLD question that merely says 'compare the answers of X and Y' is NOT hijacked to the thread", () => {
  assert.equal(isConversationRef("Compare the answers of Plato and Aristotle about justice."), false);
  assert.equal(turnPlan("Compare the answers of Plato and Aristotle about justice.", FOUR).mode, "web");
});

test("FALSIFY (long-chat trap 2): an ordinal with no such answer is a typed gap, not a silent carry of the wrong turns", () => {
  const p = turnPlan("Quote your ninth answer.", FOUR);
  assert.equal(p.mode, "cold-gap"); assert.equal(p.modelMay, false); assert.equal(p.search, null);
  assert.equal(p.missing.missingAt, 9); assert.equal(p.missing.count, 4);
  assert.match(missingAnswerNotice(p.missing).text, /only 4 answers.*no 9 answer/);
  assert.equal(turnPlan("Quote your second answer.", FOUR).thread.turn, 2);   // a real ordinal still carries the right turn
});

test("FALSIFY (long-chat trap 3): a 'first three' / 'last two' range carries exactly those turns", () => {
  const first3 = turnPlan("List the first three questions I asked you.", FOUR);
  assert.equal(first3.mode, "thread"); assert.deepEqual(first3.thread.answers.map((a) => a.turn), [1, 2, 3]);
  const last2 = turnPlan("Compare the last two of your answers.", FOUR);
  assert.equal(last2.mode, "thread"); assert.deepEqual(last2.thread.answers.map((a) => a.turn), [3, 4]);
});

test("threadNotice names every referenced turn for a multi-answer follow-up", () => {
  const n = threadNotice(turnPlan("combine your four answers", FOUR).thread);
  assert.equal(n.kind, "thread");
  assert.match(n.text, /^Answered from this conversation, your earlier answers \(turns 1, 2, 3, 4\)\./);
  assert.match(n.text, /from those earlier turns alone\./);
});

test("THE ANSWER GATE: a reply grounded in a NAMED earlier answer must TALK ABOUT it, not just be supported", () => {
  const second = referencedThread(FOUR, "Quote the exact sentence you relied on in your second answer.");
  assert.deepEqual(second.answers.map((a) => a.turn), [2]);
  // the wrong-TURN reply (about turn 4) does not address the referenced turn 2 — this is the T5 falsification
  assert.equal(addressesThread("The Eiffel Tower opened on March 31, 1889.", second).ok, false);
  // a reply about the referenced turn does
  assert.equal(addressesThread("Nashville's population is about 700,000.", second).ok, true);
  // meta-nonsense against a multi-answer thread does not address it — the T13/T14 falsification
  const all = referencedThread(FOUR, "combine your four answers into one paragraph");
  assert.equal(addressesThread("Compare what you said in your first answer with what you said in your third answer.", all).ok, false);
  // a real synthesis does
  assert.equal(addressesThread("Nashville was founded in 1779 and its population is about 700,000.", all).ok, true);
  // an empty/wordless reply is not a relevance failure (nothing to judge)
  assert.equal(addressesThread("", all).ok, true);
});

test("a bot-challenge page is blocked, not an answer; a blocked passage is never quoted as a snip", () => {
  for (const t of ["Complete the challenge below to continue.", "Please verify you are human before continuing", "Checking your browser before accessing the site", "Attention Required! | Cloudflare", "Are you a robot?", "Just a moment..."]) assert.ok(looksBlocked(t), t);
  assert.ok(!looksBlocked("Cream the butter and sugar. ".repeat(10)));
  const blocked = { ref: "x.example — Cookies", source: "https://x.example/c", url: "https://x.example/c", text: "Complete the challenge below to prove you are not a bot. This helps us keep the site safe for everyone who visits." };
  const good = { ref: "y.example — Chewy cookies", source: "https://y.example/c", url: "https://y.example/c", text: "Chewy chocolate chip cookies use more brown sugar than white sugar and an extra egg yolk for a soft, chewy centre that stays moist for days." };
  const { snips } = snipsOf([blocked, good], "chewier chocolate chip cookie recipe");
  assert.ok(snips.length >= 1 && snips.every((s) => !/challenge/i.test(s.text)), JSON.stringify(snips.map((s) => s.text.slice(0, 40))));
  assert.equal(snipsOf([blocked], "x").snips.length, 0);
});
