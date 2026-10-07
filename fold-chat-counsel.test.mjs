// fold-chat-counsel.test.mjs — the draft and the pointer are CLAIMS that are checked, never believed. Every falsifier hands the verifier a lie. (pre-registered: eval/ants/B2-PREREG.md)
// COUNSEL_MODULE=fold-chat-counsel.mut.js runs the same tests against a mutated copy (eval/ants/b2-mutate.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { functionWordsOf } from "./fold-chat-snippets.js";

const M = await import(process.env.COUNSEL_MODULE ? "./" + process.env.COUNSEL_MODULE : "./fold-chat-counsel.js");
const { counselFor, verifyCounsel, tieGate, canonSentences, splitAssertions, narrateCounsel, indexCanon, draftMessages, sameAsQuote, TEMPLATES } = M;
const FW = functionWordsOf("en");

// a hard-wrapped scan, as the real canon files are (double spaces, a sentence broken across lines, an initial, a title)
const CANON = `Chapter One.

Heaven loves the people without partiality, and God rewards
the virtuous ruler with long life and a peaceful state.

God hates the ruler who attacks the small states; the spirits punish
him with disaster and the people forsake him.

Mr.  Mei says that the doctrine of fate is false and does not agree with the three tests.

The sage kings made offerings to God and the spirits in 3 seasons of the year, as the records show.

The sage kings made offerings for the sake of water, and the farmer sows for the sake of grain in the spring.

The ruler who loves the people universally will be loved by all the people in return.

There is no God that has ever been seen by the people, says the doubter, and the sage replies at length.

Heaven desires righteousness and hates unrighteousness, and the Son of Heaven must obey it.
`;
const THINKER = { handle: "mozi", giver: "Mozi", work: "The Works of Motse", source: { path: "x/mozi.txt", sha256: "00" }, text: CANON };
const Q = "Is there a God?";
const sentenceOf = (frag) => { const i = CANON.indexOf(frag); assert.ok(i >= 0, "fixture: " + frag); return canonSentences(CANON).find((s) => s.start <= i && i < s.end); };

// the pointing mock: find the numbered line in the prompt that carries `frag` and answer its number (NONE if absent)
const listed = (messages) => [...String(messages[1].content).matchAll(/^\[(\d+)\] (.*)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2] }));
const pointTo = (frag) => async (messages) => { const hit = listed(messages).find((c) => c.text.includes(frag)); return hit ? String(hit.n) : "NONE"; };
const run = (draftText, point, over = {}) => counselFor({ question: Q, thinker: THINKER, draft: async () => draftText, point, fw: FW, ...over });

test("canonSentences: a single newline is not a sentence end, an initial/title does not end one, offsets are exact", () => {
  const ss = canonSentences(CANON).map((s) => CANON.slice(s.start, s.end));
  assert.ok(ss.some((s) => s === "Heaven loves the people without partiality, and God rewards\nthe virtuous ruler with long life and a peaceful state."), "the wrapped sentence is one sentence");
  assert.ok(ss.some((s) => s.startsWith("Mr.  Mei says") && s.endsWith("three tests.")), "Mr. does not end it");
  assert.ok(ss.includes("Chapter One."));
  for (const s of canonSentences(CANON)) assert.equal(CANON.slice(s.start, s.end), CANON.slice(s.start, s.end).trim());
});

test("indexCanon: only quotable sentences are indexed (bounded, sentence-shaped, no scan debris)", () => {
  const t = "Chapter One.\n\nThis ^ is a footnote mark that is debris in the scan of the book.\n\nGod rewards the virtuous ruler with long life and a peaceful state.\n";
  const idx = indexCanon(t, FW);
  assert.deepEqual(idx.sents.map((s) => s.text), ["God rewards the virtuous ruler with long life and a peaceful state."]);
});

