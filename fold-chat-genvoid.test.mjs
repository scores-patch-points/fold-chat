// fold-chat-genvoid.test.mjs — the void for generated output: a failed WRITING request is a typed gap that names the
// thing asked for and what would unblock it; it is never a quote of the sources standing in for the piece.
// GENVOID_MODULE (env) points the whole file at a mutated copy (eval/ants/g2/mutate.mjs deletes one gate at a time).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const M = await import(process.env.GENVOID_MODULE || "./fold-chat-genvoid.js");
const { genVoid, isMetaAboutType, unusablePassage, topicQuery, topicIsMissing, judgeDraft, failureKind, normOutputType, strandFallbackAllowed, genVoidLabel, genVoidText } = M;

const ESSAY = { type: "essay", topic: "the telephone", constraints: {}, needsSources: true, voidIfMissing: [] };
const GOOD = [
  { ref: "Wikipedia — Telephone", url: "https://en.wikipedia.org/wiki/Telephone", text: "A telephone is a telecommunications device that permits two or more users to conduct a conversation when they are too far apart to be heard directly. Alexander Graham Bell was awarded the first U.S. patent for the invention of the telephone in 1876, and the device spread across the world over the following decades." },
  { ref: "NMS — Did Alexander Graham Bell invent the telephone?", url: "https://www.nms.ac.uk/x", text: "Bell patented the telephone in March 1876, but Antonio Meucci and Elisha Gray also have claims; the telephone's invention is contested, and the courts of the time sided with Bell." },
];
const META = [
  { ref: "leverageedu.com — Essay on Telephone in 100, 200, 300, and 500 Words", url: "https://leverageedu.com/discover/school-education/essay-on-telephone/", text: "Essay on Telephone in 100 words. The telephone is a useful device. To write an essay on the telephone, first start with an introduction, then the body, then the conclusion. Tips for writing a good essay: use a thesis statement, keep a word limit, and write your essay in simple words. Sample essay on telephone for class 5 students. Essay on telephone in 200 words." },
  { ref: "gradesfixer.com — Invention of Telephone - Telephone Topic Essay", url: "https://gradesfixer.com/free-essay-examples/invention-of-telephone/", text: "Free essay examples. Home — Essay Samples — Science — Telephone. Sample essay: in 1876 Alexander Graham Bell received a patent for the telephone. Our writers can write your essay. Order your essay now. Essay example, essay sample, essay topics." },
];
const fail = (o) => ({ outputType: ESSAY, question: "write me an essay on this", ...o });
const named = (g, type = "essay") => { assert.ok(g.void, "a void"); assert.equal(g.void.kind, "generate"); assert.equal(g.void.outputType, type); assert.match(g.notice.text, new RegExp(`I can't (write|make) the ${type}`)); assert.match(g.void.note, new RegExp(type)); };
const closed = (g) => { assert.ok(g.void.unblock.length >= 1, "unblock"); assert.ok(g.void.missing.length >= 1, "missing"); assert.notEqual(g.fallbackAllowed, true); assert.notEqual(g.fallbackAllowed, "strand"); assert.deepEqual(g.void.closeBy, g.void.unblock); };

// ── the output type ────────────────────────────────────────────────────────
test("normOutputType accepts the G1 shape, a bare string, and nothing; synonyms fold", () => {
  assert.equal(normOutputType("Blog").type, "blog post");
  assert.equal(normOutputType({ type: "Poetry" }).type, "poem");
  assert.equal(normOutputType({ type: "essay", topic: " x " }).topic, "x");
  assert.equal(normOutputType(null).type, "");
  assert.equal(normOutputType({ type: "image" }).unsupported, true);
  assert.equal(normOutputType({ type: "poem" }).needsSources, false);
  assert.equal(normOutputType({ type: "essay" }).needsSources, true);
  assert.equal(normOutputType({ type: "essay", needsSources: false }).needsSources, false);
});

test("topicIsMissing: empty, deictic and stop-word-only topics are no topic; a name is a topic", () => {
  for (const t of ["", "this", "That", "it", "the above", "the topic", "this one", "   ", "me", "the", "something"]) assert.equal(topicIsMissing(t), true, JSON.stringify(t));
  for (const t of ["the telephone", "invented telephone", "dolphins", "my sister's wedding", "Bell"]) assert.equal(topicIsMissing(t), false, t);
});

