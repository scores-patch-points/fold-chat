// fold-chat-answerturn.test.mjs — the whole slot-ask pipeline WITHOUT a browser, a network or a model: eight asks (A1–A8, fixtures in
// eval/falsify/fixtures/tierA, SYNTHETIC) through runAnswerTurn with stubbed deps, then the falsifiers of the integration itself.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runAnswerTurn, realise, DECLARED, HANDOFF_WHY } from "./fold-chat-answerturn.js";
import { answerCardModel } from "./fold-chat-answercard.js";
import { assertInvariant } from "./fold-chat-void.js";
import { caseless } from "./fold-chat-frame.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const FW = functionWordsOf("en");
const ROWS = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const PROBES = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/probes.json", import.meta.url), "utf8"));
const SRC = fs.readFileSync(new URL("./fold-chat-answerturn.js", import.meta.url), "utf8");
const NOW = { year: 2026 };

const caseOf = (id) => ROWS.cases.find((c) => c.id === id);
const leadOf = (id) => PROBES.cases.find((c) => c.id === id).lead;
const wiki = (t) => "https://en.wikipedia.org/wiki/" + String(t).replace(/ /g, "_");
const passagesOf = (c, titles = null) => c.pages.filter((p) => !titles || titles.includes(p.title)).map((p, i) => ({ ref: "S" + (i + 1), title: p.title, url: p.url || wiki(p.title), host: "en.wikipedia.org", lang: "en", text: p.text }));

// what a title service answers for the names that can be FILLERS (the asks' own names come from the fixture's `titles` table)
const FILLER_TITLES = {
  "charles iii": { title: "Charles III", redirectedFrom: null, disambiguation: false },
  "charles ii": { title: "Charles II of England", redirectedFrom: "Charles II", disambiguation: false },
  "elizabeth ii": { title: "Elizabeth II", redirectedFrom: null, disambiguation: false },
  "andy burnham": { title: "Andy Burnham", redirectedFrom: null, disambiguation: false },
  "louis xvi": { title: "Louis XVI", redirectedFrom: null, disambiguation: false },
  "canberra": { title: "Canberra", redirectedFrom: null, disambiguation: false },
};

// A deps bag with a LOG of everything the pipeline asked for, and nothing that could be a model.
function world(c, over = {}) {
  const log = { titles: [], leads: [], wide: 0, keys: new Set() };
  const base = {
    fw: FW,
    resolveTitles: async (cands) => { log.titles.push(cands.slice()); return new Map(cands.map((x) => [x, c.titles[caseless(x)] ?? FILLER_TITLES[caseless(x)] ?? null])); },
    fetchLead: async (query) => { log.leads.push(query); const k = caseless(query); const hit = PROBES.cases.find((p) => caseless(p.lead.title) === k || caseless(p.filler) === k); return hit ? hit.lead : null; },
    searchPassages: async () => { log.wide++; return []; },
  };
  const deps = new Proxy({ ...base, ...over }, { get(t, k) { log.keys.add(String(k)); return t[k]; } });
  return { deps, log };
}
const run = (c, over = {}, o = {}) => {
  const w = world(c, over);
  return runAnswerTurn({ question: c.ask, lang: "en", passages: passagesOf(c), now: NOW, deps: w.deps, ...o }).then((turn) => ({ turn, ...w }));
};
const texts = (turn) => JSON.stringify(turn);
const traceText = (turn) => turn.trace.map((l) => l.say + " " + (l.detail || "")).join("\n");

