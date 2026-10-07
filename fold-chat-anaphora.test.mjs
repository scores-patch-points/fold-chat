// fold-chat-anaphora.test.mjs — the gate that decides whether an ask leans on the earlier turn (G3). Run: node --test fold-chat-anaphora.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { anaphoraOf, classesOf, LANGS, continuesByAnaphora, ANAPHORA } from "./fold-chat-anaphora.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { planTurn } from "./fold-chat-flow.js";
import { followUp } from "./fold-chat-thread.js";
import { admitReferents, emptyReferents, resolveQuestion, casedRuns } from "./fold-chat-mind.js";
import { hintsFor } from "./fold-chat-hints.js";
import { continuesThread } from "./fold-chat-salience.js";
import { CORPUS } from "./eval/ants/g3/corpus.mjs";
import { CORPUS2 } from "./eval/ants/g3/corpus2.mjs";
import { runCase } from "./eval/ants/g3/measure.mjs";

const carry = (q, lang) => anaphoraOf(q, { lang }).carry;

test("THE BUG: 'why is the sky blue' after a turn about McKinley and the Blue Room is NOT carried (the English prior lists 'the' as a pronoun)", () => {
  let ref = emptyReferents();
  ref = admitReferents(ref, { question: "who is mt. mckinlet named afer?", answer: "Mount McKinley was named for President William McKinley in 1917.", sources: [{ title: "William McKinley" }, { title: "Blue Room" }] });
  const msgs = [{ role: "user", content: "who is mt. mckinlet named afer?" }, { role: "assistant", content: "Mount McKinley was named for President William McKinley in 1917." }];
  const plan = planTurn("why is the sky blue", msgs, { referents: ref, hints: hintsFor("en") });
  assert.equal(plan.kind, "standalone");
  assert.equal(plan.search, "why is the sky blue");
  assert.deepEqual(plan.carried, []);
  assert.equal(plan.gate.carry, false);
  assert.match(plan.gate.why, /own subject/);
  // the legacy path WITHOUT a verdict still carried it: that is the bug the gate closes (resolveQuestion with no gate is unchanged for older callers)
  assert.equal(resolveQuestion("why is the sky blue", ref, { hints: hintsFor("en") }).reason, "carried");
  // and the same ask WITH the verdict is left alone
  assert.equal(resolveQuestion("why is the sky blue", ref, { hints: hintsFor("en"), gate: anaphoraOf("why is the sky blue") }).reason, "gate-standalone");
});

test("anaphoric and elliptical asks carry (en)", () => {
  for (const q of ["What did she discover?", "Tell me more about her husband.", "Who built it?", "make it vegan", "why?", "tell me more", "more", "and in 1911?", "and her husband?", "what about Saturn?", "i want a chewier one", "something less sweet", "who is he", "what is this?", "was he the first?", "explain that simpler", "how do they form?", "his wife?"])
    assert.equal(carry(q, "en"), true, q);
});

test("a self-contained ask never carries, even when it shares a word with the last topic (en)", () => {
  for (const q of ["why is the sky blue", "who painted the Mona Lisa", "what is the boiling point of ethanol", "what do pythons eat", "how far is the moon from the earth", "how many planets are there", "what is radium used for today", "who discovered penicillin", "what is inflation", "photosynthesis", "how do bats see in the dark", "what is the Blue Room in the White House", "why is the ocean blue"])
    assert.equal(carry(q, "en"), false, q);
});

test("expletive, determiner and complementizer uses do not point back", () => {
  for (const q of ["how long does it take to boil an egg", "is it true that the earth is flat", "what is it like to be a bat", "why does it rain so much in Seattle", "is it safe to eat raw eggs", "that book was long, who wrote that book", "how much more do cats sleep than dogs", "which is bigger, the sun or the moon"])
    assert.equal(carry(q, "en"), false, q);
});

test("es and fr (no ethos pronoun prior) decide through the declared classes", () => {
  for (const q of ["¿Qué descubrió ella?", "háblame más", "¿y su marido?", "¿por qué?", "¿y en 1911?", "¿qué le pasó después de Waterloo?"]) assert.equal(carry(q, "es"), true, q);
  for (const q of ["Qu'a-t-elle découvert ?", "dis-m'en plus", "et son mari ?", "pourquoi ?", "et en 1911 ?", "Que lui est-il arrivé après Waterloo ?", "quand a-t-elle été construite ?"]) assert.equal(carry(q, "fr"), true, q);
  for (const q of ["¿cuál es la capital de Australia?", "¿por qué el cielo es azul?", "¿quién pintó la Mona Lisa?", "¿qué es la fotosíntesis?"]) assert.equal(carry(q, "es"), false, q);
  // the French inverted clitic repeats a subject the ask names ("le ciel est-il bleu"): not a pointer
  for (const q of ["pourquoi le ciel est-il bleu ?", "combien d'os y a-t-il dans le corps humain ?", "quand le mur de Berlin est-il tombé ?", "qu'est-ce que la photosynthèse ?"]) assert.equal(carry(q, "fr"), false, q);
});

