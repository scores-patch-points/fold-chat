// fold-chat-outputtype.test.mjs — what output does a turn ask for? Each gate in fold-chat-outputtype.js has a test here that FAILS when the gate is
// removed (eval/ants/g1/mutate.mjs deletes each gate in turn and runs this file against the mutant: OT_PATH points at the module under test).
// The frozen corpora of eval/ants/g1 (rounds 1-5, 371 phrasings) are pinned as a regression gate at the bottom.

import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const OT = process.env.OT_PATH ? pathToFileURL(path.resolve(process.env.OT_PATH)).href : new URL("./fold-chat-outputtype.js", import.meta.url).href;
const { describeOutput, voidsAfterSearch, isWritingGuide, genVoidShape, kindOfOutput, pickType, constraintsOf, subjectOfAsk, TYPES } = await import(OT);

const TEL = [{ role: "user", content: "who invented the telephone?" }, { role: "assistant", content: "Alexander Graham Bell is credited with inventing the telephone in 1876." }];
const d = (q, o) => describeOutput(q, o);
const types = (qs, o) => qs.map((q) => d(q, o).type);

test("THE FAILURE: after a question, 'write me an essay on this' is an essay about the telephone — the topic is searched, never the instruction", () => {
  const r = d("write me an essay on this", { prior: TEL });
  assert.equal(r.type, "essay");
  assert.equal(r.topicVia, "thread-ask");
  assert.match(r.topic, /telephone/i);
  assert.equal(r.needsSources, true);
  assert.equal(r.searchQuery, "who invented the telephone");
  assert.doesNotMatch(r.searchQuery, /write|essay/i);
  assert.deepEqual(r.voidIfMissing.map((g) => g.gap), ["nothing-found"], "nothing is missing now; whether the search finds something is known only after it");
});

test("the taxonomy is closed and the module never invents a type", () => {
  assert.ok(TYPES.includes("none") && TYPES.includes("rewrite"));
  for (const q of ["write a poem about the sea", "tell me a joke", "write a function to reverse a string in Python", "translate 'good morning' into French", "summarize the French Revolution", "hi", "who wrote Howl"]) assert.ok(TYPES.includes(d(q).type), q);
});

test("each type is read from the noun, in the person's own language", () => {
  assert.deepEqual(types(["write an essay about dolphins", "write a poem about the sea", "write a story about a dragon", "write an email to my boss", "write a cover letter for a marketing job", "write a speech on climate change",
    "summarize the French Revolution", "make an outline for a talk on renewable energy", "make a table of the planets", "list five causes of the Great Depression", "write a function to reverse a string in Python",
    "write a tagline for my bakery", "write a dialogue between a cat and a dog", "tell me a joke"]),
    ["essay", "poem", "story", "email", "letter", "speech", "summary", "outline", "table", "list", "code", "slogan", "script", "other"]);
  assert.deepEqual(types(["escribe un ensayo sobre los delfines", "écris un poème sur la mer", "напиши эссе о дельфинах", "schreibe einen aufsatz über delfine", "写一篇关于海豚的文章", "hazme un resumen de la revolución francesa", "rédige une lettre de motivation pour un poste de vendeur"]),
    ["essay", "poem", "essay", "essay", "essay", "summary", "letter"]);
});

test("typos: one edit, never the first or last letter, never a real near-word", () => {
  assert.equal(d("wrtie an esay on teh telephone").type, "essay");
  assert.equal(d("pls write an emial to my teacher saying im sick").type, "email");
  assert.equal(d("wrtie a pome about autumn").type, "poem");
  assert.equal(d("write a better essay on dolphins").type, "essay", "'better' is one edit from 'letter' — the first letter is never edited, so it stays a modifier");
  assert.equal(d("write a cable about bridges").type, "none", "'cable' is one edit from 'table'; the first letter differs");
  assert.equal(d("I wrote a poem yesterday and it was bad").type, "none", "'wrote' is one edit from 'write'");
  assert.equal(d("she composed a letter last year").type, "none", "'composed' is the verb plus a suffix, not a typo of 'compose'");
});