// ─────────── the gate ───────────
test("tieGate: carries every stem -> all_stems; most of them -> majority; too few -> rejected", () => {
  const S = "God rewards the virtuous ruler with long life and a peaceful state.";
  const all = tieGate({ assertion: "Mozi holds that God rewards the virtuous ruler with long life.", sentence: S, question: Q, giver: "Mozi", fw: FW });
  assert.equal(all.ok, true); assert.equal(all.kind, "all_stems");
  const maj = tieGate({ assertion: "Mozi holds that God rewards the virtuous ruler with a long and happy life.", sentence: S, question: Q, giver: "Mozi", fw: FW });
  assert.equal(maj.ok, true); assert.equal(maj.kind, "majority");
  const few = tieGate({ assertion: "Mozi holds that God rewards the virtuous ruler and also the farmers, the merchants and the soldiers.", sentence: S, question: Q, giver: "Mozi", fw: FW });
  assert.equal(few.ok, false); assert.match(few.why, /^too_few_stems:/);
});

test("tieGate: a lie that shares only the QUESTION's words with the sentence is rejected (the lexical trap)", () => {
  const r = tieGate({ assertion: "Mozi holds that God is an impersonal cosmic force.", sentence: "There is no God that has ever been seen by the people, says the doubter, and the sage replies.", question: Q, giver: "Mozi", fw: FW });
  assert.deepEqual([r.ok, r.why], [false, "shares_only_the_questions_words"]);
  assert.equal(tieGate({ assertion: "Mozi says that there is a God.", sentence: "God rewards the virtuous ruler with long life.", question: "Is there a God?", giver: "Mozi", fw: FW }).why, "no_content_beyond_the_question", "an assertion that adds nothing to the question cannot be tied: it is the question restated");
});

test("tieGate: coverage below 60% is rejected (not the one stem that happens to match)", () => {
  const r = tieGate({ assertion: "Mozi holds that God rewards the virtuous ruler, protects the farmers and guides the merchants.", sentence: "The ruler who loves the people universally will be loved by all the people in return.", question: Q, giver: "Mozi", fw: FW });
  assert.equal(r.ok, false); assert.match(r.why, /^too_few_stems:/);
});

test("tieGate: minShared is a separate floor (with a lax coverage a single shared stem is still not enough)", () => {
  const a = { assertion: "Mozi holds that God rewards the virtuous ruler.", sentence: "The virtuous farmer sows grain in the spring season.", question: Q, giver: "Mozi", fw: FW };
  assert.equal(tieGate({ ...a, coverageMin: 0.2 }).ok, false);
  assert.equal(tieGate({ ...a, coverageMin: 0.2, minShared: 1 }).ok, true);
});

test("tieGate: a figure the assertion states must be in the sentence", () => {
  const S = "The sage kings made offerings to God and the spirits in 3 seasons of the year, as the records show.";
  assert.equal(tieGate({ assertion: "Mozi holds that the sage kings made offerings to the spirits in 3 seasons of the year.", sentence: S, question: Q, giver: "Mozi", fw: FW }).ok, true);
  const r = tieGate({ assertion: "Mozi holds that the sage kings made offerings to the spirits in 4 seasons of the year.", sentence: S, question: Q, giver: "Mozi", fw: FW });
  assert.deepEqual([r.ok, r.why], [false, "figure_missing:4"]);
});

test("tieGate: negation parity — 'there is no God' cannot be tied to 'God exists', nor the reverse", () => {
  const pos = "The sage kings believed that the spirits exist and God rewards the virtuous ruler.";
  const neg = "Many doubters say that the spirits do not exist and that God does not reward the virtuous ruler.";
  assert.equal(tieGate({ assertion: "Mozi holds that the spirits do not exist and God does not reward the virtuous ruler.", sentence: pos, question: Q, giver: "Mozi", fw: FW }).why, "polarity_differs");
  assert.equal(tieGate({ assertion: "Mozi holds that the spirits exist and God rewards the virtuous ruler.", sentence: neg, question: Q, giver: "Mozi", fw: FW }).why, "polarity_differs");
  assert.equal(tieGate({ assertion: "Mozi holds that the spirits exist and God rewards the virtuous ruler.", sentence: pos, question: Q, giver: "Mozi", fw: FW }).ok, true);
});

