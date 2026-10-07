// fold-chat-voice.test.mjs — stages 1–2 of the voice of content, with SYNTHETIC archons so every claim has a counterexample. The real-data run is eval/voice/run.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { VOICE, buildIndex, conversationTerms, resonance, quoteFrom, permitted, asideOf, frameOf } from "./fold-chat-voice.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { stemOf } from "./fold-chat-ground.js";

const FW = functionWordsOf("en");
// 12 archons, each with 24 PRIVATE terms; two terms (gentleness, humility) shared by archons 0 and 1; one term ("people") in every archon (so its idf is 0)
const priv = (k) => Array.from({ length: 24 }, (_, i) => `word${String.fromCharCode(97 + k)}${String.fromCharCode(97 + i)}${i}`);
const ARCH = Array.from({ length: 12 }, (_, k) => ({ handle: "a" + k, giver: `Author ${k} (dates)`, work: "Work " + k, source: { path: `canon/${k}.txt`, sha256: "h" + k, chars: 999 }, terms: [...priv(k), "people", ...(k < 2 ? ["gentleness", "humility", "forbearance"] : [])] }));
const TEXT0 = "The sage is full of gentleness and does not boast. In humility the sage yields, and so the sage endures. 12 14 16 18 20 22 24 26 28 30 32 34 36 38 40 42 44 46 48 50. A short one. Water is gentleness itself, and it carries humility to the lowest place where all people gather.";

test("buildIndex: document frequency across archons; a term in every archon has idf 0 and never counts", () => {
  const ix = buildIndex(ARCH, FW);
  assert.equal(ix.N, 12);
  assert.equal(ix.df.get("peopl") ?? ix.df.get("people"), 12);
  const conv = conversationTerms([{ ask: "How do people stay gentle with humility?", said: "" }], FW);
  const r = resonance(ix, conv, { draws: 50 });
  assert.ok(r.length >= 1 && !r[0].shared.some((s) => /^peopl/.test(s)), "'people' is shared by all and is not evidence");
});

test("resonance: distinctive shared stems beat the shuffle null; words that match no archon yield nothing", () => {
  const ix = buildIndex(ARCH, FW);
  const hit = conversationTerms([{ ask: "I want more gentleness and humility, and worda0 wordaa0 too", said: "" }], FW);
  const r = resonance(ix, hit);
  assert.ok(r.length && ["a0", "a1"].includes(r[0].handle), JSON.stringify(r[0]));
  assert.ok(r[0].shared.length >= 2);
  const miss = conversationTerms([{ ask: "How tall is the Eiffel Tower in Paris?", said: "It is 330 metres tall." }], FW);
  assert.deepEqual(resonance(ix, miss), [], "no stem in common with any archon");
});

test("FALSIFIER (noise): a conversation that shares ONE ordinary stem with many archons is not beyond the null", () => {
  const archons = Array.from({ length: 12 }, (_, k) => ({ ...ARCH[k], terms: [...priv(k), "patience", "virtue"] }));   // every archon holds the same two terms
  const ix = buildIndex(archons, FW);
  const conv = conversationTerms([{ ask: "patience and virtue matter", said: "" }], FW);
  assert.deepEqual(resonance(ix, conv), [], "terms every archon holds have idf 0: nothing distinguishes them");
});

test("quoteFrom: ONE verbatim sentence carrying >= 2 shared stems, inside the length bounds, never a table of numerals", () => {
  const q = quoteFrom(TEXT0, [stemOf("gentleness"), stemOf("humility")]);
  assert.ok(q);
  assert.equal(TEXT0.slice(q.start, q.end), q.text, "a verbatim slice, addressable");
  assert.match(q.text, /gentleness/); assert.match(q.text, /humility/);
  assert.ok(q.text.length >= VOICE.quoteMin && q.text.length <= VOICE.quoteMax);
  assert.ok(!/12 14 16/.test(q.text));
  assert.equal(quoteFrom(TEXT0, [stemOf("gentleness")]), null, "one stem is not a quote");
  assert.equal(quoteFrom("Gentleness. Humility.", [stemOf("gentleness"), stemOf("humility")]), null, "too short to be a sentence of the canon");
});

test("permitted: first exchange, spacing, repeat, kind and (when the gate is on) the real pathos condition", () => {
  assert.deepEqual(permitted({ kind: "advice", exchangeIndex: 1 }), { ok: false, why: "first_exchange" });
  assert.equal(permitted({ kind: "code", exchangeIndex: 3 }).why, "kind:code");
  assert.equal(permitted({ kind: "advice", exchangeIndex: 3, sinceLast: 2 }).why, "too_soon");
  assert.equal(permitted({ kind: "advice", exchangeIndex: 3, used: ["a0"], handle: "a0" }).why, "repeat_archon");
  assert.equal(permitted({ kind: "advice", exchangeIndex: 3, gate: true, condition: null }).why, "pathos_unread");
  assert.equal(permitted({ kind: "advice", exchangeIndex: 3, gate: true, condition: "ground_holds" }).why, "pathos:ground_holds");
  assert.deepEqual(permitted({ kind: "advice", exchangeIndex: 3, gate: true, condition: "contested" }), { ok: true, why: null });
  assert.deepEqual(permitted({ kind: "advice", exchangeIndex: 3 }), { ok: true, why: null });
});

test("asideOf: the whole decision, with every audit field; the frame wraps the quote and claims nothing else", () => {
  const ix = buildIndex(ARCH, FW);
  const conv = conversationTerms([{ ask: "I need more gentleness and humility and forbearance with my brother", said: "" }, { ask: "Why is it hard?", said: "" }], FW);
  const r = asideOf({ index: ix, conv, texts: { a0: TEXT0, a1: TEXT0 }, state: { kind: "advice", exchangeIndex: 2 } });
  assert.ok(r.aside, JSON.stringify(r.none));
  const a = r.aside;
  assert.equal(a.holder, "Author 0".replace("0", String(a.handle.slice(1))), "the giver, without its dates");
  assert.equal(TEXT0.slice(a.source.start, a.source.end), a.quote.text);
  assert.equal(a.source.sha256, "h" + a.handle.slice(1));
  assert.ok(a.p <= VOICE.alpha && a.shared.length >= 2 && a.grade === "canon");
  assert.match(a.text, /^This reminds me of something Author \d+ wrote about (gentleness|humility|forbearance): “/);
  assert.ok(a.text.includes(a.quote.text) && /I'm not sure it fits/.test(a.text));
  assert.equal(frameOf(a), a.text);
});

test("asideOf says WHY it is silent: not beyond null, no resonance, too soon, no canon text", () => {
  const ix = buildIndex(ARCH, FW);
  const conv = conversationTerms([{ ask: "gentleness and humility and forbearance", said: "" }], FW);
  assert.equal(asideOf({ index: ix, conv, texts: {}, state: { kind: "advice", exchangeIndex: 2 } }).none, "canon_not_loaded");
  assert.equal(asideOf({ index: ix, conv, texts: { a0: TEXT0, a1: TEXT0 }, state: { kind: "advice", exchangeIndex: 2, sinceLast: 1 } }).none, "too_soon");
  assert.equal(asideOf({ index: ix, conv: conversationTerms([{ ask: "How tall is the Eiffel Tower?" }], FW), texts: {}, state: {} }).none, "no_resonance");
});

test("the module reads no file, calls no network or model", () => {
  const src = fs.readFileSync(new URL("./fold-chat-voice.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(fetch|readFile|fs\.|callModel|client\.chat|localStorage|crypto)\b/.test(src));
});