// ── G1 question-frame, reported requests, declarations, capability questions ──────────────────────────────────────────
test("G1 a question about writing is not a request to write", () => {
  for (const q of ["how do I write an essay", "who wrote the poem Howl", "what is an essay", "why did he write the letter", "how to write a cover letter", "is it ok to write in first person in an essay", "do you write poems?", "who composed the Moonlight Sonata"]) assert.equal(d(q).type, "none", q);
  assert.equal(d("can you write me an essay on the French Revolution please").type, "essay", "'can you' is a polite request, not a question frame");
});
test("G1 only the verb's own sentence counts", () => {
  assert.equal(d("My sister is getting married next month. Can you write a toast?").type, "speech");
  assert.equal(d("I have a presentation tomorrow. What should I include? Write me an outline on climate policy.").type, "outline");
});
test("G1b a reported request is somebody else's", () => {
  assert.equal(d("she asked me to write her a letter").type, "none");
  assert.equal(d("my teacher told me to write an essay on Hamlet, any ideas how to start?").type, "none");
});
test("G1c a first-person declaration is not a request unless it wants or needs", () => {
  assert.equal(d("I will draft the report tomorrow").type, "none");
  assert.equal(d("I could write one if you want").type, "none");
  assert.equal(d("I would like you to write an essay on volcanoes").type, "essay");
  assert.equal(d("i need to write an essay on volcanoes").type, "essay");
  assert.equal(d("I want a really good essay on dolphins").type, "essay", "a want-lead tolerates up to three modifiers before the noun");
  assert.equal(d("I need a doctor for my essay on Hamlet").type, "none", "…but not a different noun phrase in between");
});
test("G1d negation before the verb", () => {
  assert.equal(d("please don't write a long essay").type, "none");
  assert.equal(d("Don't write anything yet").type, "none");
  assert.equal(d("I can't write today, my hand hurts").type, "none");
  assert.equal(d("should I draft the email before the meeting").type, "none");
});
test("G8 'can you write essays?' asks what the fold can do; it asks for no piece", () => {
  assert.equal(d("hello, can you write essays?").type, "none");
  assert.equal(d("can you write an essay on dolphins?").type, "essay");
});

// ── G2 between-words, G3 particle, G4 existing work ───────────────────────────────────────────────────────────────────
test("counted nouns are a list only when counted: 'give me tips' is advice, '5 slogans' is a list", () => {
  assert.equal(d("Give me tips to fall asleep faster").type, "none");
  assert.equal(d("I need ideas").type, "none");
  assert.equal(d("give me 10 baby names").type, "list");
  assert.equal(d("give me five reasons to learn Spanish").type, "list");
  assert.equal(kindOfOutput(d("give me 5 tips to sleep better")), null, "counted advice is still ADVICE");
});
test("G2 a pronoun or 'sure' between the verb and the noun is not an object", () => {
  assert.equal(d("make sure you note that I'm allergic to nuts").type, "none");
  assert.equal(d("make a note to call mom").type, "letter", "documented limit: 'make a note' is read as a note");
});
test("G3 'write down / off / back' is not a request for a piece", () => {
  assert.equal(d("I need to write down my passwords").type, "none");
  assert.equal(d("write down that I'm out of milk").type, "none");
  assert.equal(d("write down the poem I just thought of").type, "none", "without the particle gate 'poem' would be found a few words later");
  assert.equal(d("write a poem I just thought of").type, "poem");
  assert.equal(d("document.write is deprecated").type, "none");
});
test("G4 a retrieval lead + 'the' + a noun + a Title is a lookup of a work that exists", () => {
  assert.equal(d("give me the poem Ozymandias").type, "none");
  assert.equal(d("give me a poem about the sea").type, "poem");
  assert.equal(d("where can I read the essay Self-Reliance").type, "none");
});