// ── the eight asks ───────────────────────────────────────────────────────────────────────────────────────────────
test("A1 king of the UK → 'Charles III is the king of the United Kingdom.' + the cite + a search that names him + a trace line for it", async () => {
  const { turn, log } = await run(caseOf("A1"));
  assert.equal(turn.schema, "AnswerTurn@1");
  assert.ok(turn.answer, texts(turn));
  assert.equal(turn.answer.text, "Charles III is the king of the United Kingdom.");
  assert.equal(turn.answer.filler.text, "Charles III");
  assert.equal(turn.answer.by, "mechanical");
  assert.equal(turn.answer.standing, "survived");
  assert.ok(turn.answer.survived.some((s) => /Charles III/.test(s) && /no death date/.test(s)), JSON.stringify(turn.answer.survived));
  assert.ok(turn.answer.row.sentence.startsWith("Charles III is the king of the United Kingdom and the other Commonwealth realms"));
  assert.equal(turn.answer.row.source.title, "Monarchy of the United Kingdom");
  assert.deepEqual(turn.contest, []); assert.equal(turn.gap, null); assert.equal(turn.slot, "person");
  assert.deepEqual(log.leads, ["Charles III"], "ONE falsifying query, and it names the claim");
  assert.ok(turn.searched.includes("Charles III"));
  assert.ok(turn.trace.some((l) => /Charles III/.test(l.say) && /searched/.test(l.say)), traceText(turn));
  assert.ok(turn.trace.every((l) => l.who === "app"));
  assert.equal(turn.lang.code, "en");
  assert.ok(turn.sources.some((s) => s.title === "Monarchy of the United Kingdom"));
  assertInvariant(turn.void);
  assert.equal(turn.void.status, "satisfied");
  // the row is re-verifiable against its passage (the verbatim sentence, by offset)
  const page = caseOf("A1").pages[0].text;
  assert.equal(page.slice(...turn.answer.row.span), turn.answer.row.sentence);
});

test("A1 through the card: one answer line, the cite, the checks — a card model that is not a wall", async () => {
  const { turn } = await run(caseOf("A1"));
  const m = answerCardModel(turn);
  assert.equal(m.kind, "answer");
  assert.equal(m.headline.text, "Charles III is the king of the United Kingdom.");
  assert.equal(m.cite.kind, "pointer", "the encyclopedia is a pointer, never the citation (fold-chat-origin.js)");
  assert.equal(m.quote.shownAsHeadline, false);
  assert.ok(m.checked.length);
  assert.ok(m.trace.length >= 5);
});

test("A2 president of the UK, a US/France pool → one widening read, then the gap 'unwitnessed'; nobody is named; the model is barred", async () => {
  const { turn, log } = await run(caseOf("A2"));
  assert.equal(turn.answer, null);
  assert.equal(turn.gap.kind, "unwitnessed");
  assert.equal(log.wide, 1, "ONE widening step, not a loop");
  assert.ok(turn.trace.some((l) => /looked wider/.test(l.say)), traceText(turn));
  assert.ok(!/Elizabeth|Charles|Washington|Macron/.test(JSON.stringify(turn.answer)), "no person is the answer");
  assert.deepEqual(log.leads, [], "nothing to falsify, so no search");
  assertInvariant(turn.void);
  assert.equal(answerCardModel(turn).kind, "gap");
});

test("A2 widening: when the wider read DOES find a page that states it, the answer comes from it (and is recorded as a wider read)", async () => {
  const c = caseOf("A2");
  const wider = [{ ref: "S9", title: "Office of the Chancellor", url: wiki("Chancellor"), host: "en.wikipedia.org", lang: "en", text: "Jane Roe is the president of the United Kingdom, appointed in 2030." }];
  const { turn, log } = await run(c, {
    searchPassages: async (frame) => { assert.equal(frame.slot, "person"); return wider; },
    resolveTitles: async (cands) => new Map(cands.map((x) => [x, c.titles[caseless(x)] ?? (caseless(x) === "jane roe" ? { title: "Jane Roe", redirectedFrom: null, disambiguation: false } : null)])),
  });
  assert.equal(turn.gap, null, texts(turn));
  assert.equal(turn.answer.filler.text, "Jane Roe");
  assert.equal(turn.answer.row.source.title, "Office of the Chancellor");
  assert.ok(turn.trace.some((l) => /looked wider and read Office of the Chancellor/.test(l.say)), traceText(turn));
  assert.ok(turn.void.events.some((e) => e.kind === "widen" && e.data.read.length === 1), "the wider read is an event");
  assert.deepEqual(log.leads, ["Jane Roe"]);
});