test("topicQuery searches the TOPIC, never the writing request", () => {
  assert.equal(topicQuery(ESSAY, "write essay invented telephone"), "the telephone");
  assert.equal(topicQuery({ type: "essay" }, "write essay invented telephone"), "invented telephone");
  assert.equal(topicQuery({ type: "essay" }, "write me an essay on this"), null);
  assert.equal(topicQuery({ type: "essay", topic: "this" }, "write me an essay on this"), null);
  assert.equal(topicQuery({ type: "poem" }, "write a poem about the sea"), "sea");
  assert.equal(topicQuery({ type: "cover letter" }, "write a cover letter"), null);
});

// ── pages about WRITING the thing ──────────────────────────────────────────
test("isMetaAboutType: the leverageedu essay page and a sample-essay page are meta; the encyclopedia is not", () => {
  const a = isMetaAboutType(META[0], ESSAY); assert.equal(a.meta, true); assert.equal(a.kind, "sample");
  const b = isMetaAboutType(META[1], ESSAY); assert.equal(b.meta, true);
  for (const p of GOOD) assert.equal(isMetaAboutType(p, ESSAY).meta, false, p.ref);
});
test("isMetaAboutType: a page about the type is not meta when the topic IS the type; another type's tutorial is not an essay tutorial", () => {
  const genre = { ref: "Wikipedia — Essay", url: "https://en.wikipedia.org/wiki/Essay", text: "An essay is, generally, a piece of writing that gives the author's own argument. Essays are commonly used as literary criticism. ".repeat(12) };
  assert.equal(isMetaAboutType(genre, { type: "essay", topic: "the telephone" }).meta, true);
  assert.equal(isMetaAboutType(genre, { type: "essay", topic: "the essay as a form" }).meta, false);
  assert.equal(isMetaAboutType(META[0], { type: "poem", topic: "the telephone" }).meta, false, "an essay tutorial is not a poem tutorial (and is not judged on the wrong type)");
});
test("isMetaAboutType: a how-to-write page of ANY form is meta unless the topic is in its title", () => {
  const eul = { ref: "How to Write a Eulogy: Steps, Tips, and Examples", url: "https://x.test/eulogy", text: "Start by gathering memories. You can write a draft. ".repeat(10) };
  assert.equal(isMetaAboutType(eul, { type: "speech", topic: "my grandfather" }).meta, true);
  assert.equal(isMetaAboutType(eul, { type: "speech", topic: "how to write a eulogy" }).meta, false);
});
test("isMetaAboutType: a how-to page that merely mentions the output once is not meta (no body points without the output's name x3)", () => {
  const house = { ref: "When Was My House Built? How to Find Out", url: "https://x.test/house", text: "You can check the deed. Step 1: ask the county. Order now a copy of the record from the office. Tips for finding out. You can write a letter to the clerk. ".repeat(6) };
  assert.equal(isMetaAboutType(house, { type: "essay", topic: "house history" }).meta, false);
});
test("isMetaAboutType: a service/generator page is meta (service); no output type means nothing is meta", () => {
  const svc = { ref: "Write My Essay | Essay Writing Service from $8/page", url: "https://papersowl.com/", text: "Order now. Our writers write your essay. Pay for essay. Essay help. " + "essay ".repeat(30) };
  const r = isMetaAboutType(svc, ESSAY); assert.equal(r.meta, true); assert.equal(r.kind, "service");
  assert.equal(isMetaAboutType(svc, {}).meta, false);
  assert.equal(isMetaAboutType(null, ESSAY).meta, false);
});

test("unusablePassage: meta, wall, off-topic and empty are set aside; an on-topic page is usable", () => {
  assert.equal(unusablePassage(GOOD[0], ESSAY).usable, true);
  assert.match(unusablePassage(META[0], ESSAY).why, /^meta-/);
  assert.equal(unusablePassage({ ref: "x", url: "https://b.test", text: "This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot." }, ESSAY).why, "wall");
  assert.equal(unusablePassage({ ref: "Coffee", url: "https://c.test", text: "Coffee is a beverage brewed from roasted coffee beans. It is among the most traded commodities in the world and is grown in many countries." }, ESSAY).why, "off-topic");
  assert.equal(unusablePassage({ ref: "", text: "" }, ESSAY).why, "empty");
  assert.equal(unusablePassage({ ref: "t", text: "too short" }, ESSAY).why, "empty");
});