// ── G5 code first ─────────────────────────────────────────────────────────────────────────────────────────────────────
test("G5 a programming ask is code before anything else — and 'write a poem about python' is a poem", () => {
  assert.equal(d("write a function to reverse a string in Python").type, "code");
  assert.equal(d("how do I write a function in Go?").type, "code");
  assert.equal(d("write a sql query to find duplicate emails").type, "code");
  assert.equal(d("write a poem about python").type, "poem");
  assert.equal(d("write a poem about a function").type, "poem");
  assert.equal(d("write a script for a youtube video").type, "script");
  assert.equal(d("write a script that renames files").type, "code");
  assert.equal(kindOfOutput(d("create a landing page for my bakery")), "generate", "a page / app is the fold's own HTML build, not a code card");
  assert.equal(kindOfOutput(d("write a python script that renames files")), "code");
});

// ── G6 the thread ─────────────────────────────────────────────────────────────────────────────────────────────────────
test("G6 'this / it / that / the above / about it' is resolved through the thread or is a typed gap", () => {
  for (const q of ["write me an essay on this", "write an essay about it", "write an essay on that", "write an essay about the above"]) { const r = d(q, { prior: TEL }); assert.match(r.topic, /telephone/i, q); assert.equal(r.type, "essay"); }
  assert.match(d("write a poem about this", { prior: TEL }).topic, /telephone/i);
  assert.equal(d("make it an essay", { prior: TEL }).type, "essay");
  assert.match(d("turn this into a poem", { prior: TEL }).topic, /telephone/i);
  assert.match(d("convert that into a table", { prior: TEL }).topic, /telephone/i);
  const none = d("write an essay on this");
  assert.equal(none.topic, null);
  assert.deepEqual(none.voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["no-topic"], "nothing earlier in the chat says what 'this' is");
});
test("G6 an earlier request for output donates its own topic; a one-word fragment ('when?') is not a subject", () => {
  const MOON = [{ role: "user", content: "write a poem about the moon" }, { role: "assistant", content: "Silver coin on a velvet sky." }];
  assert.match(d("now an essay about it", { prior: MOON }).topic, /moon/i);
  assert.equal(d("now an essay about it", { prior: MOON }).topicVia, "thread-request");
  const WHEN = [...TEL, { role: "user", content: "when?" }, { role: "assistant", content: "Bell was granted the patent in 1876." }];
  assert.match(d("write an essay about this", { prior: WHEN }).topic, /telephone/i);
});
test("the person's own text is the material: inline, attached, or the last answer", () => {
  assert.equal(d("Rewrite this to sound more formal: hey can u send me the file asap thx").material, "inline");
  assert.equal(d("summarize this document", { hasMaterial: true }).material, "attached");
  assert.equal(d("summarize this", { prior: TEL }).material, "thread-answer");
  assert.equal(d("translate this into Spanish", { prior: TEL }).material, "thread-answer");
  const bare = d("translate this into Spanish");
  assert.deepEqual(bare.voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["no-material"]);
  assert.equal(d("make this shorter", { hasMaterial: true }).material, "attached");
  assert.deepEqual(d("make this shorter").voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["no-material"]);
});
test("a NAMED text is a topic, not material: 'summarize the French Revolution' is searched", () => {
  const r = d("summarize the French Revolution");
  assert.equal(r.needsSources, true); assert.match(r.searchQuery, /French Revolution/); assert.equal(r.material, null);
  assert.equal(kindOfOutput(r), "research");
  assert.equal(kindOfOutput(d("Translate Hamlet into French")), "research");
  assert.equal(kindOfOutput(d("Summarize: causes of World War 1")), "research");
});

// ── needsSources ──────────────────────────────────────────────────────────────────────────────────────────────────────
test("needsSources: an essay on a fact grounds; a poem, a joke, a rewrite, personal writing and code do not", () => {
  const ns = (q, o) => d(q, o).needsSources;
  for (const q of ["write an essay about dolphins", "write a report on the 2008 financial crisis", "write a speech on climate change for a school assembly", "write a letter about the extinction of dolphins to my congressman"]) assert.equal(ns(q), true, q);
  for (const q of ["write a poem about the sea", "tell me a joke", "write a short story about a dragon", "write a tagline for my bakery", "write an email to my boss asking for a day off", "draft a message to my landlord about the heating",
    "write a speech for my sister's wedding", "write an essay about my summer vacation", "write a cover letter for a marketing job", "write a function to reverse a string in Python", "Rewrite this to sound more formal: hey can u send me the file asap thx", "write a story about the French Revolution"]) assert.equal(ns(q), false, q);
  assert.equal(d("write a poem about the sea").searchQuery, null);
});