test("A3 king of France → NOT 'Louis XVI is the king': gap no_present_holder, the past-tense sentence is the closest source", async () => {
  const { turn, log } = await run(caseOf("A3"));
  assert.equal(turn.answer, null);
  assert.equal(turn.gap.kind, "no_present_holder");
  assert.ok(turn.gap.closest.sentence.startsWith("Louis XVI was the last king of France"));
  assert.equal(turn.gap.closest.tense, "past");
  assert.ok(!/Louis XVI is the king|king of France is Louis XVI/i.test(texts(turn)));
  assert.equal(log.wide, 0, "the rows exist; the rule is tense, so no widening");
  assert.deepEqual(log.leads, []);
  assert.ok(turn.trace.some((l) => /past tense/.test(l.say)), traceText(turn));
  assertInvariant(turn.void);
  const m = answerCardModel(turn);
  assert.equal(m.kind, "gap"); assert.equal(m.gap.kind, "no_present_holder");
  assert.match(m.gap.closest.quote.text, /^Louis XVI was the last king of France/);
});

test("A3 asked in the PAST ('Who was the king of France?') the past-tense row IS the answer", async () => {
  const c = caseOf("A3");
  const w = world(c);
  const t = await runAnswerTurn({ question: "Who was the king of France?", lang: "en", passages: passagesOf(c), now: NOW, deps: w.deps });
  assert.equal(t.gap, null, texts(t));
  assert.ok(t.answer && t.answer.filler.text === "Louis XVI");
  assert.deepEqual(w.log.leads, [], "a past ask makes no 'is he still living' query");
});

test("A4 prime minister of the UK → Andy Burnham (the page's title carries the UK), never Sunak, and the junk filler 'appointed by the monarch' is not a candidate", async () => {
  const { turn, log } = await run(caseOf("A4"));
  assert.ok(turn.answer, texts(turn));
  assert.equal(turn.answer.filler.text, "Andy Burnham");
  assert.equal(turn.answer.text, "The current prime minister is Andy Burnham.");
  assert.ok(!/Sunak/.test(texts(turn)));
  assert.deepEqual(log.leads, ["Andy Burnham"]);
  assert.equal(turn.answer.standing, "survived");
  assert.equal(turn.contest.length, 0, "the junk 'appointed by the monarch' made no rival");
  // the filler was checked BY TITLE (a second resolve call, with the fillers)
  assert.ok(log.titles.some((cs) => cs.includes("Andy Burnham")));
  assertInvariant(turn.void);
});