test("splitAssertions: sentences, list marks and quotation marks removed (a model cannot forge a quote), NOTHING and questions dropped, bounded", () => {
  assert.deepEqual(splitAssertions("NOTHING"), []);
  assert.deepEqual(splitAssertions(""), []);
  assert.deepEqual(splitAssertions("NOTHING. Mozi holds that God rewards the virtuous ruler with long life."), [], "a reply that opens with NOTHING is the refusal, whatever follows");
  assert.deepEqual(splitAssertions("Does Mozi hold that God rewards the virtuous ruler with long life?"), [], "a question is not an assertion");
  const a = splitAssertions('1. Mozi holds that "God rewards the virtuous ruler" with long life.\n- Mozi holds that God hates the ruler who attacks.\nDoes Mozi say more? Mozi holds that Heaven loves the people.\nShort.');
  assert.deepEqual(a, ["Mozi holds that God rewards the virtuous ruler with long life.", "Mozi holds that God hates the ruler who attacks.", "Mozi holds that Heaven loves the people."]);
  assert.equal(splitAssertions("Mozi holds that A is B and so on. ".repeat(10), { max: 3 }).length, 1, "duplicates collapse");
  assert.ok(splitAssertions("Mozi holds that alpha is beta. Mozi holds that gamma is delta. Mozi holds that epsilon is zeta. Mozi holds that eta is theta. Mozi holds that iota is kappa.", { max: 3 }).length <= 3);
});

// ─────────── the turn: honest ───────────
test("HONEST: assertions the canon carries are TIED, narrated in the app's words around the verbatim quote, and verifyCounsel agrees", async () => {
  const draftText = "Mozi holds that God rewards the virtuous ruler with long life.\nMozi holds that God hates the ruler who attacks the small states.";
  const r = await run(draftText, async (m) => pointTo("rewards")(m).then((x) => (x === "NONE" ? pointTo("hates")(m) : x)));
  // the pointer answers the first match for both; the second assertion must therefore be checked on ITS OWN against that pick
  assert.equal(r.calls.draft, 1); assert.ok(r.calls.point >= 2);
  const tied = r.assertions.filter((a) => a.tied);
  assert.ok(tied.length >= 1, JSON.stringify(r.assertions));
  for (const a of tied) { assert.equal(a.pointer.tier, "canon"); assert.equal(CANON.slice(a.pointer.start, a.pointer.end), a.pointer.quote); }
  assert.ok(r.narration.parts.some((p) => p.kind === "quote"));
  assert.ok(r.narration.text.includes("From The Works of Motse, in Mozi's canon:"));
  assert.ok(r.narration.text.includes("My reading of that, not Mozi's words:"));
  assert.deepEqual(verifyCounsel({ result: r, canon: CANON }), { ok: true, bad: [] });
});

test("HONEST, each assertion pointed at its own sentence: two ties, two quotes, a withheld count only for what failed", async () => {
  const sets = ["Mozi holds that God rewards the virtuous ruler with long life.", "Mozi holds that God hates the ruler who attacks the small states.", "Mozi holds that God is a purely mathematical object."];
  const frags = ["rewards", "hates", "mathematical"];
  let k = 0;
  const r = await run(sets.join("\n"), async (m) => pointTo(frags[Math.min(k++, 2)])(m));
  assert.equal(r.assertions.filter((a) => a.tied).length, 2, JSON.stringify(r.assertions.map((a) => [a.tied, a.why])));
  assert.equal(r.assertions.filter((a) => !a.tied).length, 1);
  assert.match(r.narration.text, /I withheld 1 other thing the model suggested Mozi would say/);
  assert.equal(r.narration.parts.filter((p) => p.kind === "quote").length, 2);
  assert.ok(!r.narration.text.includes("mathematical"), "the withheld assertion never reaches the narration");
  assert.deepEqual(verifyCounsel({ result: r, canon: CANON }), { ok: true, bad: [] });
});

test("the model is given the thinker's OWN sentences for the question, chosen mechanically, and nothing else of theirs", async () => {
  let seen = null;
  await counselFor({ question: Q, thinker: THINKER, draft: async (m) => { seen = m; return "NOTHING"; }, point: async () => "NONE", fw: FW });
  const passages = seen[1].content.split("QUESTION")[0].split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  assert.ok(passages.length >= 2);
  for (const p of passages) assert.ok(CANON.replace(/\s+/g, " ").includes(p), "every passage is the canon's own sentence: " + p);
  assert.match(seen[0].content, /ONLY the passages/); assert.match(seen[0].content, /NOTHING/);
});

