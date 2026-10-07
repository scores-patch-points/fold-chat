// fold-chat-voices.test.mjs — the display is a CLAIM that is checked, never believed. Every falsifier hands the verifier a lie. (pre-registered: eval/ants/C2-PREREG.md)
// VOICES_MODULE=fold-chat-voices.mut.js runs the same tests against a mutated copy (eval/ants/c2/c2-mutate.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { functionWordsOf } from "./fold-chat-snippets.js";

const M = await import(process.env.VOICES_MODULE ? "./" + process.env.VOICES_MODULE : "./fold-chat-voices.js");
const { voicesFor, findVoice, verifyVoices, renderText, shortGiver, frameFor, sectionAt, thinkerTable, lineFor, TEMPLATES, VOICES } = M;
const FW = functionWordsOf("en");

// hard-wrapped scans, as the real canon files are
const MOZI = `THE WORKS OF MOTSE

BOOK IV

Heaven loves the people without partiality, and God rewards
the virtuous ruler with long life and a peaceful state.

God hates the ruler who attacks the small states; the spirits punish
him with disaster and the people forsake him.

There is no God that has ever been seen by the people, says the doubter, and the sage replies at length.

Is it true that God punishes the wicked rulers of every age?

God sent down fire upon 300 men of the ruler of the small states.

See the notes about God and the spirits.

The farmer sows the grain in the spring and reaps the harvest in the autumn of the year.
`;
const RAMA = `THE GOSPEL

CHAPTER THE FIRST

The Master said that God is within every being, and that the devotee who weeps for God will find him at last in the heart.

The grain of the mustard seed is small but the tree that grows from it shelters the birds of the air.

A ruler who is good will protect his people from the enemies of the state, said the visitor.
`;
const ZETA = `Of enemies and friends it is said that the wise ruler treats his enemies with mercy and does not hate them in his heart.

The merchants of the city treated the visitors kindly and the enemies of the city were driven away at dawn.

An enemy is a man who has wronged you and a friend is a man who has helped you in the days of need.
`;
const YOGA = `The ruler good and kind keeps the people from every harm and teaches them the duties of the whole year in plain words.\n`;
const T = (handle, giver, work, sha) => ({ handle, giver, work, source: { path: `x/${handle}.txt`, sha256: sha } });
const THINKERS = {
  mozi: T("mozi", "Mozi (Mo Tzu)", "The Works of Motse", "aa"),
  ramakrishna: T("ramakrishna", "Sri Ramakrishna (Gadadhar, 1836–1886), recorded by M", "The Gospel", "bb"),
  zeta: T("zeta", "Zeta of Nowhere (1900-1950), who wrote Enemies", "Zeta's Book", "cc"),
  vyasa: T("vasana", "Vyasa", "Yoga", "dd"),
  a: T("a", "Ada", "A", "a1"), b: T("b", "Beta", "B", "b1"), c: T("c", "Cora", "C", "c1"), d: T("d", "Dora", "D", "d1"),
};
const TEXTS = { mozi: MOZI, ramakrishna: RAMA, zeta: ZETA, vasana: YOGA, a: MOZI, b: MOZI, c: MOZI, d: MOZI };
const canonOf = (handle) => (TEXTS[handle] ? { text: TEXTS[handle], sha256: THINKERS[handle]?.source.sha256 } : null);
const run = (question, handles, over = {}) => voicesFor({ question, candidates: handles.map((h) => ({ handle: h })), thinkers: THINKERS, canonOf, fw: FW, ...over });
const Q = "Is there a God?";

test("a voice is the canon's own sentence: the quote IS canon.slice(start,end), whole, with an address", () => {
  const r = run(Q, ["mozi"]);
  assert.equal(r.voices.length, 1);
  const v = r.voices[0];
  assert.equal(MOZI.slice(v.source.start, v.source.end), v.quote);
  assert.match(v.quote, /God/);
  assert.equal(v.source.sha256, "aa");
  assert.equal(v.source.work, "The Works of Motse");
  assert.equal(v.source.section, "BOOK IV");
  assert.equal(r.calls, 0);
  assert.ok(verifyVoices({ result: r, thinkers: THINKERS, canonOf }).ok);
});