// ── the model's reply, judged as the thing ─────────────────────────────────
const ESSAY_TEXT = ("The telephone changed how people speak across distance. Alexander Graham Bell patented it in 1876, and within a few decades the telephone had linked homes, offices and nations. ").repeat(8);
test("judgeDraft: a real-length essay on the topic passes", () => assert.equal(judgeDraft({ text: ESSAY_TEXT }, ESSAY).ok, true));
test("judgeDraft: empty, refusal, stub/teaser, question-back, tutorial and off-topic drafts each fail with their own reason", () => {
  assert.equal(judgeDraft({ text: "  " }, ESSAY).reason, "empty");
  assert.equal(judgeDraft({ text: "I'm sorry, but I cannot write an essay for you." }, ESSAY).reason, "refused");
  assert.equal(judgeDraft({ text: "As an AI, I can't help with that." }, ESSAY).reason, "refused");
  assert.equal(judgeDraft({ text: "Certainly, I'd be happy to help you write an essay on the telephone!" }, ESSAY).reason, "stub");
  assert.equal(judgeDraft({ text: "Here is your essay on the telephone:" }, ESSAY).reason, "stub");
  assert.equal(judgeDraft({ text: "What topic would you like the essay to cover? Could you tell me more about what you have in mind?" }, ESSAY).reason, "asked-instead");
  const tut = "How to Write an Essay\n\nStep 1: Start with an introduction. Step 2: Write your essay body with a topic sentence in each paragraph. Step 3: End with a conclusion. Tips for your essay: keep to the word limit, write a thesis statement, and sample essay structure helps. ".repeat(7);
  assert.equal(judgeDraft({ text: tut }, ESSAY).reason, "wrote-tutorial");
  const off = "Coffee is a brewed drink prepared from roasted beans. Brazil is the largest producer, and the drink is consumed worldwide in many forms every single day of the year. ".repeat(10);
  assert.equal(judgeDraft({ text: off }, ESSAY).reason, "off-topic-draft");
});
test("judgeDraft: length floors are per type and follow a stated word count", () => {
  assert.equal(judgeDraft({ text: "Autumn leaves fall\nsoft rain on the quiet road\nthe year exhales slow" }, { type: "haiku", topic: "autumn" }).ok, true);
  assert.equal(judgeDraft({ text: "Leaves." }, { type: "haiku", topic: "autumn" }).reason, "stub");
  const hundred = "The telephone ".repeat(2) + "rang ".repeat(70);
  assert.equal(judgeDraft({ text: hundred }, { ...ESSAY, constraints: { words: 100 } }).ok, true, "asked for 100 words: 72 is enough");
  assert.equal(judgeDraft({ text: hundred }, ESSAY).reason, "stub", "an essay with no stated length needs a floor");
  assert.equal(judgeDraft({ text: "<html><body>hi</body></html>" }, { type: "page", topic: "my bakery" }).reason, "stub");
  assert.equal(judgeDraft({ text: "<html><body><h1>My Bakery</h1><p>Fresh bread every morning, baked on the premises since 1998 with local flour.</p></body></html>" }, { type: "page", topic: "my bakery" }).ok, true);
});
test("judgeDraft: a poem need not mention the topic's every word, and a draft with no stated topic is not judged off-topic", () => {
  assert.equal(judgeDraft({ text: ESSAY_TEXT }, { type: "essay", topic: "" }).ok, true);
});

// ── how a failure reads ────────────────────────────────────────────────────
test("failureKind: every failure the page can throw lands on its own kind", () => {
  const cases = [[{ status: 0, message: "bridge unreachable: Failed to fetch" }, "network"], [{ message: "NetworkError when attempting to fetch resource" }, "network"], [{ status: 504, message: "x" }, "timeout"], [{ message: "request timed out" }, "timeout"],
    [{ status: 429, message: "x" }, "rate-limit"], [{ message: "rate limit exceeded" }, "rate-limit"], [{ status: 403, message: "safety gate" }, "gate"], [{ message: "refused by the ethics gate" }, "gate"],
    [{ status: 422, message: "the prompt was withheld before it reached the model (pii) — nothing was sent" }, "sealed"], [{ message: "no model — none is available" }, "no-model"], [{ name: "AbortError", message: "aborted" }, "stopped"], [{ message: "odd" }, "failed"], ["timeout", "timeout"]];
  for (const [f, k] of cases) assert.equal(failureKind(f), k, JSON.stringify(f));
  assert.equal(failureKind(null), null);
});

