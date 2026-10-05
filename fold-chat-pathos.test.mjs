// fold-chat-pathos.test.mjs — the pathos archons for a conversation (fold-chat-pathos.js): who is experiencing what.
import { test } from "node:test";
import assert from "node:assert/strict";
import { authorOf, undergone, readFelt, PATHOS } from "./fold-chat-pathos.js";
import { pathosOf } from "./vendor/khora/native/organs/pathos.js";
import { cuesFor } from "./fold-chat-flow.js";
import { door } from "./fold-chat-gary.js";

const A = (content, model = "gemma2:2b", extra = {}) => ({ role: "assistant", content, mode: "chat", grounding: { model }, ...extra });
const U = (content) => ({ role: "user", content });
const FLAT = [
  A("The cookie is good. The cake is good. The pie is good."),
  A("The soup is hot. The stew is hot. The tea is hot."),
  A("The bread is warm. The roll is warm. The bun is warm."),
];
const ALIVE = [
  A("Brown the butter first, then let it cool. It matters."),
  A("Two sugars give the chew you want, and the extra yolk makes it dense, soft, a little fudgy at the middle. Try it."),
  A("Chill the dough overnight. Bake until the edges set but the centre still looks underdone, then leave the tray alone for ten minutes. Done."),
];

test("authorOf: who wrote a turn comes from the turn's own record — never from a label the message carries", () => {
  assert.deepEqual(authorOf(A("hello there", "gemma2:2b")), { by: "model", model: "gemma2:2b" });
  assert.deepEqual(authorOf({ role: "assistant", content: "x", authored: "sources" }), { by: "sources" });
  assert.deepEqual(authorOf({ role: "assistant", content: "x", mode: "agent" }), { by: "agent" });
  assert.deepEqual(authorOf(U("hi")), { by: "person" });
  assert.deepEqual(authorOf({ role: "assistant", content: "" }), { by: "none" });
  assert.deepEqual(authorOf(null), { by: "none" });
  // the labels the red-team typed (holder / who / experiencer) change nothing
  const labelled = authorOf({ ...A("hello there", "gemma2:2b"), who: "Alex", holder: "Taylor", experiencer: { who: "the person", read: "x" } });
  assert.deepEqual(labelled, { by: "model", model: "gemma2:2b" });
});

test("undergone: the experiencer is the model that wrote the answers, read from the turns; the person's words and the sources' words are never read as the fold's", () => {
  const mixed = [U("show me a cookie recipe"), { role: "assistant", content: "Brown the butter.\n\nBrown the butter.", authored: "sources" }, ...FLAT, { role: "assistant", content: "agent code", mode: "agent" }];
  const u = undergone(mixed, { convo: "c1" });
  assert.equal(u.answers.length, 3, "only the three model-written answers");
  assert.deepEqual(u.experiencer, { who: "model:gemma2:2b", read: "conversation:c1" });
  assert.deepEqual(u.excluded, { sources: 1, agent: 1, person: 1, unverified: 0 });
  assert.equal(u.gap, null);
});

test("FALSIFIER (the red-team, B1): the SAME text under two different labels gets the SAME experiencer — the label is not who", () => {
  const same = (label) => [A("The cookie is good. The cake is good. The pie is good.", "gemma2:2b", label), A("The soup is hot. The stew is hot. The tea is hot.", "gemma2:2b", label), A("The bread is warm. The roll is warm. The bun is warm.", "gemma2:2b", label)];
  const a = undergone(same({ who: "Alex", holder: "Alex" }));
  const b = undergone(same({ who: "Taylor", holder: "Taylor", experiencer: { who: "Taylor", read: "x" } }));
  assert.deepEqual(a.experiencer, b.experiencer);
  assert.doesNotMatch(JSON.stringify(a.experiencer), /Alex|Taylor/);
});

test("FALSIFIER (the red-team, B3): an answer whose author cannot be verified is not read at all — a typed gap, never a guessed experiencer", () => {
  const unverified = [{ role: "assistant", content: "The cookie is good. The cake is good." }, { role: "assistant", content: "The soup is hot. The stew is hot." }, { role: "assistant", content: "The bread is warm. The roll is warm." }];
  const u = undergone(unverified);
  assert.equal(u.experiencer, null);
  assert.equal(u.gap, "no_model_authored_answers");
  assert.equal(u.excluded.unverified, 3);
  const r = readFelt(unverified);
  assert.equal(r.felt, null);
  assert.equal(r.gap, "no_model_authored_answers");
  assert.equal(r.act, null);
});

test("FALSIFIER: the sources' flat prose is not the fold's flatness — a Sources-only strand never makes the fold 'flat', and the person's turns never do", () => {
  const strand = (t) => ({ role: "assistant", authored: "sources", content: t });
  const flatSources = [strand("Mix well. Mix well. Mix well."), strand("Bake it. Bake it. Bake it."), strand("Cool it. Cool it. Cool it."), U("thanks. thanks. thanks."), U("ok. ok. ok.")];
  const r = readFelt([...flatSources, ...ALIVE]);
  assert.equal(r.gap, null);
  assert.equal(r.condition, "ground_holds");
  assert.equal(r.felt.flatline, false);
  assert.equal(r.memo.log.length, 0, "no concession was recorded against the fold for prose that was never its own");
  // and with only strands there is nothing of the fold's to read
  assert.equal(readFelt(flatSources).gap, "no_model_authored_answers");
});

