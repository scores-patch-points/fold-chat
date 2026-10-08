// fold-chat-pivot.test.mjs — the Pivot WITHOUT a browser, a network or a model. Every case hands the pivot a DRAFT a model might write and
// asserts what may be SPOKEN. The falsifiers are the point: a forced-bad draft must NOT reach the text, and the same assertion must FAIL on
// the raw draft (so "the pivot is off" is visible as a failing check, never a vacuous pass).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pivotText, verifyPivot, readUnits, plainOf, standingLine, storePivot, pivotLine, grammarFor, GRAMMAR, relevantPassages, SOFT_WHY } from "./fold-chat-pivot.js";

const SRC = fs.readFileSync(new URL("./fold-chat-pivot.js", import.meta.url), "utf8");
const ASK = "I have a job offer that pays 30% more but I'd hate the work. Take it?";
const EIFFEL = [{ ref: "S1", source: "https://en.wikipedia.org/wiki/Eiffel_Tower", text: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is 330 metres tall. It was designed by the engineering firm of Gustave Eiffel and completed in 1889." }];

// "clean" = what nothing spoken may contain: markup, stock chat reflex, a figure nobody gave, a question barrage, a dangling fragment
const MARKUP = /(\*\*|__|`|^\s*[-*•]\s|^\s*\d+[.)]\s|^\s*#)/m;
const REFLEX = /(the person|sorry to hear|here's what i can tell|no easy answer|i'm here to listen|based on the information i have|hi there)/i;
function clean(text, { given = [] } = {}) {
  if (MARKUP.test(text) || REFLEX.test(text) || /!/.test(text)) return false;
  if ((text.match(/\?/g) || []).length > 1) return false;
  if ((text.match(/\d+/g) || []).some((n) => !given.includes(n))) return false;
  return !/[\p{L}]$/u.test(text.trim());   // ends with terminal punctuation, not a fragment
}

const BAD = {
  list: "Here's what I can tell you based on the information I have:\n\n* **Trust matters:** It builds the relationship.\n* **Honesty:** It is the right thing.\n\nIt's a complex question, and there's no easy answer.",
  reflex: "I'm so sorry to hear that! It sounds like a hard time. I'm here to listen. Would you like to talk about it? What happened? How are you feeling?",
  number: "Take the job. Studies show 73% of people regret turning down a raise, and the average gain is 12 percent over 5 years.",
  truncated: "Honesty builds trust and it matters in a long relationship. But",
  thirdPerson: "If the person had a strong financial need, the answer might change. The person should weigh it.",
};

test("a bad draft cannot reach the text, and the raw draft fails the same check (the pivot is the thing that makes it pass)", () => {
  for (const [name, draft] of Object.entries(BAD)) {
    assert.equal(clean(draft, { given: ["30"] }), false, `the raw ${name} draft must FAIL clean() — else the test is vacuous`);
    const pv = pivotText({ draft, ask: ASK, kind: "chat" });
    assert.equal(clean(pv.text, { given: ["30"] }) || pv.text === "", true, `${name} → ${JSON.stringify(pv.text)}`);
    assert.equal(verifyPivot(pv, draft).ok, true, `${name}: the realised text must re-derive from the draft`);
  }
});

test("markup becomes prose; a list becomes sentences; '!' becomes '.'; an emphasised lead-in is shed", () => {
  const draft = "**Remember:** Honesty builds trust!\n\n* It lets people rely on you.\n* It is the right thing to do.";
  const pv = pivotText({ draft, ask: "is honesty good", kind: "chat" });
  assert.equal(pv.text, "Honesty builds trust.\n\nIt lets people rely on you. It is the right thing to do.");
  const edits = pv.units.flatMap((u) => u.edits);
  assert.ok(edits.includes("terminal-exclamation") && edits.includes("list-to-prose") && edits.some((e) => e.startsWith("shed-label:")));
});

test("a figure nobody gave is withheld; a figure the person gave, or a source gave, is spoken", () => {
  const a = pivotText({ draft: "Take the job. Most people earn 12 percent more after 5 years.", ask: ASK });
  assert.equal(a.text, "Take the job.");
  assert.deepEqual(a.dropped.map((d) => d.why), ["number_not_given"]);
  const b = pivotText({ draft: "That is a 30% raise, which matters.", ask: ASK });
  assert.equal(b.text, "That is a 30% raise, which matters.");
  const c = pivotText({ draft: "The Eiffel Tower is 330 metres tall.", ask: "how tall is the eiffel tower", material: EIFFEL });
  assert.equal(c.text, "The Eiffel Tower is 330 metres tall.");
  assert.ok(c.units[0].support && /^S1#/.test(c.units[0].support), "a sourced sentence carries the address that witnesses it");
});

test("stock reflex and third-person phrasing are withheld, never reworded", () => {
  const pv = pivotText({ draft: "I'm so sorry to hear that. Honesty usually protects trust over time. If the person had a strong need, it might change.", ask: "x" });
  assert.equal(pv.text, "Honesty usually protects trust over time.");
  assert.deepEqual(pv.dropped.map((d) => d.why).sort(), ["boilerplate", "third_person"]);
});

test("questions: a lone closing question stays; two, or one that is not last, are withheld", () => {
  assert.equal(pivotText({ draft: "Honesty usually wins. What would change your mind?", ask: "x" }).text, "Honesty usually wins. What would change your mind?");
  assert.equal(pivotText({ draft: "Honesty usually wins. What happened? How do you feel?", ask: "x" }).text, "Honesty usually wins.");
  assert.equal(pivotText({ draft: "What happened? Honesty usually wins.", ask: "x" }).text, "Honesty usually wins.");
});

test("a draft cut off mid-sentence loses only its fragment; the fragment is never completed", () => {
  const pv = pivotText({ draft: "Honesty builds trust over time. Ultimately the decision is", ask: "x" });
  assert.equal(pv.text, "Honesty builds trust over time.");
  assert.deepEqual(pv.dropped.map((d) => d.why), ["truncated"]);
  assert.equal(pivotText({ draft: "Honesty builds trust over time.", ask: "x" }).dropped.length, 0, "a finished draft is not 'truncated'");
});

test("a connective that pointed at a withheld sentence is shed; one that points at a kept sentence stays", () => {
  const a = pivotText({ draft: "I'm so sorry to hear that. However, honesty usually protects trust.", ask: "x" });
  assert.equal(a.text, "Honesty usually protects trust.");
  assert.ok(a.units[0].edits.some((e) => e.startsWith("shed-connective:")) && a.units[0].edits.includes("initial-capital"));
  const b = pivotText({ draft: "Honesty usually protects trust. However, kindness matters too.", ask: "x" });
  assert.equal(b.text, "Honesty usually protects trust. However, kindness matters too.");
});

test("THE GEAR: the conversation is material — a follow-up that quotes the earlier answer is witnessed by it", () => {
  const convo = [{ ref: "earlier in this chat", source: "turn 1", text: "You asked: what is the capital of France? I answered: Paris is the capital of France and the Seine flows through it." }];
  const pv = pivotText({ draft: "Paris is the capital of France and the Seine flows through it.", ask: "quote your first answer", material: convo, requireGrounding: true });
  assert.ok(pv.units[0]?.support, "the earlier answer witnesses the quoted sentence (the gear)");
  // control: the SAME sentence against UNRELATED material is not witnessed (so the test is not vacuous)
  const ctl = pivotText({ draft: "Paris is the capital of France and the Seine flows through it.", ask: "quote your first answer", material: [{ ref: "S1", source: "x", text: "The Eiffel Tower is a wrought-iron lattice tower in Paris." }], requireGrounding: true });
  assert.equal(ctl.units[0]?.support ?? null, null, "unrelated material does not witness it");
});

test("a sourced turn withholds a sentence no source witnesses; a judgment turn is labelled as one", () => {
  const draft = "The Eiffel Tower stands in Paris, France. It was designed by Leonardo da Vinci. It was completed in 1889.";
  const pv = pivotText({ draft, ask: "tell me about the eiffel tower", material: EIFFEL });
  assert.equal(pv.standing, "sourced");
  assert.ok(!/Leonardo/.test(pv.text), "the invented designer is not spoken");
  assert.ok(/Paris/.test(pv.text) && /1889/.test(pv.text));
  assert.ok(pv.dropped.some((d) => d.why.startsWith("ungrounded:") && /Leonardo/.test(d.text)));
  const j = pivotText({ draft: "Honesty usually protects trust.", ask: "x" });
  assert.equal(j.standing, "judgment");
  assert.match(standingLine(j), /no sources/i);
  assert.match(standingLine(pv), /sources/i);
});

test("nothing survives → typed gap with empty text, never a half answer", () => {
  const pv = pivotText({ draft: "Hi there! I'm so sorry to hear that. Here's what I can tell you:", ask: "x" });
  assert.equal(pv.text, "");
  assert.equal(pv.gap.kind, "nothing_survived");
  assert.match(pivotLine(pv), /none could be spoken/);
});

test("no grammar for a language (read OR write side) → the draft comes back UNCHANGED, typed, and says it was not read", () => {
  const th = pivotText({ draft: "สวัสดีครับ ยินดีที่ได้รู้จัก", ask: "x", read: "th" });
  assert.equal(th.skipped, "no_grammar_for_language");
  assert.equal(th.text, "สวัสดีครับ ยินดีที่ได้รู้จัก");
  assert.match(pivotLine(th), /not read/);
  assert.equal(pivotText({ draft: "Hello there friend.", ask: "x", read: "en", write: "fr" }).skipped, "no_grammar_for_language", "a missing D grammar is as much a gap as a missing B grammar");
  assert.equal(grammarFor("en", "en") !== null, true);
  assert.deepEqual(Object.keys(GRAMMAR.read), Object.keys(GRAMMAR.write).filter((k) => k in GRAMMAR.read));
});

test("fenced code passes through verbatim and is recorded as not read", () => {
  const draft = "Use a loop.\n\n```python\nfor x in xs:\n    print(x)\n```\n\nThat prints each item.";
  const pv = pivotText({ draft, ask: "x", kind: "code" });
  assert.ok(pv.text.includes("```python\nfor x in xs:\n    print(x)\n```"));
  assert.equal(verifyPivot(pv, draft).ok, true);
  assert.ok(pv.events.some((e) => e.name === "code" && e.result === "passed-through"));
});

test("FALSIFIER of the checker: a realiser that invents or rewords a word fails verifyPivot", () => {
  const draft = "Honesty usually protects trust over time.";
  const pv = pivotText({ draft, ask: "x" });
  assert.equal(verifyPivot(pv, draft).ok, true);
  const invented = structuredClone(pv); invented.units[0].text += " Always."; invented.text += " Always.";
  assert.equal(verifyPivot(invented, draft).ok, false, "an added word must be caught");
  const reworded = structuredClone(pv); reworded.units[0].text = reworded.units[0].text.replace("protects", "safeguards"); reworded.text = reworded.units[0].text;
  assert.equal(verifyPivot(reworded, draft).ok, false, "a reworded word must be caught");
  const smuggled = structuredClone(pv); smuggled.text += " Smuggled words.";
  assert.equal(verifyPivot(smuggled, draft).ok, false, "text outside every unit must be caught");
});

test("the record: every sentence is SAID once and every verdict points at a said event; replaying the verdicts gives the spoken units", () => {
  const draft = "Honesty usually protects trust. I'm so sorry to hear that. Take the 40 offer.";
  const pv = pivotText({ draft, ask: "x" });
  const said = pv.events.filter((e) => e.kind === "said"), verdicts = pv.events.filter((e) => e.kind === "verdict");
  assert.equal(said.length, 3);
  assert.equal(verdicts.length, 3);
  assert.ok(verdicts.every((v) => said.some((s) => s.n === v.of)));
  assert.deepEqual(verdicts.filter((v) => v.keep).map((v) => said.find((s) => s.n === v.of).text), pv.units.map((u) => draft.slice(u.start, u.end)));
  assert.deepEqual(pv.dropped.map((d) => d.why), ["boilerplate", "number_not_given"]);
});

test("fuzz: whatever the stub says, the spoken text never carries markup, '!' or a fresh figure, and always re-derives", () => {
  const PIECES = ["**Bold:** claim here.", "* a bullet item.", "1. numbered item.", "Great question!", "It costs 99 dollars.", "Honesty matters.", "Why?", "# Heading", "I'm so sorry to hear that.", "Take the job.", "```js\nx\n```", "Studies show things.", "and then", "However, it depends."];
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 300; i++) {
    const parts = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => PIECES[Math.floor(rnd() * PIECES.length)]);
    // a fence is always on its own lines in a real draft (text glued to a fence line is code by Markdown's own rule)
    const draft = parts.reduce((acc, p, k) => (k === 0 ? p : acc + (p.includes("```") || parts[k - 1].includes("```") || rnd() < 0.5 ? "\n" : " ") + p), "");
    const pv = pivotText({ draft, ask: "should I take the job", kind: "chat" });
    const prose = pv.text.replace(/```[^]*?```/g, "");
    assert.equal(/(\*\*|__|^\s*[-*•]\s|^\s*\d+[.)]\s|^\s*#|!)/m.test(prose), false, JSON.stringify([draft, pv.text]));
    assert.equal(/\b99\b/.test(prose), false, "a figure nobody gave: " + JSON.stringify([draft, pv.text]));
    assert.equal(verifyPivot(pv, draft).ok, true, JSON.stringify([draft, pv.text, verifyPivot(pv, draft).bad]));
  }
});

test("the module owns no model and no network (the pivot reads; it never writes a word of its own)", () => {
  assert.ok(!/\b(fetch|XMLHttpRequest|client\.chat|callModel|WebSocket)\b/.test(SRC.replace(/\/\/.*$/gm, "")), "no I/O or model call in fold-chat-pivot.js");
});

test("storePivot / readUnits / plainOf are plain and total", () => {
  assert.equal(plainOf("**bold** and `code` and [a link](http://x.y)"), "bold and code and a link");
  assert.deepEqual(readUnits("").length, 0);
  const pv = pivotText({ draft: "I'm so sorry to hear that. Honesty matters.", ask: "x" });
  const st = storePivot(pv);
  assert.equal(JSON.parse(JSON.stringify(st)).stats.dropped, 1);
  assert.equal(st.dropped[0].why, "boilerplate");
});

test("a lead-in label line is withheld whatever its words; an invented attribution is withheld unless the sources said it", () => {
  const a = pivotText({ draft: "Here are some ideas:\nHonesty builds trust.", ask: "x" });
  assert.equal(a.text, "Honesty builds trust.");
  assert.deepEqual(a.dropped.map((d) => d.why), ["label"]);
  const b = pivotText({ draft: "Studies show honesty builds trust. According to experts, it matters.", ask: "x" });
  assert.equal(b.text, "");
  assert.deepEqual(b.dropped.map((d) => d.why), ["attribution", "attribution"]);
  const src = [{ ref: "S1", source: "https://example.org/r", text: "According to the report, sales rose in the spring and fell in autumn." }];
  const c = pivotText({ draft: "According to the report, sales rose in the spring.", ask: "how were sales", material: src });
  assert.match(c.text, /sales rose/, "an attribution the sources themselves carry is spoken");
});

test("a pronoun-led sentence that fails ONLY for thin evidence is checked with its witnessed antecedent; a bad term still withholds it", () => {
  const ok = pivotText({ draft: "The Eiffel Tower stands in Paris, France. It is 330 metres tall.", ask: "tell me about the eiffel tower", material: EIFFEL });
  assert.equal(ok.text, "The Eiffel Tower stands in Paris, France. It is 330 metres tall.");
  assert.ok(ok.events.some((e) => e.result === "witnessed-with-antecedent"));
  const bad = pivotText({ draft: "The Eiffel Tower stands in Paris, France. It is made of chocolate.", ask: "tell me about the eiffel tower", material: EIFFEL, strict: true });
  assert.equal(bad.text, "The Eiffel Tower stands in Paris, France.", "a term no source says is not rescued by an antecedent");
  const lone = pivotText({ draft: "It is 330 metres tall.", ask: "tell me about the eiffel tower", material: EIFFEL });
  assert.ok(!lone.events.some((e) => e.result === "witnessed-with-antecedent"), "no antecedent, no rescue");
});

test("the ask's own frame words are not a claim a source must make; only what follows the echo is held to the sources", () => {
  const ask = "What is the most notable fact about the Eiffel Tower?";
  const ok = pivotText({ draft: "The most notable fact about the Eiffel Tower is that it is a wrought-iron lattice tower on the Champ de Mars in Paris, France.", ask, material: EIFFEL });
  assert.match(ok.text, /^The most notable fact/, "a true answer is spoken whole, echo included");
  assert.ok(ok.events.some((e) => e.echoCut));
  const fabricated = pivotText({ draft: "The most notable fact about the Eiffel Tower is that it was built entirely from chocolate.", ask, material: EIFFEL, strict: true });
  assert.equal(fabricated.text, "", "a fabricated remainder after the echo is still withheld");
  const bare = pivotText({ draft: "The most notable fact about the Eiffel Tower is that.", ask, material: EIFFEL, strict: true });
  assert.equal(bare.text, "", "an echo with nothing after it earns no pass");
  const echoedClaim = pivotText({ draft: "Marie Curie is dead.", ask: "Is Marie Curie dead?", material: [{ ref: "S1", source: "x", text: "Marie Curie was a physicist and chemist who conducted pioneering research on radioactivity in Paris." }], strict: true });
  assert.equal(echoedClaim.text, "", "the ask's own claim, echoed back as a fact, is not witnessed by the ask (strict: withheld; default: spoken and marked unsourced)");
});

// ───────────── the real pathos archons (Murch pacing, Panini's experiencer, Abhinavagupta's pathosOf) ─────────────
const EXP = { who: "gemma2:2b", read: "chat-draft:test" };
const LONGLONG = "The tower stands on the Champ de Mars in Paris and was built for the 1889 World's Fair by the engineering firm of Gustave Eiffel over two years. It was meant to stand for twenty years and was nearly dismantled afterwards because its usefulness as a radio mast was only discovered later on. It is now among the most visited monuments in the world and appears on countless souvenirs. Still it endures. It is iron.";

test("pathos is read by the REAL organs for a DECLARED experiencer, recorded in the EOT, and a missing experiencer is a typed gap — never a default", () => {
  const pv = pivotText({ draft: "Honesty usually protects trust. It lets people rely on you. That matters over a long time.", ask: "x", experiencer: EXP });
  assert.equal(pv.felt.forWhom.who, "gemma2:2b");
  assert.ok(pv.felt.rhythm && typeof pv.felt.rhythm.n === "number" && pv.felt.curve.measured === false, "Murch's rhythm is read; the curve is a typed gap (no reader fold on this pipeline)");
  assert.ok(pv.events.some((e) => e.kind === "pathos" && e.forWhom === "gemma2:2b"));
  const none = pivotText({ draft: "Honesty usually protects trust.", ask: "x" });
  assert.equal(none.felt.gap, "no_experiencer");
  assert.equal(pivotText({ draft: "Honesty usually protects trust.", ask: "x", experiencer: { who: "", read: "" } }).felt.gap, "pathos_unreadable", "the organ's own refusal of an undeclared experiencer surfaces as a gap, not a crash");
});

test("pathos NEVER GATES: with or without an experiencer the same sentences are kept and the same words spoken; only whitespace may differ", () => {
  for (const [name, draft] of Object.entries(BAD)) {
    const a = pivotText({ draft, ask: ASK }), b = pivotText({ draft, ask: ASK, experiencer: EXP });
    assert.deepEqual(a.units.map((u) => u.text), b.units.map((u) => u.text), name);
    assert.equal(a.text.replace(/\s+/g, " "), b.text.replace(/\s+/g, " "), name);
  }
});

test("Murch's blink points set the paragraph breaks: the break falls AFTER the short landing, words untouched", () => {
  const pv = pivotText({ draft: LONGLONG, ask: "tell me about the tower built for the 1889 fair", experiencer: EXP });
  assert.ok(pv.felt.blinkPoints.length >= 1, "the organ finds a blink in long-long-long-SHORT");
  assert.ok(pv.felt.paragraphed?.length >= 1, "and the realiser acts on it");
  const paras = pv.text.split("\n\n");
  assert.equal(paras.length, 2, JSON.stringify(paras));
  const firstCount = paras[0].split(/(?<=[.!?])\s+/).length;
  assert.ok(pv.felt.blinkPoints.includes(firstCount - 1), "the paragraph ends exactly ON a sentence the organ called a blink: " + JSON.stringify([firstCount, pv.felt.blinkPoints]));
  assert.equal(pv.text.replace(/\s+/g, " "), LONGLONG.replace(/\s+/g, " "), "only whitespace changed");
  assert.equal(verifyPivot(pv, LONGLONG).ok, true);
  const flat = pivotText({ draft: "Honesty matters here. Trust matters here. Care matters here. Time matters here.", ask: "x", experiencer: EXP });
  assert.ok(!flat.felt.paragraphed, "a flat draft with no blink is not broken up");
});

test("a sentence with no words (an emoji, a bare mark) is withheld: it says nothing a source could witness", () => {
  const a = pivotText({ draft: "😊", ask: "who are you?" });
  assert.equal(a.text, ""); assert.deepEqual(a.dropped.map((d) => d.why), ["no_words"]); assert.equal(a.gap.kind, "nothing_survived");
  const b = pivotText({ draft: "Honesty usually protects trust. 😊", ask: "x" });
  assert.equal(b.text, "Honesty usually protects trust.");
  assert.equal(pivotText({ draft: "東京は日本の首都です。", ask: "x", read: "ja" }).skipped, "no_grammar_for_language", "non-Latin text is not 'no words': it has none of OUR grammar, which is a different, typed gap");
});

import { functionWordsOf } from "./fold-chat-snippets.js";
test("relevantPassages: a fallback page must share a CONTENT word of the ask with its title; 'who are you?' has none, so no album", () => {
  const fw = functionWordsOf("en");
  const pages = [{ ref: "en.wikipedia.org \u2014 Who Are You" }, { ref: "youtube.com \u2014 The Who - Who Are You (HQ)" }, { ref: "genius.com \u2014 Who Are You Lyrics" }];
  assert.deepEqual(relevantPassages(pages, "who are you?", fw), [], "every word of the ask is a closed-class word: nothing is relevant");
  const eiffel = [{ ref: "en.wikipedia.org \u2014 Eiffel Tower" }, { ref: "worldatlas.com \u2014 Great Wall of China" }, { ref: "x.org \u2014 Tomorrowland (film)" }];
  assert.deepEqual(relevantPassages(eiffel, "why was the Eiffel Tower built?", fw).map((p) => p.ref), ["en.wikipedia.org \u2014 Eiffel Tower"]);
  assert.deepEqual(relevantPassages(eiffel, "tell me about the great wall", fw).map((p) => p.ref), ["worldatlas.com \u2014 Great Wall of China"]);
  assert.deepEqual(relevantPassages([], "anything here", fw), []);
  assert.deepEqual(relevantPassages(eiffel, "", fw), []);
});

test("a pronoun-led sentence with NOTHING spoken before it is withheld, never spoken pointing at nothing", () => {
  const a = pivotText({ draft: "I'm so sorry to hear that. It lets people rely on you.", ask: "x" });
  assert.equal(a.text, "", "nothing was spoken for it to point at"); assert.ok(a.dropped.some((d) => d.why === "orphan_anaphor"));
  const b = pivotText({ draft: "They absorb water from the soil.", ask: "what is photosynthesis" });
  assert.equal(b.text, ""); assert.deepEqual(b.dropped.map((d) => d.why), ["orphan_anaphor"], "nothing before it to point at");
  const c = pivotText({ draft: "Honesty usually protects trust. It lets people rely on you.", ask: "x" });
  assert.equal(c.text, "Honesty usually protects trust. It lets people rely on you.", "a pronoun after a SPOKEN antecedent stays");
});

test("SOFT grounding (default): a sentence the pages read do not back is SPOKEN and marked unsourced; strict withholds it; HARD failures are withheld either way", () => {
  const draft = "The Eiffel Tower stands in Paris, France. It is made of chocolate.";
  const soft = pivotText({ draft, ask: "tell me about the eiffel tower", material: EIFFEL });
  assert.equal(soft.text, draft, "spoken whole");
  assert.equal(soft.stats.unsourced, 1);
  assert.equal(soft.units[1].unsourced !== undefined, true);
  assert.ok(soft.events.some((e) => e.result === "unsourced"));
  assert.equal(verifyPivot(soft, draft).ok, true);
  assert.match(pivotLine(soft), /1 marked unsourced/);
  const strict = pivotText({ draft, ask: "tell me about the eiffel tower", material: EIFFEL, strict: true });
  assert.equal(strict.text, "The Eiffel Tower stands in Paris, France.");
  assert.equal(strict.stats.unsourced, 0);
  // HARD: an invented NAME, an invented FIGURE and a stock phrase are withheld in the default mode too
  const hard = pivotText({ draft: "The Eiffel Tower stands in Paris, France. It was designed by Leonardo da Vinci. It attracts 7 million visitors. I'm so sorry to hear that.", ask: "tell me about the eiffel tower", material: EIFFEL });
  assert.equal(hard.text, "The Eiffel Tower stands in Paris, France.");
  assert.deepEqual(hard.dropped.map((d) => d.why.split(":")[0]).sort(), ["boilerplate", "number_not_given", "ungrounded"]);
  assert.deepEqual([...SOFT_WHY].sort(), ["no-overlap", "terms", "terms-elsewhere", "thin"]);
});