// ── constraints, topic cleaning ───────────────────────────────────────────────────────────────────────────────────────
test("constraints are read and cut out of the topic", () => {
  const a = d("Write a 500 word essay on the causes of World War 1");
  assert.deepEqual(a.constraints.length, { n: 500, unit: "words" }); assert.equal(a.topic, "the causes of World War 1");
  const b = d("write a persuasive essay on school uniforms for 5th graders");
  assert.equal(b.constraints.tone, "persuasive"); assert.equal(b.constraints.audience, "5th graders"); assert.equal(b.topic, "school uniforms");
  assert.equal(d("write a poem about the sea in Spanish").constraints.language, "spanish");
  assert.equal(d("give me 5 slogans for a coffee shop").constraints.count, 5);
  assert.equal(d("write a three paragraph essay on volcanoes").constraints.length.n, 3);
  assert.equal(d("write a formal 200 word cover letter in French for a nursing job").constraints.language, "french");
  assert.deepEqual(constraintsOf("write 500 words about x").c.length, { n: 500, unit: "words" });
});
test("subjects are read through the noun's own prepositions: 'between', 'for', 'where', 'comparing', 'of'", () => {
  assert.match(d("write a dialogue between a pirate and a parrot").topic, /pirate/);
  assert.match(d("write a cover letter for a job as a nurse").topic, /nurse/);
  assert.match(d("make a table comparing iphone and android").topic, /iphone/);
  assert.match(d("write a short biography of Marie Curie").topic, /Marie Curie/);
  assert.match(d("make an outline for a talk on renewable energy").topic, /^renewable energy$/);
  assert.equal(d("make me an outline for a talk").topic, null, "'a talk' is the occasion, not a subject");
});
test("subjectOfAsk strips the question frame", () => {
  assert.equal(subjectOfAsk("who invented the telephone?"), "the telephone");
  assert.equal(subjectOfAsk("what's the biggest threat to dolphins?"), "the biggest threat to dolphins");
  assert.equal(subjectOfAsk("how do bees make honey?"), "bees make honey");
});

// ── compound asks ─────────────────────────────────────────────────────────────────────────────────────────────────────
test("a compound ask is described step by step; 'then' ends on the last step, 'and' keeps the first", () => {
  const a = d("summarize this then write a tweet", { prior: TEL });
  assert.deepEqual(a.steps.map((s) => s.type), ["summary", "slogan"]); assert.equal(a.type, "slogan"); assert.equal(a.sequence, "then");
  const b = d("write an essay on dolphins and a poem about the sea");
  assert.deepEqual(b.steps.map((s) => s.type), ["essay", "poem"]); assert.equal(b.type, "essay"); assert.equal(b.sequence, "and");
  const c = d("write me an outline and then an essay on the Cold War");
  assert.deepEqual(c.steps.map((s) => s.type), ["outline", "essay"]); assert.match(c.steps[0].topic, /Cold War/, "an earlier step with no subject shares the later step's");
  const e = d("write a poem and then translate it into French");
  assert.equal(e.type, "translation"); assert.equal(e.steps[1].material, "previous-step");
  assert.equal(d("make a table of the planets and their moons").steps, undefined, "'and their moons' is part of the subject, not a second ask");
});