// ─────────── the falsifiers (pre-registered) ───────────
const LIES = [
  "Mozi holds that God is an impersonal cosmic force without will or intention.",
  "Mozi holds that God is the supreme Brahman and the world is an illusion.",
  "Mozi holds that God commands the faithful to pray five times each day facing Mecca.",
  "Mozi holds that God will judge every soul at the end of time and cast sinners into fire.",
];

test("FALSIFIER 1: a FORCED-FABRICATION draft model, with a sycophantic pointer (always #1) and a wandering pointer, ties NOTHING and says nothing in the thinker's name", async () => {
  for (const mk of [() => async () => "1", () => { let k = 0; return async () => String(1 + (k++ % 16)); }]) {
    const r = await run(LIES.join("\n"), mk());
    assert.equal(r.assertions.length, 4);
    assert.ok(r.assertions.every((a) => a.tied === false), JSON.stringify(r.assertions));
    assert.ok(!r.narration.parts.some((p) => p.kind === "quote"));
    for (const l of LIES) assert.ok(!r.narration.text.includes(l.replace(/^Mozi holds that /, "")));
    assert.match(r.narration.text, /so I am not saying anything in their name/);
    assert.deepEqual(verifyCounsel({ result: r, canon: CANON }), { ok: true, bad: [] });
  }
});

test("FALSIFIER 1b: for EVERY lie and EVERY sentence of the canon the gate says no (an exhaustive sycophant cannot tie it either)", () => {
  const idx = indexCanon(CANON, FW);
  assert.ok(idx.sents.length >= 6);
  for (const l of LIES) for (const s of idx.sents) assert.equal(tieGate({ assertion: l, sentence: s.text, question: Q, giver: "Mozi", fw: FW }).ok, false, l + " <- " + s.text);
});

test("FALSIFIER 2: an assertion TRUE of another thinker but absent from this canon is withheld (no sentence of this canon carries it)", async () => {
  const other = "Mozi holds that the self is reborn again and again according to its karma until it is liberated.";
  const r = await run(other, async () => "1");
  assert.equal(r.assertions[0].tied, false);
  assert.ok(["no_candidates", "unrelated", "shares_only_the_questions_words", "no_content_beyond_the_question"].includes(r.assertions[0].why) || /^too_few_stems/.test(r.assertions[0].why), r.assertions[0].why);
});

test("FALSIFIER 3: the model points at a REAL canon sentence that does not carry the assertion -> rejected, after one bounded retry", async () => {
  let asked = 0;
  const r = await run("Mozi holds that God rewards the virtuous ruler with long life.", async (m) => { asked++; return pointTo("The sage kings made offerings")(m); });
  assert.equal(r.assertions[0].tied, false);
  assert.ok(asked <= 2, "one bounded retry");
  const seenPrompts = [];
  await run("Mozi holds that God rewards the virtuous ruler with long life.", async (m) => { seenPrompts.push(listed(m)); return pointTo("The sage kings made offerings")(m); });
  assert.equal(seenPrompts.length, 2);
  assert.ok(seenPrompts[0].some((c) => c.text.includes("The sage kings made offerings")) && !seenPrompts[1].some((c) => c.text.includes("The sage kings made offerings")), "the rejected pick is withdrawn before the retry");
  assert.ok(!r.narration.parts.some((p) => p.kind === "quote"));
});

test("FALSIFIER 4: a pointer to a number that does not exist (99, 0, -3, banana, empty, 1.5) is rejected and never narrated", async () => {
  for (const reply of ["99", "0", "-3", "banana", "", "7.5"]) {
    const r = await run("Mozi holds that God rewards the virtuous ruler with long life.", async () => reply);
    assert.equal(r.assertions[0].tied, false, "reply: " + JSON.stringify(reply));
    assert.ok(["no_such_sentence", "unparsed", "none", "rejected"].includes(r.assertions[0].why) || /^[a-z_]+/.test(r.assertions[0].why));
    assert.ok(!r.narration.parts.some((p) => p.kind === "quote"));
  }
  const none = await run("Mozi holds that God rewards the virtuous ruler with long life.", async () => "NONE");
  assert.equal(none.assertions[0].why, "none"); assert.equal(none.calls.point, 1, "NONE is final: no retry");
});

