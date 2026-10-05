// fold-chat-answer.test.mjs — the per-turn ANSWER MODE (Facing page | Sources only), same shape as effort.
import test from "node:test";
import assert from "node:assert/strict";
import { ANSWER_MODES, normAnswerMode, resolveAnswerMode, answerModeOfTurn } from "./fold-chat-answer.js";

test("two modes, facing first; unknown stored junk falls back (default: facing)", () => {
  assert.deepEqual(ANSWER_MODES.map((m) => m.key), ["facing", "snips"]);
  assert.deepEqual(ANSWER_MODES.map((m) => m.label), ["Facing page", "Sources only"]);
  assert.equal(normAnswerMode("snips"), "snips");
  for (const junk of [null, undefined, "", "deep", 3, {}]) assert.equal(normAnswerMode(junk), "facing");
  assert.equal(normAnswerMode("zzz", "snips"), "snips");
});

test("resolveAnswerMode: a re-run keeps the original turn's mode unless the chip was moved since", () => {
  assert.equal(resolveAnswerMode({ original: "snips", composer: "facing", changed: false }), "snips");
  assert.equal(resolveAnswerMode({ original: "snips", composer: "facing", changed: true }), "facing");
  assert.equal(resolveAnswerMode({ original: null, composer: "snips", changed: false }), "snips", "a fresh send takes the chip");
  assert.equal(resolveAnswerMode({}), "facing");
});

test("answerModeOfTurn: read off the ask, or the answer, or null for a turn that predates the control", () => {
  const msgs = [{ role: "user", content: "a", answerMode: "snips" }, { role: "assistant", content: "x" }, { role: "user", content: "b" }, { role: "assistant", content: "y", answerMode: "facing" }];
  assert.equal(answerModeOfTurn(msgs, 0), "snips");
  assert.equal(answerModeOfTurn(msgs, 1), "snips", "an answer takes its ask's mode");
  assert.equal(answerModeOfTurn(msgs, 2), "facing", "an ask takes its answer's mode");
  assert.equal(answerModeOfTurn(msgs, 3), "facing");
  assert.equal(answerModeOfTurn([{ role: "user", content: "old" }, { role: "assistant", content: "old" }], 1), null);
  assert.equal(answerModeOfTurn(msgs, 9), null);
});