// ── voids ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("the typed gaps: no-topic, no-material, unsupported-type, unsupported-format, nothing-found (after the search)", () => {
  assert.deepEqual(d("write an essay").voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["no-topic"]);
  assert.deepEqual(d("write a poem").voidIfMissing.filter((g) => g.active), [], "a poem with no subject is a free choice, not a void");
  assert.deepEqual(d("draw me a picture of a dolphin").voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["unsupported-type"]);
  assert.deepEqual(d("make a logo for my bakery").voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["unsupported-type"]);
  assert.deepEqual(d("write an essay about the telephone and put it in a pdf").voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["unsupported-format"]);
  assert.deepEqual(d("translate").voidIfMissing.filter((g) => g.active).map((g) => g.gap), ["no-material"]);
  const r = d("write an essay about dolphins");
  assert.equal(r.voidIfMissing.find((g) => g.gap === "nothing-found").active, null, "unknown until the search has run");
});
test("voidsAfterSearch: tutorial pages about essays do not bear on the telephone", () => {
  const r = d("write me an essay on this", { prior: TEL });
  const tutorial = [{ title: "Essay on Telephone in 100, 200, 300 Words", text: "To write an essay first start with an introduction, then body paragraphs, then a conclusion." }];
  assert.deepEqual(voidsAfterSearch(r, []).map((g) => g.gap), ["nothing-found"]);
  const good = [{ title: "Telephone — Wikipedia", text: "Alexander Graham Bell was awarded the first U.S. patent for the telephone in 1876." }];
  assert.deepEqual(voidsAfterSearch(r, good), []);
  assert.ok(voidsAfterSearch(r, tutorial, { bears: (p) => /bell|1876|patent/i.test(p.text) }).some((g) => g.gap === "nothing-found"), "the caller's own 'bears on' test is honoured");
  assert.deepEqual(voidsAfterSearch(d("write a poem about the sea"), []), [], "a poem needs no sources, so finding none is no void");
});
test("G9 a guide to writing the piece is not a source on its topic (the tutorial paragraph of the original failure)", () => {
  const r = d("write me an essay on this", { prior: TEL });
  const guide = { title: "Essay on Telephone in 100, 200, 300, and 500 Words", text: "To write an essay on the telephone, first start with an introduction, then body paragraphs, then a conclusion." };
  const real = { title: "Telephone", text: "The telephone is a telecommunications device. Alexander Graham Bell was awarded the first U.S. patent for the telephone in 1876." };
  assert.equal(isWritingGuide(guide), true);
  assert.equal(isWritingGuide(real), false);
  const only = voidsAfterSearch(r, [guide]);
  assert.deepEqual(only.map((g) => g.gap), ["nothing-found"]); assert.match(only[0].why, /guides to writing/);
  const mixed = voidsAfterSearch(r, [guide, real]);
  assert.deepEqual(mixed, []); assert.deepEqual(mixed.usable, [real]);
  assert.equal(isWritingGuide({ title: "Bell's patent", text: "The 1876 filing runs to 500 words and describes the telephone." }), false, "one cue alone is not enough");
});

// ── kinds ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("kindOfOutput: what the discourse classifier does with each reading", () => {
  const k = (q, o) => kindOfOutput(d(q, o));
  assert.equal(k("write a poem about the sea"), "generate");
  assert.equal(k("write an email to my boss asking for a day off"), "compose");
  assert.equal(k("translate 'good morning' into French"), "transform");
  assert.equal(k("write a function to reverse a string in Python"), "code");
  assert.equal(k("list five causes of the Great Depression"), "research");
  assert.equal(k("who invented the telephone?"), null);
  assert.equal(k("make me an outline for a talk"), "generate", "no subject: the fold writes it, it does not search for 'a talk'");
});