test("readFelt: flat answers are STALE, the concession is a RECORDED act, and the same kind is not conceded twice without a holding read between", () => {
  const first = readFelt(FLAT, { convo: "c1" });
  assert.equal(first.condition, "stale");
  assert.equal(first.felt.flatline, true);
  assert.equal(first.felt.strain, "report", "no contradiction record in the chat: strain is a declared gap, never invented");
  assert.equal(first.memo.log.length, 1);
  assert.equal(first.memo.log[0].schema, "EOPathosReGround@1");
  assert.equal(first.memo.log[0].witness.startsWith("reader:pathos@stale"), true);
  assert.equal(first.cue, null, "Terry speaks a flat exchange in her own words; the organ's sentence would say it twice");
  const again = readFelt(FLAT, { convo: "c1", memo: first.memo });
  assert.equal(again.act, null, "not conceded twice in a row");
  assert.equal(again.memo.log.length, 1);
  const held = readFelt(ALIVE, { convo: "c1", memo: again.memo });
  assert.equal(held.condition, "ground_holds");
  assert.equal(held.memo.held, true, "a holding read re-founds the ground");
  const flatAgain = readFelt(FLAT, { convo: "c1", memo: held.memo });
  assert.equal(flatAgain.memo.log.length, 2, "…so the next failure is a new, recorded concession");
});

test("readFelt: varied answers hold the ground; too few answers is a gap (the organ withholds, never convicts)", () => {
  const alive = readFelt(ALIVE);
  assert.equal(alive.condition, "ground_holds");
  assert.equal(alive.felt.flatline, false);
  assert.equal(readFelt(FLAT.slice(0, 2)).gap, "too_few_answers");
  assert.equal(readFelt([]).gap, "no_model_authored_answers");
  assert.equal(PATHOS.minAnswers, 3);
});

test("DECLARED GAPS: collapse cannot fire (the curve is unmeasured on this pipeline) and the curve says so", () => {
  const r = readFelt(FLAT);
  assert.notEqual(r.condition, "collapse");
  const read = pathosOf({ text: FLAT.map((m) => m.content).join("\n\n"), experiencer: r.experiencer });
  assert.equal(read.curve.measured, false);
  assert.match(read.curve.unmeasured, /gap, not a verdict/);
  assert.match(r.disclosure.curve, /typed gap/);
});

test("pathos without a declared experiencer is refused by the organ itself — and readFelt turns the refusal into a gap, never a throw", () => {
  assert.throws(() => pathosOf({ text: "A sentence. Another one here.", experiencer: null }), /experiencer/);
  assert.throws(() => pathosOf({ text: "A sentence. Another one here.", experiencer: { who: "", read: "x" } }), /experiencer\.who/);
  assert.doesNotThrow(() => readFelt([A("x"), A("y"), A("z")]));
});

test("omnilingual: a script without ./!/? or spaces is ONE sentence — never convicted (an under-detection, said so); a spaced script is read like any other; no throw", () => {
  // Han and Thai carry no ASCII sentence marks and no spaces: the organ sees one sentence, and one sentence is never flat — even when
  // the same answer is repeated three times (declared: the organ's pacing is blind here, so it withholds rather than convicts).
  for (const t of ["东京的人口约为一千四百万。这是一个很大的城市。", "ประชากรของโตเกียวประมาณสิบสี่ล้านคน"]) {
    const r = readFelt([A(t), A(t), A(t)]);
    assert.equal(r.gap, null, t);
    assert.equal(r.felt.flatline, false, "never flagged flat: " + t);
    assert.equal(r.condition, "ground_holds");
    assert.equal(r.memo.log.length, 0);
  }
  // Arabic and Cyrillic are spaced and use . — read like Latin: varied answers hold, a run of identical short answers is flat.
  const ar = ["يبلغ عدد سكان طوكيو حوالي أربعة عشر مليون نسمة.", "وهي أكبر مدينة في اليابان، وتمتد على مساحة واسعة جدا من السهل المحيط بالخليج، وتضم عددا هائلا من الأحياء المتنوعة.", "نعم."];
  const ru = ["Население Токио около четырнадцати миллионов человек.", "Это крупнейший город Японии, раскинувшийся на огромной равнине вокруг залива, и в нём множество самых разных районов.", "Да."];
  for (const set of [ar, ru]) {
    assert.equal(readFelt(set.map((t) => A(t))).condition, "ground_holds", "varied answers hold");
    assert.equal(readFelt([A(set[0]), A(set[0]), A(set[0])]).condition, "stale", "the same sentence three times is flat in any script that marks sentences");
  }
});

test("the felt shape reaches the reply only through Terry's facts: a flat run of answers → her own sentence, vetted by Gary", () => {
  const r = readFelt(FLAT);
  const { cues } = cuesFor({ act: "question", felt: r.felt, pathosCue: r.cue, door });
  assert.equal(cues.length, 1);
  assert.match(cues[0].text, /gone flat/);
  const calm = readFelt(ALIVE);
  const { cues: calmCues } = cuesFor({ act: "question", felt: calm.felt, pathosCue: calm.cue, door });
  assert.doesNotMatch(calmCues[0].text, /gone flat/);
});