test("A5 stale world → Elizabeth II is REFUTED by the search that names her: the death shown, never presented as current", async () => {
  const c = caseOf("A5");
  const stale = passagesOf(c, ["Royal family (stale snapshot)"]);
  const { turn, log } = await run(c, {}, { passages: stale });
  assert.deepEqual(log.leads, ["Elizabeth II"], "the refutation is reachable ONLY by a query that names her");
  assert.equal(turn.answer, null);
  assert.equal(turn.gap.kind, "refuted");
  assert.match(turn.gap.closest.sentence, /8 September 2022/);
  assert.match(turn.gap.closest.sentence, /death/);
  assert.equal(turn.gap.closest.source.title, "Elizabeth II");
  assert.equal(turn.gap.claim.filler.text, "Elizabeth II", "the refuted claim is kept beside its refutation");
  assert.ok(turn.searched.includes("Elizabeth II"));
  assert.ok(turn.trace.some((l) => /Elizabeth II/.test(l.say) && /died in 2022/.test(l.say) && /can't be the current holder/.test(l.say)), traceText(turn));
  assert.ok(turn.trace.some((l) => /Elizabeth II/.test(l.say) && /searched/.test(l.say)), "a trace line records the search naming her");
  assertInvariant(turn.void);
  const m = answerCardModel(turn);
  assert.equal(m.kind, "gap"); assert.equal(m.gap.kind, "refuted");
  assert.match(m.gap.closest.quote.text, /8 September 2022/);
  assert.equal(m.headline, null, "no answer line names her as current");
});

test("A5 with the other page read too: the refuted holder is set aside and the one that survives is the answer, with both in the trace", async () => {
  const c = caseOf("A5");
  const extra = { ref: "S3", title: "Notes on the crown", url: wiki("Notes_on_the_crown"), host: "en.wikipedia.org", lang: "en", text: "Charles III is the monarch of the United Kingdom and the other Commonwealth realms." };
  const { turn, log } = await run(c, {}, { passages: [...passagesOf(c, ["Royal family (stale snapshot)"]), extra] });
  assert.deepEqual(log.leads, ["Elizabeth II", "Charles III"]);
  assert.ok(turn.answer, texts(turn));
  assert.equal(turn.answer.filler.text, "Charles III");
  assert.ok(!/Elizabeth II is the monarch/.test(turn.answer.text));
  assert.ok(turn.trace.some((l) => /Elizabeth II/.test(l.say) && /died in 2022/.test(l.say)), "the set-aside holder is still in the thinking");
  assert.equal(turn.contest.length, 0, "a refuted holder is not a rival");
  assertInvariant(turn.void);
});

test("A5 with the better-ranked page first: the stale holder is a RIVAL — and is itself put to the search that names it, so it falls and the answer stands (no contest)", async () => {
  const c = caseOf("A5");
  const good = { ref: "S1", title: "Monarchy of the United Kingdom", url: wiki("Monarchy_of_the_United_Kingdom"), host: "en.wikipedia.org", lang: "en", text: "Charles III is the monarch of the United Kingdom and the other Commonwealth realms." };
  const { turn, log } = await run(c, {}, { passages: [good, ...passagesOf(c, ["Royal family (stale snapshot)"])] });
  assert.deepEqual(log.leads, ["Charles III", "Elizabeth II"], "each name is looked up once, never twice");
  assert.ok(turn.answer, texts(turn));
  assert.equal(turn.answer.filler.text, "Charles III");
  assert.equal(turn.contest.length, 0);
  assert.equal(turn.gap, null);
  assert.equal(turn.void.status, "satisfied");
  assert.ok(turn.trace.some((l) => /another holder/.test(l.say) || /names Elizabeth II/.test(l.say)), "the doubt that came up is in the thinking: " + traceText(turn));
  assert.ok(turn.trace.some((l) => /Elizabeth II/.test(l.say) && /died in 2022/.test(l.say)));
  assert.ok(turn.trace.some((l) => /So I'm answering Charles III/.test(l.say)), traceText(turn));
  assert.ok(turn.answer.survived.some((x) => /no death date/.test(x)));
});

test("A6 (control) capital of Australia → Canberra, the row's own sentence, cited; no search for a person", async () => {
  const { turn, log } = await run(caseOf("A6"));
  assert.ok(turn.answer, "over-suppression: " + texts(turn));
  assert.equal(turn.answer.text, "Canberra is the capital city of Australia.");
  assert.equal(turn.answer.filler.text, "Canberra");
  assert.equal(turn.answer.row.source.title, "Canberra");
  assert.deepEqual(log.leads, [], "a place is not a person: no life-dates query");
  assert.equal(turn.slot, "thing");
  const m = answerCardModel(turn);
  assert.equal(m.kind, "answer");
  assert.equal(m.quote.shownAsHeadline, true, "the headline IS the source sentence: drawn once");
  assertInvariant(turn.void);
});

test("A7 spider legs → 'eight', built from the sentence's own words, with the verbatim sentence and the cite; honestly 'unmeasured' (one source, nothing to compare)", async () => {
  const { turn } = await run(caseOf("A7"));
  assert.ok(turn.answer, texts(turn));
  assert.equal(turn.answer.filler.text, "eight");
  assert.equal(turn.answer.text, "Spiders have eight legs.");
  for (const w of turn.answer.text.replace(/\.$/, "").split(" ")) assert.ok(turn.answer.row.sentence.toLowerCase().includes(w.toLowerCase()), w + " is the row's own word");
  assert.ok(turn.answer.row.sentence.startsWith("Spiders are air-breathing arthropods that have eight legs"));
  assert.equal(turn.answer.standing, "unmeasured");
  assert.ok(turn.answer.unmeasured.length >= 1);
  assert.equal(turn.slot, "quantity");
  const m = answerCardModel(turn);
  assert.equal(m.kind, "answer"); assert.equal(m.standing, "unmeasured");
  assert.ok(m.cite && m.cite.kind === "pointer" && /not cited/.test(m.cite.label));
  assert.ok(m.unmeasured.length, "the card says what it did not check");
  assertInvariant(turn.void);
});

test("A8 what year did World War 2 end → no invented year: an honest closest sentence", async () => {
  const c = caseOf("A8");
  const { turn } = await run(c);
  assert.equal(turn.answer, null);
  assert.equal(turn.gap.kind, "unwitnessed");
  assert.match(turn.gap.closest.sentence, /1 September 1939 to 2 September 1945/);
  const years = new Set((JSON.stringify(turn).match(/(?<![\d])\d{4}(?![\d])/g) || []));
  const page = new Set((c.pages[0].text.match(/(?<![\d])\d{4}(?![\d])/g) || []));
  for (const y of years) if (!["2026"].includes(y)) assert.ok(page.has(y), "a year the page never states: " + y);
  assert.equal(answerCardModel(turn).gap.label, "No source I read says when.");
});

test("A8b the page DOES say it ended in one year → that year, the sentence verbatim", async () => {
  const { turn } = await run(caseOf("A8b"));
  assert.ok(turn.answer, texts(turn));
  assert.equal(turn.answer.filler.text, "1945");
  assert.equal(turn.answer.text, turn.answer.row.sentence, "a time slot is the sentence verbatim");
  assert.match(turn.answer.text, /^World War II ended with the formal surrender of Japan on 2 September 1945/);
  assert.equal(answerCardModel(turn).quote.shownAsHeadline, true);
});

// ── the falsifiers of the integration ────────────────────────────────────────────────────────────────────────────
test("FALSIFIER: a fetchLead that THROWS → standing 'unmeasured', the answer is still the source's sentence, and the card says it could not check — never 'survived'", async () => {
  const { turn } = await run(caseOf("A1"), { fetchLead: async () => { throw new Error("relay down"); } });
  assert.ok(turn.answer, texts(turn));
  assert.equal(turn.answer.standing, "unmeasured");
  assert.notEqual(turn.answer.standing, "survived");
  assert.ok(turn.answer.unmeasured.some((u) => /still living/.test(u)), JSON.stringify(turn.answer.unmeasured));
  assert.ok(turn.trace.some((l) => l.unmeasured === true && /could not be checked/.test(l.say)), traceText(turn));
  const m = answerCardModel(turn);
  assert.equal(m.kind, "answer");
  assert.ok(m.unmeasured.length);
  assert.deepEqual(m.checked, [], "nothing is claimed as checked");
  assert.ok(!/survived/i.test(JSON.stringify(m)));
  assertInvariant(turn.void);
});

test("FALSIFIER: a fetchLead that returns nothing, or the wrong page, is 'unmeasured' too", async () => {
  for (const lead of [null, { title: "Charles III of Spain", extract: "Charles III (1716–1788) was King of Spain.", url: "u" }]) {
    const { turn } = await run(caseOf("A1"), { fetchLead: async () => lead });
    assert.equal(turn.answer.standing, "unmeasured", JSON.stringify(lead));
  }
});

test("FALSIFIER: the model is provably not called — deps carry no model, and only the declared keys are touched", async () => {
  for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]) {
    const { turn, keys } = await (async () => { const r = await run(caseOf(id)); return { turn: r.turn, keys: r.log.keys }; })();
    assert.ok(!turn.handoff, id);
    for (const k of keys) assert.ok(["fw", "resolveTitles", "fetchLead", "searchPassages", "signal", "then", "toJSON"].includes(k), id + " touched deps." + k);
  }
  // and nothing in the module can reach one: no network, no clock, no randomness, no globals, no model word
  const code = SRC.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|Date\.now|new Date\b|Math\.random|globalThis|window\.|document\.|localStorage|heimdall|ollama|webllm|chatModel|callModel/i);
  const imports = [...code.matchAll(/from\s+"(\.\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["./fold-chat-falsify.js", "./fold-chat-frame.js", "./fold-chat-lang.js", "./fold-chat-void.js", "./fold-chat-witness.js"]);
});

test("FALSIFIER: no case is read — all-lowercase and ALL-CAPS asks give the same turn as the normal-case ask", async () => {
  for (const id of ["A1", "A3", "A4", "A5", "A6", "A7"]) {
    const c = caseOf(id);
    const passages = id === "A5" ? passagesOf(c, ["Royal family (stale snapshot)"]) : passagesOf(c);
    const turns = [];
    for (const ask of [c.ask, c.ask.toLowerCase(), c.ask.toUpperCase()]) {
      const w = world(c);
      turns.push(await runAnswerTurn({ question: ask, lang: "en", passages, now: NOW, deps: w.deps }));
    }
    const pick = (t) => JSON.stringify({ answer: t.answer, contest: t.contest, gap: t.gap, trace: t.trace.map((l) => caseless(l.say)), searched: t.searched, slot: t.slot });
    assert.ok(!turns[0].handoff, id + " " + JSON.stringify(turns[0]));
    assert.equal(pick(turns[1]), pick(turns[0]), id + " lowercase");
    assert.equal(pick(turns[2]), pick(turns[0]), id + " ALL CAPS");
  }
  const code = SRC.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /A-Z|\\p\{Lu\}|\\p\{Lt\}|toUpperCase|toLocaleUpperCase|toLowerCase|toLocaleLowerCase/);
});

test("FALSIFIER: Spanish / Chinese asks → { handoff } kind no_grammar_for_language, no exception, nothing else asked of the world", async () => {
  for (const [lang, ask] of [["es", "¿Quién es el rey de España?"], ["zh", "英国的国王是谁？"], ["fr", "Qui est le roi de la France ?"]]) {
    let called = 0;
    const out = await runAnswerTurn({ question: ask, lang, passages: [], now: NOW, deps: { fw: functionWordsOf(lang), resolveTitles: async () => { called++; return new Map(); }, fetchLead: async () => { called++; return null; }, searchPassages: async () => { called++; return []; } } });
    assert.equal(out.handoff.kind, "no_grammar_for_language", lang);
    assert.ok(out.handoff.why.length > 10 && !/void|EOT/i.test(out.handoff.why));
    assert.equal(out.answer, undefined);
    assert.equal(called, 0, lang + ": no title call, no search, nothing");
  }
  // a language the detector cannot name has no grammar either
  const none = await runAnswerTurn({ question: "????", passages: [], deps: { fw: null } });
  assert.equal(none.handoff.kind, "no_grammar_for_language");
});

test("handoff: a question that is not a slot ask, an unreadable frame, and an unresolved name all hand the chat back to today's path", async () => {
  const c = caseOf("A1");
  const w = world(c);
  const notSlot = await runAnswerTurn({ question: "Tell me about spiders", lang: "en", passages: [], deps: w.deps });
  assert.equal(notSlot.handoff.kind, "not_a_slot_ask");
  assert.deepEqual(w.log.titles, [], "no title call for a question that is not a slot ask");
  const unread = await runAnswerTurn({ question: "Who are The Who?", lang: "en", passages: [], deps: world(c).deps });
  assert.equal(unread.handoff.kind, "frame_unread");
  const w2 = world(c, { resolveTitles: async () => { throw new Error("offline"); } });
  const unresolved = await runAnswerTurn({ question: c.ask, lang: "en", passages: passagesOf(c), deps: w2.deps });
  assert.equal(unresolved.handoff.kind, "referents_unresolved");
  for (const h of [notSlot, unread, unresolved]) assert.equal(h.handoff.why, HANDOFF_WHY[h.handoff.kind]);
});

test("never throws: a deps bag that explodes at every call becomes a typed outcome, not an exception", async () => {
  const boom = () => { throw new Error("boom"); };
  const out = await runAnswerTurn({ question: caseOf("A1").ask, lang: "en", passages: passagesOf(caseOf("A1")), now: NOW, deps: { fw: FW, resolveTitles: boom, fetchLead: boom, searchPassages: boom } });
  assert.ok(out.handoff || out.schema);
  const weird = await runAnswerTurn({ question: undefined, lang: undefined, passages: null, deps: null });
  assert.ok(weird.handoff || weird.schema);
});

test("two rows with different fillers → a contest, both kept, nothing averaged, nothing picked", async () => {
  const c = caseOf("A1");
  const other = { ref: "S2", title: "Monarchy (older edition)", url: wiki("Monarchy_older"), host: "en.wikipedia.org", lang: "en", text: "Charles II is the king of the United Kingdom and the other Commonwealth realms." };
  const { turn } = await run(c, {}, { passages: [...passagesOf(c), other] });
  assert.equal(turn.answer, null);
  assert.equal(turn.gap, null);
  assert.equal(turn.contest.length, 2);
  assert.deepEqual(turn.contest.map((r) => r.filler.text).sort(), ["Charles II", "Charles III"]);
  assert.ok(turn.contest.every((r) => r.sentence && r.source.url));
  assert.ok(turn.trace.some((l) => /not picking one/.test(l.say)), traceText(turn));
  const m = answerCardModel(turn);
  assert.equal(m.kind, "contest"); assert.equal(m.contest.length, 2);
  assertInvariant(turn.void);
});

test("a negating row against a witnessing row is a contest, not a silent pick", async () => {
  const c = caseOf("A1");
  const neg = { ref: "S2", title: "Constitutional note", url: wiki("Note"), host: "en.wikipedia.org", lang: "en", text: "The United Kingdom does not have a king." };
  const { turn } = await run(c, {}, { passages: [...passagesOf(c), neg] });
  assert.equal(turn.answer, null);
  assert.equal(turn.contest.length, 2);
  assert.ok(turn.contest.some((r) => r.polarity === "-") && turn.contest.some((r) => r.filler && r.filler.text === "Charles III"));
});

test("the filler must be a NAME: a filler that resolves to no page (or to a disambiguation page) is not a candidate", async () => {
  const c = caseOf("A1");
  const junk = { ref: "S1", title: "Monarchy", url: wiki("Monarchy"), host: "en.wikipedia.org", lang: "en", text: "A hereditary monarch is the king of the United Kingdom." };
  for (const entry of [null, { title: "Hereditary monarch (disambiguation)", redirectedFrom: null, disambiguation: true }]) {
    const { turn } = await run(c, { resolveTitles: async (cands) => new Map(cands.map((x) => [x, c.titles[caseless(x)] ?? (caseless(x) === "a hereditary monarch" ? entry : null)])) }, { passages: [junk] });
    assert.equal(turn.answer, null, JSON.stringify(entry));
    assert.equal(turn.gap.kind, "unwitnessed");
  }
});

test("the title service failing for the FILLER check is said (unmeasured), not hidden; a title-carried row is then dropped", async () => {
  const c = caseOf("A1");
  let n = 0;
  const { turn } = await run(c, { resolveTitles: async (cands) => { if (++n > 1) throw new Error("429"); return new Map(cands.map((x) => [x, c.titles[caseless(x)] ?? null])); } });
  assert.ok(turn.answer, "a row that binds on its own words still ships");
  assert.ok(turn.answer.unmeasured.some((u) => /names a page/.test(u)), JSON.stringify(turn.answer.unmeasured));
  const c4 = caseOf("A4"); let m = 0;
  const { turn: t4 } = await run(c4, { resolveTitles: async (cands) => { if (++m > 1) throw new Error("429"); return new Map(cands.map((x) => [x, c4.titles[caseless(x)] ?? null])); } });
  assert.equal(t4.answer, null, "a sentence that binds only through its page's title needs its filler checked by title");
});

test("nothing could be read at all → gap 'unreached' (not 'unwitnessed'): no source is not the same as no sentence", async () => {
  const c = caseOf("A1");
  const { turn } = await run(c, { searchPassages: async () => { throw new Error("offline"); } }, { passages: [] });
  assert.equal(turn.gap.kind, "unreached");
  assert.ok(turn.trace.some((l) => /looked wider/.test(l.say) && l.unmeasured), traceText(turn));
  assertInvariant(turn.void);
});

test("a passage in another language is not read with this grammar", async () => {
  const c = caseOf("A1");
  const es = passagesOf(c).map((p) => ({ ...p, lang: "es" }));
  const { turn } = await run(c, {}, { passages: es });
  assert.equal(turn.answer, null);
  assert.ok(turn.gap && ["unwitnessed", "unreached"].includes(turn.gap.kind));
});

test("abort: an aborted signal ends with a PARTIAL turn marked aborted and NO answer — before, and during, the falsifying search", async () => {
  const c = caseOf("A1");
  const pre = new AbortController(); pre.abort();
  const t0 = await run(c, { signal: pre.signal });
  assert.equal(t0.turn.aborted, true); assert.equal(t0.turn.answer, null); assert.equal(t0.turn.gap, null);
  const mid = new AbortController();
  const t1 = await run(c, { signal: mid.signal, fetchLead: async () => { mid.abort(); return new Promise(() => {}); } });
  assert.equal(t1.turn.aborted, true, texts(t1.turn));
  assert.equal(t1.turn.answer, null);
  assert.ok(t1.turn.trace.length >= 2, "what was thought so far is kept");
  assert.equal(t1.turn.contest.length, 0);
});

test("no clock: with no `now` every date check is unmeasured (the answer says so), it never reads a clock", async () => {
  const c = caseOf("A1");
  const w = world(c);
  const turn = await runAnswerTurn({ question: c.ask, lang: "en", passages: passagesOf(c), deps: w.deps });
  assert.equal(turn.answer.standing, "unmeasured");
  assert.ok(turn.answer.unmeasured.some((u) => /still living/.test(u)));
});

test("lang: a string, an object, or nothing (read by function words) all work; the turn names the language and who said so", async () => {
  const c = caseOf("A6");
  for (const lang of ["en", { code: "en", by: "the interface" }, undefined]) {
    const turn = await runAnswerTurn({ question: c.ask, lang, passages: passagesOf(c), now: NOW, deps: world(c).deps });
    assert.ok(turn.answer || turn.handoff, String(lang));
    if (turn.answer) { assert.equal(turn.lang.code, "en"); assert.ok(turn.lang.by); }
  }
});

test("plain words on screen: no apparatus noun, no archon name, no 'void' or 'EOT' in the trace, the gap labels or the handoff", async () => {
  const banned = /\b(void|EOT|archon|probe|frame|T1|T2|slot|referent|row|tier|polarity|witness)\b/i;
  for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A8b"]) {
    const c = caseOf(id);
    const { turn } = await run(c, {}, { passages: id === "A5" ? passagesOf(c, ["Royal family (stale snapshot)"]) : passagesOf(c) });
    for (const l of turn.trace) for (const s of [l.say, l.detail, l.result]) if (s) assert.doesNotMatch(s.replace(/“[^”]*”/g, ""), banned, id + ": " + s);
  }
  for (const w of Object.values(HANDOFF_WHY)) assert.doesNotMatch(w, banned);
});

// ── realise ──────────────────────────────────────────────────────────────────────────────────────────────────────
test("realise: only the row's own words — a clause cut at the first boundary; a slot with no template (time) and a row with no filler are the sentence verbatim", () => {
  const frame = { slot: "person", lang: "en" };
  const text = "Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded in 2022.";
  const row = { sentence: text, filler: { text: "Charles III", span: [0, 11] }, emphasis: [[0, 11], [19, 23], [31, 45]] };
  assert.equal(realise(row, frame, { fw: FW, lang: "en" }), "Charles III is the king of the United Kingdom.");
  assert.equal(realise({ ...row, filler: null }, frame, { fw: FW, lang: "en" }), text);
  assert.equal(realise(row, { slot: "time" }, { fw: FW, lang: "en" }), text);
  assert.equal(realise(row, frame, { fw: FW, lang: "xx" }), text, "a language with no table: the verbatim sentence, never an English template");
  assert.equal(realise({ ...row, filler: { text: "WRONG", span: [0, 5] } }, frame, { fw: FW, lang: "en" }), text, "a filler whose span does not hold its text is not trusted");
  const sp = "Spiders are air-breathing arthropods that have eight legs, chelicerae with fangs.";
  const e0 = sp.indexOf("eight"), l0 = sp.indexOf("legs");
  const spider = { sentence: sp, filler: { text: "eight", span: [e0, e0 + 5] }, emphasis: [[0, 7], [e0, e0 + 5], [l0, l0 + 4]] };
  assert.equal(realise(spider, { slot: "quantity" }, { fw: FW, lang: "en" }), "Spiders have eight legs.");
  assert.equal(realise({ ...spider, emphasis: [[e0, e0 + 5], [l0, l0 + 4]] }, { slot: "quantity" }, { fw: FW, lang: "en" }), spider.sentence, "no subject span → verbatim");
});

test("DECLARED says who gave it", () => {
  assert.ok(DECLARED.maxCandidates >= 1 && DECLARED.maxCandidates <= 3);
});