// ── G7 the model may only PICK, twice, in two orders, from the closed list ─────────────────────────────────────────────
test("G7 the model never decides alone: a pick is dropped unless it is on the list, both orders agree, and the evidence allows it", async () => {
  const u = d("write me something about dolphins");
  assert.equal(u.undecided, true); assert.equal(u.type, "other");
  const say = (...answers) => { let i = 0; return async () => answers[i++ % answers.length]; };
  // both orders agree, on the list → accepted, and marked as a model pick
  const ok = await pickType(u, "write me something about dolphins", say("essay", "Essay."));
  assert.equal(ok.type, "essay"); assert.equal(ok.typed, "model-pick"); assert.equal(ok.undecided, false); assert.match(ok.topic, /dolphins/);
  // position bias: the two orders disagree → the code's reading stands
  assert.equal((await pickType(u, "write me something about dolphins", say("poem", "story"))).type, "other");
  // off the list → dropped
  assert.equal((await pickType(u, "write me something about dolphins", say("haiku-ish", "haiku-ish"))).type, "other");
  assert.equal((await pickType(u, "write me something about dolphins", say("none", "none"))).type, "other", "the model may not turn a request into a non-request");
  assert.equal((await pickType(u, "write me something about dolphins", say("", ""))).type, "other");
  // evidence: "code" with no code in the ask, "translation" with no language → dropped
  assert.equal((await pickType(u, "write me something about dolphins", say("code", "code"))).type, "other");
  assert.equal((await pickType(u, "write me something about dolphins", say("translation", "translation"))).type, "other");
  // a throwing model leaves the code's own reading
  assert.equal((await pickType(u, "write me something about dolphins", async () => { throw new Error("boom"); })).type, "other");
  // a DECIDED description is never sent to a model at all
  let called = 0;
  const decided = d("write a poem about the sea");
  const same = await pickType(decided, "write a poem about the sea", async () => { called++; return "essay"; });
  assert.equal(called, 0); assert.equal(same.type, "poem");
});

// ── the frozen corpora: a regression gate, not the evidence (the evidence is eval/ants/G1-RESULTS.md) ──────────────────
test("the five frozen corpora (371 phrasings, es/fr/ru/de/zh, typos, anaphora, compounds, lookalikes) stay read correctly", async () => {
  const dir = new URL("./eval/ants/g1/", import.meta.url);
  const mods = await Promise.all(["corpus.mjs", "corpus2.mjs", "corpus3.mjs", "corpus4.mjs", "corpus5.mjs"].map((f) => import(new URL(f, dir).href)));
  const priors = { ...mods[0].PRIORS, ...mods[2].PRIORS3 };
  const all = [...mods[0].CORPUS, ...mods[1].CORPUS2, ...mods[2].CORPUS3, ...mods[3].CORPUS4, ...mods[4].CORPUS5];
  assert.ok(all.length >= 370, "corpora present: " + all.length);
  const wrong = [], falseWants = [];
  for (const c of all) {
    const r = d(c.q, { prior: c.prior ? priors[c.prior] : [], hasMaterial: !!c.hasMaterial });
    if (r.type !== c.gold.type) wrong.push(c.q + " => " + r.type + " (gold " + c.gold.type + ")");
    if (!c.gold.wants && r.wants) falseWants.push(c.q);
    if (c.gold.wants && r.type === c.gold.type && r.needsSources !== c.gold.needsSources) wrong.push(c.q + " needsSources " + r.needsSources);
  }
  const known = ["list all the countries in europe => list (gold none)"];   // a label disagreement, reported in G1-RESULTS.md
  assert.deepEqual(wrong.filter((w) => !known.includes(w)), []);
  assert.ok(falseWants.length <= 1, "false wants: " + falseWants.join(" | "));
});

test("the shape G2's genVoid reads: gaps stringify to their names; the form is the type when the table knows it", () => {
  const r = d("write an essay");
  assert.deepEqual(r.voidIfMissing.map(String), ["no-topic", ...(r.needsSources ? ["nothing-found"] : [])]);
  assert.equal(JSON.parse(JSON.stringify(r)).voidIfMissing[0].gap, "no-topic", "still plain objects on the wire");
  const hk = d("write a haiku about rain");
  assert.equal(genVoidShape(hk, { haiku: 1, poem: 1 }).type, "haiku");
  assert.equal(genVoidShape(hk, {}).type, "poem");
  const g = genVoidShape(d("write me an essay on this", { prior: TEL }));
  assert.deepEqual(Object.keys(g).sort(), ["constraints", "needsSources", "topic", "type", "voidIfMissing"]);
  assert.equal(g.needsSources, true); assert.match(g.topic, /telephone/);
});