test("a language with no closed-class prior is UNDECIDED: not carried, and the verdict says so", () => {
  const v = anaphoraOf("Warum ist der Himmel blau", { lang: "de" });
  assert.equal(v.carry, false); assert.equal(v.decided, false); assert.match(v.why, /undecided: no closed-class prior for de/);
  const plan = followUp("er hat gewonnen", [{ role: "user", content: "x" }, { role: "assistant", content: "y" }], { lang: "de" });
  assert.equal(plan.kind, "standalone"); assert.equal(plan.reason, "stands-alone-undecided");
  // Russian has no declared class but the ethos pronoun forms (all pronouns) are honoured: "он" carries, a noun ask does not
  const ru = hintsFor("ru");
  assert.equal(anaphoraOf("что он открыл", { lang: "ru", hints: ru }).carry, true);
  assert.equal(anaphoraOf("почему небо голубое", { lang: "ru", hints: ru }).carry, false);
});

test("every listed pronoun/connective is a function word of its language, bar the few that are open-class by the prior's own cut", () => {
  const OPEN = new Set(["hers", "theirs", "one", "ones", "suyas", "also", "so", "then", "también", "entonces", "además", "aussi", "alors", "donc"]);
  for (const L of LANGS) {
    const c = classesOf(L), fw = functionWordsOf(L);
    for (const k of ["strong", "weak", "connectives"]) for (const w of c[k]) assert.ok(fw.has(w) || OPEN.has(w), `${L}.${k}: ${w} is not in functionWordsOf(${L})`);
    for (const w of c.strong) assert.ok(!c.weak.has(w), `${L}: ${w} in both strong and weak`);
  }
});

test("followUp: carried, elliptical and meta still work; the verdict rides the plan", () => {
  let ref = admitReferents(emptyReferents(), { question: "Who was Marie Curie?", answer: "Marie Curie was a physicist who discovered radium.", sources: [{ title: "Marie Curie" }] });
  const prior = [{ role: "user", content: "Who was Marie Curie?" }, { role: "assistant", content: "Marie Curie was a physicist who discovered radium." }];
  const he = hintsFor("en");
  const a = followUp("What did she discover?", prior, { referents: ref, hints: he });
  assert.equal(a.kind, "carried"); assert.ok(a.carried.includes("Marie Curie")); assert.equal(a.gate.carry, true);
  const b = followUp("tell me more", prior, { referents: ref, hints: he });
  assert.equal(b.kind, "carried");
  const c = followUp("¿y su marido?", prior, { referents: ref, hints: hintsFor("es"), lang: "es" });
  assert.equal(c.kind, "carried", "Spanish had no trigger list and never carried; the gate decides now");
  const d = followUp("why?", prior, { referents: ref, hints: he });
  assert.equal(d.kind, "meta");
  const e = followUp("what is the boiling point of ethanol", prior, { referents: ref, hints: he });
  assert.equal(e.kind, "standalone"); assert.equal(e.query, "what is the boiling point of ethanol");
  // a connective fragment with no record to read it through falls back to the earlier ask's topic words, never to nothing at random
  const f = followUp("and in 1911?", prior, { referents: emptyReferents(), hints: he });
  assert.equal(f.kind, "elliptical"); assert.match(f.query, /marie curie/);
});

test("continuesThread: with a verdict, a shared word is not a thread; without one the old shared-stem test stands", () => {
  const terms = new Set(["blue", "sky"]); const last = { ask: "what is the Blue Room in the White House", said: "The Blue Room is an oval room." };
  assert.equal(continuesThread({ follow: { kind: "standalone", gate: { carry: false } }, terms, lastExchange: last }), false);
  assert.equal(continuesThread({ follow: { kind: "standalone" }, terms, lastExchange: last }), true);
  assert.equal(continuesThread({ follow: { kind: "carried", gate: { carry: true } }, terms, lastExchange: last }), true);
  assert.equal(continuesByAnaphora({ kind: "standalone", gate: { carry: false } }), false);
  assert.equal(continuesByAnaphora({ kind: "standalone", gate: { carry: true } }), true);
  assert.equal(continuesByAnaphora({ kind: "meta" }), true);
});