test("no model, no network: nothing in the module can reach one (a poisoned fetch is never touched)", () => {
  const f = globalThis.fetch; let touched = 0;
  globalThis.fetch = () => { touched++; throw new Error("network"); };
  try { run(Q, ["mozi", "ramakrishna"]); } finally { globalThis.fetch = f; }
  assert.equal(touched, 0);
  assert.equal(voicesFor.length <= 1, true);                    // one destructured argument: there is no model parameter to inject
});

test("two voices: the line says several, names nobody; alphabetical whatever B1's order", () => {
  const a = run(Q, ["ramakrishna", "mozi"]), b = run(Q, ["mozi", "ramakrishna"]);
  for (const r of [a, b]) {
    assert.deepEqual(r.voices.map((v) => v.giver), ["Mozi", "Sri Ramakrishna"]);
    assert.equal(r.line, TEMPLATES.several());
    assert.match(r.line, /^Several voices bear on this/);
    assert.doesNotMatch(r.line, /Mozi|Ramakrishna|best|most|winner/i);
  }
});

test("one voice says one; no voice says nothing and shows nothing", () => {
  assert.match(run(Q, ["mozi"]).line, /^One voice bears on this/);
  const none = run("What is the boiling point of water?", ["mozi", "ramakrishna"]);
  assert.deepEqual(none.voices, []); assert.equal(none.line, ""); assert.equal(none.why, "no_passage_bears_on_the_question");
  assert.equal(renderText(none), "");
});

test("at most 3 voices, and the first three candidates that have a sentence", () => {
  const r = run(Q, ["a", "b", "c", "d", "mozi"]);
  assert.equal(r.voices.length, 3);
  assert.deepEqual(r.voices.map((v) => v.handle).sort(), ["a", "b", "c"]);
  assert.equal(r.considered.length, 3);
});

test("STRICT: all of a two-stem question's stems; LOOSE (comparison arm) accepts a sentence with one", () => {
  const q = "Justice and mercy?";
  const canon = { text: "The judges of the small states hold that justice will protect the people in all the years of the age.", sha256: "cc" };
  const strict = findVoice({ question: q, thinker: THINKERS.zeta, canon, fw: FW });
  assert.equal(strict.none, true);
  const loose = findVoice({ question: q, thinker: THINKERS.zeta, canon, fw: FW, limits: { strict: false } });
  assert.match(loose.quote, /^The judges of the small states hold that justice/);
  const both = { text: "The judges of the small states hold that justice and mercy will protect the people in all the years of the age.", sha256: "cc" };
  assert.match(findVoice({ question: q, thinker: THINKERS.zeta, canon: both, fw: FW }).quote, /justice and mercy/);
});

test("the strict rule picks the sentence carrying BOTH stems over one carrying a single stem", () => {
  const r = findVoice({ question: "How should I treat my enemies?", thinker: THINKERS.zeta, canon: canonOf("zeta"), fw: FW });
  assert.match(r.quote, /treat/); assert.match(r.quote, /enem/);
});

test("the shared relevance floor holds a figure: a question's number must be in the sentence", () => {
  const withFig = findVoice({ question: "God and fire 300 men?", thinker: THINKERS.mozi, canon: canonOf("mozi"), fw: FW });
  assert.match(withFig.quote, /fire upon 300 men/);
  const without = findVoice({ question: "God and fire 250 men?", thinker: THINKERS.mozi, canon: canonOf("mozi"), fw: FW });
  assert.equal(without.none, true);
});