// ── the verdicts ───────────────────────────────────────────────────────────
test("THE SCREENSHOT: network error + only essay-writing pages — the void names the essay, sets the pages aside, and quotes nothing", () => {
  const g = genVoid(fail({ webPassages: META, failure: { status: 0, message: "bridge unreachable: Failed to fetch" } }));
  named(g); closed(g);
  assert.equal(g.reason, "network");
  assert.equal(g.fallbackAllowed, false, "no usable page, so not even an offer");
  assert.equal(g.void.setAside.length, 2);
  assert.ok(g.void.setAside.every((x) => /^meta-/.test(x.why)));
  assert.deepEqual(g.void.had, [], "it had no usable material, and says so");
  assert.ok(g.void.missing.some((m) => /draft/.test(m)) && g.void.missing.some((m) => /sources about/.test(m)));
  assert.match(g.notice.text, /network|reached/);
  assert.ok(!/Alexander Graham Bell|introduction, then the body/.test(JSON.stringify(g)), "no source passage is carried in the verdict");
});
test("a model failure WITH on-topic pages: never the strand as the essay; the strand is OFFERED as a separate, labelled act", () => {
  const g = genVoid(fail({ webPassages: GOOD, failure: { status: 0, message: "Failed to fetch" } }));
  named(g); closed(g);
  assert.equal(g.fallbackAllowed, "offer");
  assert.equal(g.offer.act, "show-sources"); assert.equal(g.offer.n, 2);
  assert.match(g.offer.label, /not an essay/);
  assert.equal(g.void.had.length, 2); assert.ok(g.void.had.every((h) => h.kind === "page" && h.note === "about the topic"));
  assert.equal(g.void.read.length, 2);
});
for (const [kind, f, re] of [["timeout", { status: 504, message: "timed out" }, /too long|timed out/], ["rate-limit", { status: 429, message: "x" }, /rate-limited/], ["gate", { status: 403, message: "safety gate said no" }, /declined/],
  ["sealed", { status: 422, message: "withheld before it reached the model (pii)" }, /withheld/], ["no-model", { message: "no model — none is available" }, /no model/]]) {
  test(`failure ${kind}: names the essay, what is missing, how to unblock; no strand`, () => {
    const g = genVoid(fail({ webPassages: GOOD, failure: f }));
    named(g); closed(g); assert.equal(g.reason, kind); assert.match(g.notice.text, re); assert.equal(g.notice.retry, !["gate", "sealed"].includes(kind), "a gate or a sealed wall says the same thing again unless the request changes");
    assert.notEqual(g.fallbackAllowed, true);
  });
}
test("Stop is the person's own act: no void", () => { const g = genVoid(fail({ webPassages: GOOD, failure: { name: "AbortError", message: "aborted" } })); assert.equal(g.ok, true); assert.equal(g.void, null); });
test("NO TOPIC: 'write me an essay on this' on an empty thread is a no-topic void, found before any search", () => {
  const g = genVoid({ outputType: { type: "essay", topic: "this" }, webPassages: [], question: "write me an essay on this" });
  named(g); closed(g); assert.equal(g.reason, "no-topic"); assert.match(g.notice.text, /points at nothing earlier in this chat/);
  assert.ok(g.void.unblock.some((u) => /name the topic/.test(u)));
  assert.equal(genVoid({ outputType: { type: "essay" } }).reason, "no-topic");
  assert.equal(genVoid({ outputType: { type: "essay", topic: "it" }, webPassages: GOOD }).reason, "no-topic", "pages do not rescue a missing topic");
});
test("NO USABLE SOURCES: zero pages / all meta / all walls / all off-topic are four different voids", () => {
  const none = genVoid(fail({ webPassages: [] })); named(none); closed(none); assert.equal(none.reason, "no-sources");
  const meta = genVoid(fail({ webPassages: META })); named(meta); closed(meta); assert.equal(meta.reason, "meta-only"); assert.match(meta.notice.text, /about writing an essay, not about/);
  const wall = genVoid(fail({ webPassages: [{ ref: "x", url: "https://b.test", text: "This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot." }] })); named(wall); assert.equal(wall.reason, "wall-only");
  const off = genVoid(fail({ webPassages: [{ ref: "Coffee", url: "https://c.test", text: "Coffee is a beverage brewed from roasted coffee beans. It is among the most traded commodities in the world and is grown in many countries." }] })); named(off); assert.equal(off.reason, "off-topic-only");
  for (const g of [none, meta, wall, off]) assert.equal(g.fallbackAllowed, false);
});
test("MIXED sources: the meta pages are set aside, the on-topic ones go on; the turn is fine", () => {
  const g = genVoid(fail({ webPassages: [...META, ...GOOD], modelResult: { text: ESSAY_TEXT, finish: "stop" } }));
  assert.equal(g.ok, true); assert.equal(g.void, null); assert.equal(g.passages.length, 2); assert.equal(g.setAside.length, 2);
});
test("the model's reply that is not the thing is a void naming the piece: empty / refused / stub / asked / tutorial / off-topic", () => {
  const texts = { empty: "", refused: "I'm sorry, but I cannot write that.", stub: "Certainly, I'd be happy to help you write an essay!", "asked-instead": "What topic would you like me to cover? Could you tell me more?" };
  for (const [reason, text] of Object.entries(texts)) { const g = genVoid(fail({ webPassages: GOOD, modelResult: { text } })); named(g); closed(g); assert.equal(g.reason, reason); assert.equal(g.notice.retry, true); }
  const r = genVoid(fail({ webPassages: GOOD, modelResult: { text: "I'm sorry, but I cannot write that." } })); assert.equal(r.void.said, "I'm sorry, but I cannot write that.", "what the model said is carried as data, not in the app's sentence");
  assert.ok(!r.notice.text.includes("cannot write that"));
  const stub = genVoid(fail({ webPassages: GOOD, modelResult: { text: "Certainly, I'd be happy to help you write an essay!" } })); assert.match(stub.void.note, /only \d+ words?/);
  assert.ok(stub.void.had.some((h) => h.kind === "draft"));
});
test("the output type: unsupported (an image), unknown (a widget), none", () => {
  const img = genVoid({ outputType: { type: "image", topic: "a dog" } }); assert.equal(img.reason, "unsupported-type"); assert.match(img.notice.text, /I can't make the image/); closed(img);
  const unk = genVoid({ outputType: { type: "widget", topic: "a dog" } }); assert.equal(unk.reason, "type-unknown"); assert.match(unk.notice.text, /widget/);
  const none = genVoid({ outputType: null }); assert.equal(none.reason, "type-unknown"); closed(none);
});
test("OWN TEXT required and missing: named; present: fine", () => {
  const ot = { type: "cover letter", topic: "my job application", needsSources: false, voidIfMissing: ["details"] };
  const g = genVoid({ outputType: ot }); named(g, "cover letter"); closed(g); assert.equal(g.reason, "own-text-missing"); assert.match(g.notice.text, /your own details/);
  assert.equal(genVoid({ outputType: ot, hasMaterial: true, modelResult: { text: "Dear Hiring Manager, I am writing to apply for the role. ".repeat(10) } }).ok, true);
  const s = genVoid({ outputType: { type: "summary", topic: "", needsSources: false, voidIfMissing: ["own-text"] } }); assert.match(s.notice.text, /the text you are working from/);
});
test("ALONE-BARRED: a lane that may not speak alone, with nothing to write from, says so by name", () => {
  const g = genVoid({ outputType: { type: "poem", topic: "the sea", needsSources: false }, barred: "alone" });
  named(g, "poem"); closed(g); assert.equal(g.reason, "alone-barred");
  assert.equal(genVoid({ outputType: { type: "poem", topic: "the sea", needsSources: false }, barred: "alone", hasMaterial: true, modelResult: { text: "The sea is wide and grey\nand the gulls cry over it\nwhile the tide goes out slowly" } }).ok, true);
});
test("a poem needs no sources: with a real poem it is not a void; with a model failure it is", () => {
  const poem = { type: "poem", topic: "the sea" };
  assert.equal(genVoid({ outputType: poem, webPassages: [], modelResult: { text: "Waves fold over stone\nsalt wind carries the gulls' cries\nthe tide takes its time" } }).ok, true);
  const g = genVoid({ outputType: poem, webPassages: [], failure: { status: 0, message: "Failed to fetch" } }); named(g, "poem");
  assert.ok(!g.void.missing.some((m) => /sources about/.test(m)), "a poem is not missing sources");
});
test("CONTROLS: successful generate turns are never a void", () => {
  const ok = [
    [{ ...ESSAY }, GOOD, ESSAY_TEXT],
    [{ type: "essay", topic: "the telephone" }, [...META, ...GOOD], ESSAY_TEXT],
    [{ type: "poem", topic: "autumn" }, [], "Leaves let go, one by one\nthe orchard hums with wasps and rain\nthe year turns over in its sleep"],
    [{ type: "haiku", topic: "autumn" }, [], "Leaves fall quietly\nthe old pond keeps its silence\nautumn holds its breath"],
    [{ type: "report", topic: "solar power" }, [{ ref: "Solar power", url: "https://en.wikipedia.org/wiki/Solar_power", text: "Solar power is the conversion of energy from sunlight into electricity, either directly using photovoltaics or indirectly using concentrated solar power. " + "Solar power capacity grew quickly. ".repeat(6) }], "Solar power converts sunlight into electricity. ".repeat(40)],
    [{ type: "list", topic: "fruit", needsSources: false }, [], "- apples\n- pears\n- plums\n- figs\n- grapes\n- limes\n- dates\n- kiwis"],
    [{ type: "email", topic: "a delayed shipment", needsSources: false }, [], "Hello, my order was due on Monday and has not arrived. Could you tell me where it is and when it will come? I paid for express delivery and need it before the weekend. Thank you for your help."],
    [{ type: "page", topic: "my bakery", needsSources: false }, [], "<html><body><h1>My Bakery</h1><p>Fresh bread every morning, baked on the premises with local flour.</p></body></html>"],
  ];
  for (const [ot, pages, text] of ok) { const g = genVoid({ outputType: ot, webPassages: pages, modelResult: { text, finish: "stop" } }); assert.equal(g.ok, true, ot.type); assert.equal(g.void, null); assert.equal(g.notice, null); assert.equal(g.fallbackAllowed, null); }
});
test("genVoid never throws and never returns a true fallback, whatever it is given", () => {
  for (const arg of [undefined, {}, { outputType: 5 }, { outputType: { type: "essay", topic: "x" }, webPassages: "no", failure: 7, modelResult: 3 }, { outputType: { type: "essay", topic: "x" }, webPassages: [null, {}, 3] }]) {
    const g = genVoid(arg); assert.ok(g && typeof g.ok === "boolean"); assert.notEqual(g.fallbackAllowed, true);
  }
});
test("the strand may not stand in for a written output (generate and compose); other kinds keep their fallback", () => {
  assert.equal(strandFallbackAllowed("generate"), false); assert.equal(strandFallbackAllowed("compose"), false);
  for (const k of ["research", "chat", "advice"]) assert.equal(strandFallbackAllowed(k), true);
});
test("label and one-line text for the Process panel; the verdict carries no assistant prose field", () => {
  const g = genVoid(fail({ webPassages: META, failure: { status: 0, message: "Failed to fetch" } }));
  assert.equal(genVoidLabel(g.void), "can't write the essay"); assert.match(genVoidText(g.void), /^⟂ void — I can't write the essay: /); assert.match(genVoidText(g.void), /Missing: /);
  assert.equal(genVoidLabel({ kind: "live" }), ""); assert.equal(genVoidText(null), "");
  assert.equal(genVoidLabel(genVoid({ outputType: { type: "image", topic: "x" } }).void), "can't make the image");
});

// ── tests added after the first mutation pass left these gates unkilled ─────
test("failureKind: the STATUS alone decides when the message says nothing (403 gate, 422 sealed, 429, 504, 0)", () => {
  assert.equal(failureKind({ status: 403, message: "x" }), "gate");
  assert.equal(failureKind({ status: 422, message: "x" }), "sealed");
  assert.equal(failureKind({ status: 429, message: "x" }), "rate-limit");
  assert.equal(failureKind({ status: 504, message: "x" }), "timeout");
  assert.equal(failureKind({ status: 0, message: "x" }), "network");
  assert.equal(failureKind({ status: 500, message: "x" }), "failed");
});
test("judgeDraft: a long preamble that ends on a colon is still a teaser, not the piece", () => {
  const pre = "Certainly, I'd be happy to help you write an essay on the telephone. " + "I will cover its invention, its spread and its effect on daily life, drawing on what is known about the telephone.\n\n".repeat(11) + "Here is the essay:";
  assert.ok(pre.split(/\s+/).length >= 120, "long enough to pass the floor on length alone");
  assert.equal(judgeDraft({ text: pre }, ESSAY).reason, "stub");
});
test("isMetaAboutType: a topical title (no output name, no cue) outweighs heavy body cues", () => {
  const page = { ref: "Michel de Montaigne", url: "https://x.test/montaigne", text: "Montaigne wrote essays. ".repeat(40) + "You should write your essay on Montaigne; you can start with his essay on friendship; step 1: read the essays. Tips for your essay. Sample essay on Montaigne. ".repeat(6) };
  assert.equal(isMetaAboutType(page, { type: "essay", topic: "Montaigne" }).meta, false);
  assert.equal(isMetaAboutType({ ...page, ref: "Untitled" }, { type: "essay", topic: "Montaigne" }).meta, true, "the same body without the topical title is a tutorial: the title is what separates them");
});
test("isMetaAboutType: body cues count only when the page names the output at least 3 times", () => {
  const generic = "You can check the deed. Step 1: ask the county. Tips for finding out. Order now a copy of the record. Step-by-step. You can write down the number. ".repeat(6) + "An essay is mentioned here. Another essay is mentioned here.";
  assert.equal(isMetaAboutType({ ref: "Archive help", url: "https://x.test/records", text: generic }, { type: "essay", topic: "records" }).meta, false);
  assert.equal(isMetaAboutType({ ref: "Archive help", url: "https://x.test/records", text: generic.replace("Another essay is mentioned here.", "Another essay is mentioned here. A third essay is here.") }, { type: "essay", topic: "records" }).meta, true, "named three times, the same how-to body is about writing");
});
test("isMetaAboutType: an address that names the output with a sample cue counts (+3) when the title says nothing", () => {
  const p = { ref: "Telephone", url: "https://x.test/free-essay-examples/telephone", text: "The telephone carries voices. This essay example covers the telephone. Another essay about the telephone. A third essay. ".repeat(6) };
  assert.equal(isMetaAboutType(p, { type: "essay", topic: "the telephone" }).meta, true);
  assert.equal(isMetaAboutType({ ...p, url: "https://x.test/telephone" }, { type: "essay", topic: "the telephone" }).meta, false);
});
test("isMetaAboutType: a borderline page (score 1-3) is NOT meta — the threshold is 4", () => {
  const p = { ref: "Tips for sleeping better", url: "https://x.test/sleep", text: "Sleep matters. An essay by a doctor says sleep matters more than diet. ".repeat(3) };
  const r = isMetaAboutType(p, { type: "essay", topic: "sleep" }); assert.ok(r.score >= 1 && r.score < 4, "score " + r.score); assert.equal(r.meta, false);
  assert.equal(isMetaAboutType(p, { type: "essay", topic: "sleep" }, { threshold: 1 }).meta, true, "the threshold is the only thing deciding it");
});
test("isMetaAboutType judges only declared output types: an unknown type is never meta", () => {
  const w = { ref: "How to build a widget: steps, tips and examples", url: "https://x.test/how-to-build-a-widget", text: "A widget is a widget. You can build a widget. Widget tips. ".repeat(20) };
  assert.equal(isMetaAboutType(w, { type: "widget", topic: "birds" }).meta, false);
});
test("topicIsMissing: multi-word deictics ('the above', 'that answer', 'the last answer') are no topic", () => {
  for (const t of ["the above", "that answer", "the last answer", "what you said", "the previous"]) assert.equal(topicIsMissing(t), true, t);
});

test("isMetaAboutType: a service wording alone does not make a page about the output when the page never names it", () => {
  const p = { ref: "Help desk", url: "https://x.test/essay-tips/help", text: "Order now. Pay for the service. Our writers are ready. Place an order today. ".repeat(8) };
  assert.equal(isMetaAboutType(p, { type: "essay", topic: "records" }).meta, false);
});

test("topicQuery drops a stated length and an unsupported output's name from the search words", () => {
  assert.equal(topicQuery({ type: "essay" }, "write a 300 word essay on the telephone"), "telephone");
  assert.equal(topicQuery({ type: "image" }, "make me an image of a dog"), "dog");
});
test("outputTypeFromAsk: the fallback when no classifier gave a type — type, topic, stated length, own-text need", () => {
  const { outputTypeFromAsk } = M;
  assert.deepEqual([outputTypeFromAsk("write me an essay on this").type, outputTypeFromAsk("write me an essay on this").topic], ["essay", "this"]);
  assert.equal(outputTypeFromAsk("write me an essay on this", { topic: "invented telephone" }).topic, "invented telephone");
  assert.equal(outputTypeFromAsk("write a 300 word essay on the telephone").constraints.words, 300);
  assert.equal(outputTypeFromAsk("write a cover letter").type, "cover letter");
  assert.equal(outputTypeFromAsk("make me an image of a dog").unsupported, true);
  assert.equal(outputTypeFromAsk("write a summary of this").voidIfMissing[0], "own-text");
  assert.equal(outputTypeFromAsk("write a summary of this", { hasMaterial: true }).voidIfMissing.length, 0);
  assert.equal(outputTypeFromAsk("write me something").type, "");
  assert.equal(outputTypeFromAsk("write a blog post about sourdough").type, "blog post");
});
test("withheld: a draft the Pivot could not trace to anything read is a void, not a quote of the sources", () => {
  const g = genVoid(fail({ webPassages: GOOD, failure: { kind: "withheld" } }));
  named(g); closed(g); assert.equal(g.reason, "withheld"); assert.match(g.notice.text, /none of it is shown/); assert.equal(g.void.retry, true); assert.equal(g.fallbackAllowed, "offer");
  assert.equal(failureKind("withheld"), "withheld");
});
test("void.retry: a plain retry is offered where it can change the outcome, never for a gate, a seal, a missing topic, text or type", () => {
  const yes = [fail({ failure: { status: 0, message: "x" } }), fail({ webPassages: [] }), fail({ webPassages: GOOD, modelResult: { text: "" } })];
  for (const a of yes) assert.equal(genVoid(a).void.retry, true, genVoid(a).reason);
  const no = [fail({ failure: { status: 403, message: "x" } }), fail({ failure: { status: 422, message: "x" } }), { outputType: { type: "essay", topic: "this" } }, { outputType: { type: "image", topic: "x" } }, { outputType: { type: "cover letter", needsSources: false, voidIfMissing: ["details"] } }, { outputType: null }];
  for (const a of no) assert.equal(genVoid(a).void.retry, false, genVoid(a).reason);
  const g = genVoid(fail({ failure: { status: 0, message: "x" } })); assert.equal(g.notice.retry, g.void.retry);
});

test("an offer rides inside the void (the gap block draws it), and genVoidLine names the thing", () => {
  const g = genVoid(fail({ webPassages: GOOD, failure: { status: 0, message: "x" } }));
  assert.equal(g.void.offer.act, "show-sources"); assert.deepEqual(g.void.offer, g.offer);
  assert.equal(M.genVoidLine(g.void), "No essay was written."); assert.equal(M.genVoidLine({ kind: "live" }), "");
  assert.equal(genVoid(fail({ webPassages: META, failure: { status: 0, message: "x" } })).void.offer, undefined, "no usable page: nothing to offer");
});

test("topicQuery drops the pointing word that rode along with a carried referent ('… write me an essay on this')", () => {
  assert.equal(topicQuery({ type: "essay" }, "History of the telephone The Telephone Cases write me an essay on this"), "History telephone Telephone Cases");
  assert.equal(topicQuery({ type: "essay" }, "write me an essay on this"), null);
});

test("G1's shape: genVoidShape(desc, KNOWN_FORMS) reaches the right void for an image, a summary with no text, no topic, and a length given as {n, unit}", async () => {
  const { describeOutput, genVoidShape } = await import("./fold-chat-outputtype.js");
  const shape = (q, prior = []) => genVoidShape(describeOutput(q, { prior, hasMaterial: false }), M.KNOWN_FORMS);
  const img = genVoid({ outputType: shape("make me an image of a dog"), question: "x" }); assert.equal(img.reason, "unsupported-type"); assert.match(img.notice.text, /I can't make the image/);
  const sum = genVoid({ outputType: shape("write a summary of this"), question: "x" }); assert.equal(sum.reason, "own-text-missing");
  const nt = genVoid({ outputType: shape("write me an essay on this"), question: "x" }); assert.equal(nt.reason, "no-topic");
  const hundred = "The telephone " + "rang ".repeat(70);
  assert.equal(genVoid({ outputType: shape("write a 100 word essay on the telephone"), webPassages: GOOD, modelResult: { text: hundred } }).ok, true, "length {n:100, unit:'words'} lowers the floor");
  assert.equal(genVoid({ outputType: shape("write an essay on the telephone"), webPassages: GOOD, modelResult: { text: hundred } }).reason, "stub");
  assert.ok(M.KNOWN_FORMS.image && M.KNOWN_FORMS.haiku);
});

test("G1's bare family 'other' (an unsupported form with the form lost) is still an unsupported-type void, never 'I can't write the other'", () => {
  const g = genVoid({ outputType: { type: "other", topic: "a dog", needsSources: false, voidIfMissing: ["unsupported-type"] }, question: "x" });
  assert.equal(g.reason, "unsupported-type"); assert.doesNotMatch(g.notice.text, /\bother\b/); closed(g);
  const g2 = genVoid({ outputType: { type: "other", form: "image", topic: "a dog", voidIfMissing: [{ gap: "unsupported-type", active: true, form: "image" }] }, question: "x" });
  assert.match(g2.notice.text, /I can't make the image/);
  const none = genVoid({ outputType: { type: "none" }, question: "x" }); assert.equal(none.reason, "type-unknown"); assert.doesNotMatch(none.notice.text, /“none”/);
});
