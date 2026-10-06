// fold-chat-continue.test.mjs — a cut-off reply is recognised, handed back, and the pieces are joined without adding or changing a word.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CONTINUE, cutOff, continueMessages, joinDraft } from "./fold-chat-continue.js";
import { pivotText, verifyPivot } from "./fold-chat-pivot.js";

const words = (s) => String(s).toLocaleLowerCase("und").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];

test("cutOff: the stream's own finish_reason is the evidence; a model that STOPPED ended on purpose", () => {
  assert.deepEqual(cutOff({ finish: "length", text: "It was built for the 1889" }), { cut: true, why: "length" });
  assert.deepEqual(cutOff({ finish: "length", text: "A complete sentence." }), { cut: true, why: "length" }, "length wins even on a tidy tail");
  assert.equal(cutOff({ finish: "stop", text: "It ends without punctuation" }).cut, false, "finish stop = ended on purpose");
  assert.deepEqual(cutOff({ finish: null, text: "It was built for the" }), { cut: true, why: "unterminated" });
  assert.equal(cutOff({ finish: null, text: "It was built for the fair." }).cut, false);
  assert.equal(cutOff({ finish: null, text: "" }).cut, false);
  assert.equal(cutOff({ finish: "length", text: "   " }).cut, false, "nothing to continue");
});

test("continueMessages hands the model its own draft back and asks for the rest; the input list is not mutated", () => {
  const msgs = [{ role: "system", content: "s" }, { role: "user", content: "q" }];
  const out = continueMessages(msgs, "The tower is");
  assert.deepEqual(out.slice(0, 2), msgs);
  assert.deepEqual(out[2], { role: "assistant", content: "The tower is" });
  assert.equal(out[3].role, "user"); assert.equal(out[3].content, CONTINUE.prompt);
  assert.equal(msgs.length, 2);
});

test("joinDraft adds no word: the joined words are exactly prev's words then next's words", () => {
  const cases = [
    ["The tower was built for the", "1889 World's Fair in Paris."],
    ["It stands on the Champ de Mars.", "It was completed in 1889."],
    ["First paragraph ends here.", "\n\nSecond paragraph starts here."],
  ];
  for (const [a, b] of cases) {
    const j = joinDraft(a, b);
    assert.deepEqual(words(j.text), [...words(a), ...words(b)], JSON.stringify([a, b]));
  }
  assert.equal(joinDraft("First.", "\n\nSecond.").text, "First.\n\nSecond.");
});

test("joinDraft removes a REPEATED lead (>= 3 words that end prev and start next) and nothing else", () => {
  const j = joinDraft("The tower was built for the 1889 World's", "built for the 1889 World's Fair in Paris.");
  assert.equal(j.text, "The tower was built for the 1889 World's Fair in Paris.");
  assert.equal(j.overlap, 5);
  const shortRepeat = joinDraft("It is the", "the largest in Paris.");
  assert.equal(shortRepeat.overlap, 0, "a 1-word repeat is coincidence, not a repeated lead");
  assert.equal(shortRepeat.text, "It is the the largest in Paris.", "...and is left exactly as the model wrote it");
  assert.equal(joinDraft("Complete sentence here.", "Complete sentence here.").text, "Complete sentence here.", "a continuation that is ONLY a repeat adds nothing");
});

test("joinDraft is total: empty sides, whitespace and non-Latin text never throw and never lose a word", () => {
  assert.equal(joinDraft("", "next").text, "next");
  assert.equal(joinDraft("prev", "").text, "prev");
  assert.equal(joinDraft(null, undefined).text, "");
  const j = joinDraft("東京は日本の首都です。人口は", "約一千四百万人です。");
  assert.equal(j.text.replace(/\s+/g, ""), "東京は日本の首都です。人口は約一千四百万人です。");
});

test("FALSIFIER: a model that never stops being cut off is bounded by the caller's maxRounds, and the tail is then withheld by the Pivot, never completed", () => {
  assert.equal(CONTINUE.maxRounds, 2);
  let draft = "Honesty usually protects trust over time. It lets people rely on", rounds = 0;
  while (rounds < CONTINUE.maxRounds && cutOff({ finish: "length", text: draft }).cut) { draft = joinDraft(draft, "you in the long run and it matters more than").text; rounds++; }
  assert.equal(rounds, 2);
  const pv = pivotText({ draft, ask: "x" });
  assert.equal(verifyPivot(pv, draft).ok, true);
  assert.ok(pv.dropped.some((d) => d.why === "truncated"), "the dangling tail is withheld");
  assert.ok(!/matters more than$/.test(pv.text));
});

test("a continuation read by the Pivot: the joined draft is read once, so a withheld sentence in the SECOND answer is withheld too", () => {
  const first = "Honesty usually protects trust. It lets people rely on";
  const second = "you over time. I'm so sorry to hear that. Take the 40 offer.";
  const joined = joinDraft(first, second).text;
  const pv = pivotText({ draft: joined, ask: "x" });
  assert.equal(pv.text, "Honesty usually protects trust. It lets people rely on you over time.");
  assert.deepEqual(pv.dropped.map((d) => d.why), ["boilerplate", "number_not_given"]);
});

test("the module owns no model, network or storage", () => {
  const src = fs.readFileSync(new URL("./fold-chat-continue.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(fetch|XMLHttpRequest|callModel|client\.chat|localStorage)\b/.test(src));
});

test("the model's own seam marks are not text: a trailing ellipsis on prev and a leading one on next are dropped, the words are not", () => {
  const j = joinDraft("Photosynthesis converts light energy into the…", "... chemical energy necessary to fuel their metabolism.");
  assert.equal(j.text, "Photosynthesis converts light energy into the chemical energy necessary to fuel their metabolism.");
  assert.equal(joinDraft("It rose in 1889 and", "\u2026and then it stood.").text, "It rose in 1889 and and then it stood.", "a one-word repeat is left exactly as written");
  assert.equal(joinDraft("A real ellipsis... stays mid-sentence in prev.", "Next one.").text, "A real ellipsis... stays mid-sentence in prev. Next one.", "only a TRAILING ellipsis is a seam mark");
  const pv = pivotText({ draft: joinDraft("Photosynthesis converts light energy into the…", "... chemical energy necessary to fuel their metabolism.").text, ask: "x" });
  assert.equal(pv.stats.in, 1, "read as ONE sentence, so nothing is split or re-capitalised at the seam");
  assert.ok(!/\.\.\./.test(pv.text) && !/\sChemical/.test(pv.text));
});