test("FALSIFIER 5: abort propagates from the draft, from the pointer, and from a pre-aborted signal (it is never a quiet 'withheld')", async () => {
  const abort = () => Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  await assert.rejects(counselFor({ question: Q, thinker: THINKER, draft: async () => { throw abort(); }, point: async () => "1", fw: FW }), { name: "AbortError" });
  await assert.rejects(counselFor({ question: Q, thinker: THINKER, draft: async () => "Mozi holds that God rewards the virtuous ruler with long life.", point: async () => { throw abort(); }, fw: FW }), { name: "AbortError" });
  const ac = new AbortController(); ac.abort();
  let called = 0;
  await assert.rejects(counselFor({ question: Q, thinker: THINKER, draft: async () => { called++; return "x"; }, point: async () => { called++; return "1"; }, fw: FW, limits: { signal: ac.signal } }), { name: "AbortError" });
  assert.equal(called, 0, "no model call after an abort");
});

test("a non-abort failure of the draft or the pointer is typed, not a crash: nothing is said", async () => {
  const d = await counselFor({ question: Q, thinker: THINKER, draft: async () => { throw new Error("boom"); }, point: async () => "1", fw: FW });
  assert.equal(d.assertions.length, 0); assert.match(d.why, /^draft_failed/); assert.match(d.narration.text, /not saying anything in their name/);
  const p = await run("Mozi holds that God rewards the virtuous ruler with long life.", async () => { throw new Error("down"); });
  assert.match(p.assertions[0].why, /^call_failed/); assert.equal(p.assertions[0].tied, false);
});

test("a draft of NOTHING / an empty draft makes no assertion and no pointing call", async () => {
  for (const d of ["NOTHING", "", "   "]) { let pointed = 0; const r = await run(d, async () => { pointed++; return "1"; }); assert.equal(r.assertions.length, 0); assert.equal(pointed, 0); assert.equal(r.calls.draft, 1); assert.equal(r.why, "draft_made_no_assertion"); }
});

test("a thinker with no verified canon is REFUSED ('never ventriloquized'): zero model calls", async () => {
  let n = 0;
  const r = await counselFor({ question: Q, thinker: { handle: "ghost", giver: "Ghost", work: "w" }, draft: async () => { n++; return "x"; }, point: async () => { n++; return "1"; }, fw: FW });
  assert.equal(n, 0); assert.equal(r.refused, true); assert.deepEqual(r.assertions, []);
  assert.equal(r.narration.text, TEMPLATES.refused({ giver: "Ghost" }));
});