test("a poem's capitalised lines name no referent (every line of a poem opens with a capital)", () => {
  const poem = "Sun's out, sky's blue, a perfect day\nKids are running free\nWith laughter in their way\nBut the clouds drift by";
  const runs = casedRuns(poem).map((r) => r.surface);
  assert.deepEqual(runs.filter((s) => ["Kids", "With", "But", "Sun"].includes(s)), [], "single capitalised words at a line start are sentence openers");
  const rec = admitReferents(emptyReferents(), { question: "write me a song about trampolines", answer: "Chorus\nTrampolines, oh Trampolines\nLeaping high", sources: [], creative: true });
  assert.deepEqual(rec.entities.filter((e) => e.roles.includes("answer")), [], "a creative answer admits no answer-run");
  const rec2 = admitReferents(emptyReferents(), { question: "who was Ada Lovelace", answer: "Ada Lovelace wrote the first program.", sources: [] });
  assert.ok(rec2.entities.some((e) => e.surface === "Ada Lovelace"));
});

test("the dev corpus (113 sequences): NO standalone ask inherits anything, in en, es and fr; the follow-ups that fail are the known weak sides", () => {
  const rows = CORPUS.map((s) => runCase(s));
  const leaks = rows.filter((r) => r.cls === "switch" && r.inherits);
  assert.deepEqual(leaks.map((r) => r.ask), [], "a self-contained ask carried a referent, a query term or a passage");
  const miss = rows.filter((r) => r.cls === "follow" && !r.inherits).map((r) => r.ask);
  assert.deepEqual(miss, ["¿quién la construyó?"], "known: the Spanish clitic 'la' is also the article (no part-of-speech tagger)");
  const fol = rows.filter((r) => r.cls === "follow" && r.inherits);
  assert.ok(fol.every((r) => r.rightRef !== false), "every carried follow-up carried the right referent");
});

test("the held-out corpus (56 sequences): no switch leaks; follow-ups >= 75%", () => {
  const rows = CORPUS2.map((s) => runCase(s));
  assert.deepEqual(rows.filter((r) => r.cls === "switch" && r.inherits).map((r) => r.ask), []);
  const f = rows.filter((r) => r.cls === "follow"); const ok = f.filter((r) => r.inherits).length;
  assert.ok(ok / f.length >= 0.75, `follow ${ok}/${f.length}`);
});

test("the declared limits are the ones the thread module already declares", () => {
  assert.equal(ANAPHORA.weakMaxTokens, 8);
});

test("each guard has a case that only it decides (mutation targets)", () => {
  // a weak pronoun in a LONG ask: the ask names enough on its own (the declared 8-token limit)
  assert.equal(carry("how many people did it kill in the first year after it started", "en"), false);
  assert.equal(carry("how many people did it kill", "en"), true);
  // a weak pronoun beside an entity of the ask's own names it: stands alone
  assert.equal(carry("who painted it, Leonardo da Vinci?", "en"), false);
  // 'one' points back only as a stand-in ("a chewier one"), not as a numeral ("one of the largest")
  assert.equal(carry("name one of the largest lakes", "en"), false);
  assert.equal(carry("a cheaper one", "en"), true);
  // a connective followed by a question word opens a clause of its own
  assert.equal(carry("and who painted the Mona Lisa", "en"), false);
  assert.equal(carry("and in 1999", "en"), true);
  // a comparison BETWEEN two things is not a bare comparative
  assert.equal(carry("cats are bigger than dogs", "en"), false);
  assert.equal(carry("a bit bigger", "en"), true);
});

test("H2 (the merged thread-reuse feature): a short standalone ask with its own subject is NOT a move, so it never reuses the previous turn's text or passages", () => {
  const prior = [{ role: "user", content: "Who was Marie Curie?" }, { role: "assistant", content: "Marie Curie was a physicist who discovered radium.", grounding: { passages: [{ ref: "x", text: "radium" }] } }];
  for (const q of ["so what is dna", "wait what is entropy", "are you sure about gravity"]) {
    const p = planTurn(q, prior, { referents: null, hints: hintsFor("en") });
    assert.equal(p.mode, "web", q); assert.equal(p.search, q, q); assert.notEqual(p.kind, "move", q);
  }
  // the real moves stay moves
  for (const q of ["prove it", "are you sure?", "wait, what", "so what does it all mean", "how do these fit together"]) assert.equal(planTurn(q, prior, { referents: null, hints: hintsFor("en") }).kind, "move", q);
  // a bare demonstrative before a content word is a determiner unless a speech act says otherwise
  assert.equal(anaphoraOf("how do these cookies stay soft").carry, false);
  assert.equal(anaphoraOf("how do these fit together", { demonstrativeAsPronoun: true }).carry, true);
});