test("sentence filters: a question, an index-like run of digits, a lowercase fragment and a thin sentence are never a voice", () => {
  const canon = (t) => ({ text: t, sha256: "aa" });
  const q = "What about God and the ruler?";
  for (const t of [
    "Is it true that God punishes the wicked rulers of every age?",
    "God sent down fire upon the ruler in 1998 and 19991234 in the old records of the state.",
    "and so God rewards the ruler of the small states, the people say in the old tales.",
    "See God and ruler.",
  ]) assert.equal(findVoice({ question: q, thinker: THINKERS.mozi, canon: canon(t), fw: FW }).none, true, t);
});

test("an unverified canon is refused: wrong hash, no hash, no canon", () => {
  assert.equal(findVoice({ question: Q, thinker: THINKERS.mozi, canon: { text: MOZI, sha256: "zz" }, fw: FW }).why, "canon_not_the_verified_file");
  assert.equal(findVoice({ question: Q, thinker: THINKERS.mozi, canon: { text: MOZI }, fw: FW }).why, "canon_not_the_verified_file");
  assert.equal(findVoice({ question: Q, thinker: { ...THINKERS.mozi, source: { path: "p" } }, canon: { text: MOZI }, fw: FW }).why, "no_verified_source");
  assert.equal(findVoice({ question: Q, thinker: THINKERS.mozi, canon: null, fw: FW }).none, true);
  const r = voicesFor({ question: Q, candidates: [{ handle: "mozi" }], thinkers: THINKERS, canonOf: () => ({ text: MOZI, sha256: "tampered" }), fw: FW });
  assert.deepEqual(r.voices, []);
});

test("only the profile's thinkers; a throwing canon reader is a typed gap, not a crash; a candidate twice is heard once", () => {
  const r = voicesFor({ question: Q, candidates: [{ handle: "nobody" }, { handle: "mozi" }, { handle: "mozi" }, { handle: "ramakrishna" }], thinkers: THINKERS, canonOf: (h) => { if (h === "ramakrishna") throw new Error("disk"); return canonOf(h); }, fw: FW });
  assert.deepEqual(r.voices.map((v) => v.handle), ["mozi"]);
  assert.deepEqual(r.considered.map((c) => c.why || "ok"), ["not_a_speaking_thinker_of_the_profile", "ok", "canon_unreadable"]);
  assert.deepEqual(voicesFor({ question: Q, candidates: null, thinkers: THINKERS, canonOf }).voices, []);
});

test("short giver names, no dates or parentheses; the frame says wrote only for the thinker's own canon", () => {
  assert.equal(shortGiver(THINKERS.mozi), "Mozi");
  assert.equal(shortGiver(THINKERS.ramakrishna), "Sri Ramakrishna");
  assert.equal(shortGiver(THINKERS.zeta), "Zeta of Nowhere");
  assert.equal(frameFor(THINKERS.mozi), "Here is what Mozi wrote that bears on this:");
  assert.equal(frameFor(THINKERS.ramakrishna), "Here is what Sri Ramakrishna's canon records that bears on this:");
  assert.equal(frameFor({ handle: "arokin" }), "Here is what the Yoruba court historians' canon records that bears on this:");
  const r = run(Q, ["mozi", "ramakrishna"]);
  assert.equal(r.voices.find((v) => v.handle === "mozi").frame, TEMPLATES.wrote({ giver: "Mozi" }));
  assert.match(r.voices.find((v) => v.handle === "ramakrishna").frame, /canon records/);
  for (const v of r.voices) assert.ok(!/[\d()]/.test(v.giver) && v.giver.length <= 30);
});

test("sectionAt: the nearest heading above; null when there is none", () => {
  const i = MOZI.indexOf("God hates");
  assert.equal(sectionAt(MOZI, i), "BOOK IV");
  assert.equal(sectionAt("no heading here at all, just words.\n\nand more words.", 30), null);
  assert.equal(sectionAt(RAMA, RAMA.indexOf("The grain")), "CHAPTER THE FIRST");
});