test("MODEL WORDS ARE QUARANTINED: the only model text in the narration is the reading part, without quotation marks, under the app's prefix; quote parts are the canon's", async () => {
  const forged = 'Mozi holds that God rewards the virtuous ruler with long life. “Mozi wrote: God is dead.”';
  const r = await run(forged, pointTo("rewards"));
  const kinds = r.narration.parts.map((p) => p.kind + (p.model ? "+model" : ""));
  assert.ok(kinds.includes("app+model"));
  for (const p of r.narration.parts) {
    if (p.kind === "quote") assert.equal(CANON.slice(p.start, p.end), p.text);
    if (p.kind === "app" && !p.model) assert.ok(Object.values(TEMPLATES).some((t) => { try { return t({ giver: "Mozi", work: "The Works of Motse", n: 1, text: "" }) === p.text || t({ giver: "Mozi", work: "The Works of Motse", n: 2, text: "" }) === p.text; } catch { return false; } }), "an app part that is not a template: " + p.text);
    if (p.model) { assert.ok(!/["“”]/.test(p.text), "no quotation marks in the model's reading"); assert.ok(p.text.startsWith("My reading of that, not Mozi's words: ")); }
  }
  assert.ok(!r.narration.text.includes("God is dead"));
});

test("a candidate the caller gives that is NOT the canon's own slice is dropped (it never reaches the model or the pointer, and cannot be the tie of an assertion it carries)", async () => {
  const s = sentenceOf("God hates the ruler");
  const forged = { start: s.start, end: s.end, text: "God commands every believer to pray five times a day facing Mecca." };
  let prompts = [];
  await counselFor({ question: Q, thinker: { ...THINKER, candidates: [forged] }, draft: async (m) => { prompts.push(m); return "Mozi holds that God commands every believer to pray five times a day facing Mecca."; }, point: async (m) => { prompts.push(m); return pointTo("Mecca")(m); }, fw: FW });
  const r = await counselFor({ question: Q, thinker: { ...THINKER, candidates: [forged] }, draft: async () => "Mozi holds that God commands every believer to pray five times a day facing Mecca.", point: pointTo("Mecca"), fw: FW });
  assert.equal(r.assertions[0].tied, false);
  assert.ok(!JSON.stringify(prompts.filter((m) => m[0].content.includes("ONLY the passages"))).includes("facing Mecca"), "the forged text was never offered to the draft model as the thinker's words");
});

test("CANDIDATES-ONLY thinker (no canon text in hand): ties are to the given candidates, offsets as given", async () => {
  const s1 = sentenceOf("God rewards"), s2 = sentenceOf("God hates");
  const cands = [s1, s2].map((s) => ({ start: s.start, end: s.end, text: CANON.slice(s.start, s.end) }));
  const th = { handle: "mozi", giver: "Mozi", work: "The Works of Motse", source: { path: "x", sha256: "00" }, candidates: cands };
  const r = await counselFor({ question: Q, thinker: th, draft: async () => "Mozi holds that God hates the ruler who attacks the small states.", point: pointTo("hates"), fw: FW });
  assert.equal(r.assertions[0].tied, true, JSON.stringify(r.assertions));
  assert.equal(CANON.slice(r.assertions[0].pointer.start, r.assertions[0].pointer.end), r.assertions[0].pointer.quote);
  assert.deepEqual(verifyCounsel({ result: r, canon: CANON }), { ok: true, bad: [] });
});

// ─────────── verifyCounsel: the check on the narrator ───────────
async function honest() { return run("Mozi holds that God rewards the virtuous ruler with long life.", pointTo("rewards")); }

test("verifyCounsel fails on: a tampered quote, wrong offsets, a tampered app part, a model sentence in an app part, a leaked withheld assertion, a pointer that is not the canon's slice", async () => {
  const good = await honest();
  assert.equal(good.assertions[0].tied, true);
  assert.deepEqual(verifyCounsel({ result: good, canon: CANON }), { ok: true, bad: [] });
  const clone = () => JSON.parse(JSON.stringify(good));
  let r = clone(); r.narration.parts.find((p) => p.kind === "quote").text = "God commands the faithful to pray.";
  assert.equal(verifyCounsel({ result: r, canon: CANON }).ok, false);
  r = clone(); r.narration.parts.find((p) => p.kind === "quote").start += 3;
  assert.equal(verifyCounsel({ result: r, canon: CANON }).ok, false);
  r = clone(); r.narration.parts.find((p) => p.kind === "app").text = "Mozi emphatically says: God exists.";
  assert.equal(verifyCounsel({ result: r, canon: CANON }).ok, false);
  r = clone(); r.narration.parts.push({ kind: "app", rule: "reading", model: true, text: "Mozi also swore that God is dead." });
  assert.equal(verifyCounsel({ result: r, canon: CANON }).ok, false);
  r = clone(); r.assertions.push({ text: "Mozi holds that a withheld thing is said here.", tied: false, why: "x" }); r.narration.text += " Mozi holds that a withheld thing is said here.";
  assert.ok(verifyCounsel({ result: r, canon: CANON }).bad.some((b) => /withheld_text_in_narration|text_not_the_join|not_the_rendering/.test(b.why)));
  r = clone(); r.assertions[0].pointer.quote = "something else entirely about God";
  assert.ok(verifyCounsel({ result: r, canon: CANON }).bad.some((b) => b.why === "pointer_not_the_canons_slice"));
  r = clone(); r.narration.parts.push({ kind: "weird", text: "x" });
  assert.equal(verifyCounsel({ result: r, canon: CANON }).ok, false);
  assert.equal(verifyCounsel({ result: { assertions: [] }, canon: CANON }).ok, false);
  assert.equal(verifyCounsel({ result: good, canon: CANON.replace("rewards", "REWARDS") }).ok, false, "a canon that differs from the one the offsets were taken in");
});

test("narrateCounsel is deterministic and groups assertions that tie to the same sentence under ONE quote", () => {
  const p = { start: 5, end: 40, quote: "x".repeat(35), tier: "canon" };
  const a = [{ text: "Mozi holds one.", tied: true, pointer: p }, { text: "Mozi holds two.", tied: true, pointer: p }, { text: "Mozi holds three.", tied: false, why: "none" }];
  const n = narrateCounsel({ giver: "Mozi", work: "W", assertions: a });
  assert.equal(n.parts.filter((x) => x.kind === "quote").length, 1);
  assert.equal(n.parts.filter((x) => x.model).length, 2);
  assert.deepEqual(n, narrateCounsel({ giver: "Mozi", work: "W", assertions: a }));
  assert.ok(!n.text.includes("three"));
});

test("draftMessages names only the thinker's own words and asks for third-person single claims with no quotation marks", () => {
  const m = draftMessages({ question: Q, giver: "Mozi", work: "W", material: [{ text: "God rewards the virtuous." }] });
  assert.match(m[0].content, /Mozi/); assert.match(m[0].content, /Do not use quotation marks/); assert.match(m[1].content, /- God rewards the virtuous\./);
});

test("tieGate: 'without' is not a clausal negation (a quote saying 'without partiality' still ties 'God rewards the virtuous')", () => {
  const r = tieGate({ assertion: "Mozi holds that God rewards the virtuous ruler with long life.", sentence: "Heaven loves the people without partiality, and God rewards the virtuous ruler with long life and a peaceful state.", question: Q, giver: "Mozi", fw: FW });
  assert.equal(r.ok, true);
});

test("splitAssertions strips a leading 'Giver:' label (small models write it) when told the giver", () => {
  assert.deepEqual(splitAssertions("Swami Vivekananda: The spiritual goal is the finding of God.\nSwami Vivekananda - God is in every being.", { giver: "Swami Vivekananda" }), ["The spiritual goal is the finding of God.", "God is in every being."]);
  assert.deepEqual(splitAssertions("Sri Ramakrishna, as the monkey Hanuman, had already worshipped God as his Master.", { giver: "Sri Ramakrishna" }), ["Sri Ramakrishna, as the monkey Hanuman, had already worshipped God as his Master."], "a comma after the name is part of the sentence (found in the real run), not a label");
});

test("an assertion that merely COPIES the quote is tied but shows no 'reading' under it (the quote already says it); a paraphrase still does", async () => {
  const same = "God hates the ruler who attacks the small states; the spirits punish him with disaster and the people forsake him.";
  assert.equal(sameAsQuote(same, same.toUpperCase().replace(";", ",")), true);
  const r = await run(same + "\nMozi holds that God rewards the virtuous ruler with long life.", async (m) => { const l = listed(m); const w = l.find((c) => (m[1].content.split("ANSWER\n")[1] || "").startsWith("God hates") ? c.text.startsWith("God hates") : c.text.includes("rewards")); return String(w.n); });
  assert.equal(r.assertions.filter((a) => a.tied).length, 2, JSON.stringify(r.assertions));
  assert.equal(r.narration.parts.filter((p) => p.model).length, 1, "only the paraphrase carries a reading");
  assert.deepEqual(verifyCounsel({ result: r, canon: CANON }), { ok: true, bad: [] });
});

test("CANDIDATES-ONLY with a whole bank: the raw material is chosen from the bank by the question's stems (the farmer sentence is not offered for 'Is there a God?')", async () => {
  const bank = indexCanon(CANON, FW).sents.map((s) => ({ start: s.start, end: s.end, text: s.text }));
  assert.ok(bank.some((c) => c.text.includes("farmer sows")));
  let seen = null;
  await counselFor({ question: Q, thinker: { handle: "mozi", giver: "Mozi", work: "W", source: { path: "x", sha256: "00" }, candidates: bank }, draft: async (m) => { seen = m; return "NOTHING"; }, point: async () => "NONE", fw: FW });
  assert.ok(seen[1].content.includes("God"));
  assert.ok(!seen[1].content.includes("farmer sows"));
});
