// fold-chat-histkind.test.mjs — a creative exchange does not ride back as conversation for a factual turn (G3). Run: node --test fold-chat-histkind.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { styleSafeMessages, MARKER, CREATIVE_KINDS } from "./fold-chat-histkind.js";
import { modelHistory } from "./fold-chat-channels.js";
import { classifyTurn } from "./fold-chat-discourse.js";

const classify = (q) => classifyTurn(q, {});
const SONG = "write me a song about trampolines";
const LYRICS = "Sun's out, sky's blue, a perfect day\nJump, jump, jump, up and high";
const Q = "who is mt. mckinlet named afer?";
const content = (arr) => arr.map((m) => m.content);

test("THE REPRODUCTION: the song ask rode back although its (empty) reply did not; now one plain line stands for it", () => {
  const msgs = [{ role: "user", content: SONG }, { role: "assistant", content: "", grounding: { kind: "generate" } }, { role: "user", content: Q }];
  assert.deepEqual(content(modelHistory(msgs)), [SONG, Q], "before: the song request is in the model's history");
  const safe = modelHistory(styleSafeMessages(msgs, { kind: "research", classify }));
  assert.deepEqual(content(safe), [MARKER, Q]);
  assert.ok(!safe.some((m) => /song|trampoline/i.test(m.content)), "neither the ask nor its topic remains");
});

test("a song that WAS written never rides back to a factual turn: its lyrics are not in the history", () => {
  const msgs = [{ role: "user", content: SONG }, { role: "assistant", content: LYRICS, grounding: { kind: "generate" } }, { role: "user", content: Q }];
  const safe = modelHistory(styleSafeMessages(msgs, { kind: "research", classify }));
  assert.deepEqual(content(safe), [MARKER, Q]);
  assert.ok(!safe.some((m) => /Jump|Sun's/.test(m.content)));
});

test("factual history is untouched; a creative turn keeps its own history; the input is never mutated", () => {
  const facts = [{ role: "user", content: "who was Marie Curie?" }, { role: "assistant", content: "A physicist." }, { role: "user", content: "and her husband?" }];
  assert.deepEqual(styleSafeMessages(facts, { kind: "research", classify }), facts);
  const song = [{ role: "user", content: SONG }, { role: "assistant", content: LYRICS, grounding: { kind: "generate" } }, { role: "user", content: "write another one about springs" }];
  assert.deepEqual(styleSafeMessages(song, { kind: "generate", classify }), song, "the person is still writing");
  const snap = JSON.stringify(song); styleSafeMessages(song, { kind: "research", classify }); assert.equal(JSON.stringify(song), snap);
  for (const k of CREATIVE_KINDS) assert.deepEqual(styleSafeMessages(song, { kind: k, classify }), song);
});

test("an ask that leans on the last exchange keeps it verbatim (the person is talking about the piece); older creative exchanges still become the marker", () => {
  const msgs = [{ role: "user", content: SONG }, { role: "assistant", content: LYRICS, grounding: { kind: "generate" } }, { role: "user", content: "what is the capital of France?" }, { role: "assistant", content: "Paris." }, { role: "user", content: "write me a poem about rain" }, { role: "assistant", content: "Rain falls\nSoft and slow", grounding: { kind: "generate" } }, { role: "user", content: "who is it about" }];
  const safe = styleSafeMessages(msgs, { kind: "chat", classify, leansOnLast: true });
  assert.deepEqual(content(safe), [MARKER, "what is the capital of France?", "Paris.", "write me a poem about rain", "Rain falls\nSoft and slow", "who is it about"]);
  const not = styleSafeMessages(msgs, { kind: "research", classify, leansOnLast: false });
  assert.deepEqual(content(not), [MARKER, "what is the capital of France?", "Paris.", MARKER, "who is it about"]);
});

test("consecutive creative exchanges collapse into one marker; mode 'drop' removes them", () => {
  const msgs = [{ role: "user", content: SONG }, { role: "assistant", content: LYRICS, grounding: { kind: "generate" } }, { role: "user", content: "write me a poem about rain" }, { role: "assistant", content: "Rain falls", grounding: { kind: "generate" } }, { role: "user", content: Q }];
  assert.deepEqual(content(styleSafeMessages(msgs, { kind: "research", classify })), [MARKER, Q]);
  assert.deepEqual(content(styleSafeMessages(msgs, { kind: "research", classify, mode: "drop" })), [Q]);
});

test("a creative exchange is recognised by its ask (the reply may be empty) OR by its reply's mark (the ask may be oddly worded)", () => {
  const byAsk = [{ role: "user", content: "compose a haiku about snow" }, { role: "assistant", content: "" }, { role: "user", content: Q }];
  assert.deepEqual(content(styleSafeMessages(byAsk, { kind: "research", classify })), [MARKER, Q]);
  const byReply = [{ role: "user", content: "something fun about cats" }, { role: "assistant", content: "Cats leap\nand land", grounding: { creative: true } }, { role: "user", content: Q }];
  assert.deepEqual(content(styleSafeMessages(byReply, { kind: "research", classify })), [MARKER, Q]);
  assert.equal(classify("something fun about cats") === "generate", false);
});

test("the marker states a fact about the chat and gives no instruction (the door's information-not-prohibition rule)", () => {
  assert.ok(!/\b(?:do not|don't|never|must|should|avoid|stop)\b/i.test(MARKER));
  assert.ok(!/\b(?:song|poem|lyrics|trampoline)\b/i.test(MARKER), "it carries no subject matter the model could continue");
});

test("the pending ask is never touched, even one that reads as a writing request when the turn's own kind was decided otherwise", () => {
  const msgs = [{ role: "user", content: "hello" }, { role: "assistant", content: "Hi." }, { role: "user", content: SONG }];
  assert.deepEqual(styleSafeMessages(msgs, { kind: "research", classify }), msgs);
});

test("Gary's door reads the marker inside a real turn and has no finding", async () => {
  const { door } = await import("./fold-chat-gary.js");
  const r = door.hand([{ role: "system", content: "You answer from sources." }, { role: "user", content: MARKER }, { role: "user", content: Q }], { kind: "turn", record: false });
  assert.deepEqual(r.findings, []);
});