test("a bank of rows (the page cannot read the canon): the same rule, quote = the row, offsets kept", () => {
  const rows = [{ text: "God rewards the virtuous ruler with long life and a peaceful state.", start: 100, end: 167 }, { text: "The farmer sows the grain in the spring and reaps.", start: 300, end: 350 }];
  const canon = () => ({ rows, sha256: "aa" });
  const r = voicesFor({ question: Q, candidates: [{ handle: "mozi" }], thinkers: THINKERS, canonOf: canon, fw: FW });
  assert.equal(r.voices.length, 1);
  assert.equal(r.voices[0].source.start, 100);
  assert.ok(verifyVoices({ result: r, thinkers: THINKERS, canonOf: canon }).ok);
  const tampered = JSON.parse(JSON.stringify(r)); tampered.voices[0].quote = "God rewards everyone.";
  assert.ok(!verifyVoices({ result: tampered, thinkers: THINKERS, canonOf: canon }).ok);
});

test("thinkerTable: speaking thinkers only, with source and hash", () => {
  const t = thinkerTable({ thinkers: [{ handle: "x", giver: "X", work: "W", speaks: true, source: { path: "p", sha256: "s" } }, { handle: "tech", speaks: false, source: { path: "q", sha256: "t" } }, { handle: "nosrc" }] });
  assert.deepEqual(Object.keys(t), ["x"]);
  assert.equal(t.x.source.sha256, "s");
});

// ─── the verifier is handed lies ───
const good = () => run(Q, ["ramakrishna", "mozi"]);
const clone = (o) => JSON.parse(JSON.stringify(o));
const rej = (mut, why) => { const r = clone(good()); mut(r); const v = verifyVoices({ result: r, thinkers: THINKERS, canonOf }); assert.equal(v.ok, false, why); if (why) assert.ok(v.bad.some((b) => b.why === why), JSON.stringify(v.bad)); };
test("verifyVoices accepts the honest result", () => assert.ok(verifyVoices({ result: good(), thinkers: THINKERS, canonOf }).ok));
test("verifyVoices rejects: an altered quote", () => rej((r) => { r.voices[0].quote += " Indeed."; }, "quote_is_not_the_canons_slice"));
test("verifyVoices rejects: shifted offsets", () => rej((r) => { r.voices[1].source.start += 1; }, "quote_is_not_the_canons_slice"));
test("verifyVoices rejects: an invented quote", () => rej((r) => { r.voices[0].quote = "There is no God."; }, "quote_is_not_the_canons_slice"));
test("verifyVoices rejects: a frame that is not the template", () => rej((r) => { r.voices[0].frame = "Mozi would say:"; }, "frame_is_not_the_template"));
test("verifyVoices rejects: a line that names a winner", () => rej((r) => { r.line = "Mozi is the best answer to this."; }, "line_is_not_the_template"));
test("verifyVoices rejects: a long giver label", () => rej((r) => { r.voices[0].giver = "Mozi (Mo Tzu, 470-391)"; }, "giver_not_short"));
test("verifyVoices rejects: more than 3 voices (four GENUINE voices, so only the cap is wrong)", () => {
  const r = run(Q, ["a", "b", "c", "d"], { limits: { max: 4 } });
  assert.equal(r.voices.length, 4);
  const v = verifyVoices({ result: r, thinkers: THINKERS, canonOf });
  assert.deepEqual(v.bad.map((b) => b.why), ["more_than_max"]);
});
test("verifyVoices rejects: not alphabetical", () => rej((r) => { r.voices.reverse(); }, "not_alphabetical"));
test("verifyVoices rejects: the same thinker twice", () => rej((r) => { r.voices[1] = clone(r.voices[0]); }, "one_thinker_twice"));
test("verifyVoices rejects: a source hash that is not the profile's", () => rej((r) => { r.voices[0].source.sha256 = "ff"; }, "canon_not_the_verified_file"));
test("verifyVoices rejects: a canon the host holds under another hash", () => {
  const v = verifyVoices({ result: good(), thinkers: THINKERS, canonOf: (h) => ({ ...canonOf(h), sha256: "zz" }) });
  assert.equal(v.ok, false);
});
test("verifyVoices rejects: an unknown thinker and a missing voices array", () => {
  rej((r) => { r.voices[0].handle = "ghost"; }, "unknown_thinker");
  assert.equal(verifyVoices({ result: {}, thinkers: THINKERS, canonOf }).ok, false);
});

test("renderText: the line, then each frame, the quote, the address", () => {
  const t = renderText(good());
  assert.match(t, /^Several voices bear on this/);
  assert.match(t, /Here is what Mozi wrote that bears on this:\n“Heaven loves/);
  assert.match(t, /BOOK IV \(x\/mozi\.txt, characters \d+–\d+\)/);
});

test("lineFor and the defaults are what the pre-registration declares", () => {
  assert.equal(lineFor(0), ""); assert.match(lineFor(1), /^One voice/); assert.match(lineFor(3), /^Several/);
  assert.equal(VOICES.max, 3); assert.equal(VOICES.strict, true);
});

test("a question of 3+ stems needs ceil(2n/3) of them: three of four is a voice, two of four is not", () => {
  const q = "Does justice reward honest rulers?";                      // stems: justic, reward, honest, ruler -> need 3 of 4
  const canon = (t) => ({ text: t, sha256: "aa" });
  const three = "Justice will reward the rulers of the small states in the long years of the world.";
  const two = "Justice will reward the folk of the small states in the long years of the world.";   // 2 of 4 stems: bearsOn alone (half) would pass it; the strict rule needs 3
  assert.ok(!findVoice({ question: q, thinker: THINKERS.mozi, canon: canon(three), fw: FW }).none);
  assert.equal(findVoice({ question: q, thinker: THINKERS.mozi, canon: canon(two), fw: FW }).none, true);
});

test("a cached index never lends a quote to a different text: same hash, length, head and tail; other words in the middle -> nothing is shown", () => {
  const mk = (w) => `God rewards the virtuous in all the long years of the old world, and the good people of the small states are glad, and the ${w} of the land keeps the peace for them with long life and a peaceful state, in all the years of the age.`;
  const A = mk("ruler"), B = mk("lords");
  assert.equal(A.length, B.length);
  const t = { ...THINKERS.mozi, source: { path: "p", sha256: "same-hash" } };
  const first = findVoice({ question: Q, thinker: t, canon: { text: A, sha256: "same-hash" }, fw: FW });
  assert.equal(first.quote, A);
  const second = findVoice({ question: Q, thinker: t, canon: { text: B, sha256: "same-hash" }, fw: FW });
  assert.equal(second.none, true);               // the key cannot tell A from B; the canon's own slice can
});

test("bank rows get the same sentence filters (a lowercase fragment and a thin sentence are not voices)", () => {
  const mk = (text) => () => ({ rows: [{ text, start: 10, end: 10 + text.length }], sha256: "aa" });
  for (const text of ["and so God rewards the ruler of the small states in the old tales.", "God rewards the ruler."]) {
    const r = voicesFor({ question: "God and the ruler?", candidates: [{ handle: "mozi" }], thinkers: THINKERS, canonOf: mk(text), fw: FW });
    assert.deepEqual(r.voices, [], text);
  }
});

test("ranking: more of the question's stems first, then the richer sentence, then the earlier", () => {
  const canon = { sha256: "aa", text: [
    "The ruler is often praised by the people of the small states in the old days.",
    "God and the ruler are named together by the people of the small states in the old days.",
  ].join(" ") };
  const loose = findVoice({ question: "God and the ruler?", thinker: THINKERS.mozi, canon, fw: FW, limits: { strict: false } });
  assert.match(loose.quote, /^God and the ruler are named/);                           // 2 stems beat 1 stem although it comes second
  const rich = { sha256: "aa", text: "God rewards the ruler of the small states. God rewards the virtuous ruler with long life and a peaceful state in every year of his reign." };
  assert.match(findVoice({ question: "God and the ruler?", thinker: THINKERS.mozi, canon: rich, fw: FW }).quote, /^God rewards the virtuous ruler with long life/);   // nearer 12 content stems
});
