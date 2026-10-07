// fold-chat-answerturn-wiring.test.mjs — the WIRE task: the seams between the chat (fold-chat.js run()) and the slot-ask pipeline, tested
// WITHOUT a browser, a server, a model or the real network. A fake encyclopedia API stands in for the world (the same shape fold-e2e-popper.mjs
// stubs: a title service, a search, an extract), behind ONE fetch that logs every outbound call.
//   · the stored message satisfies contentAllowed (the model-never-alone invariant), and the invariant still refuses what it refused
//   · a handoff leaves today's path alone (nothing is fetched for an ask that is not a slot ask; a language with no grammar hands off)
//   · retrieval works with the open-web relay down (the pages the frame's names lead to are read from the encyclopedia alone)
//   · the stored answerTurn survives a JSON round trip and the session merge
//   · fold-chat.js really calls the seams where the contract says (a static check of the source, so a re-ordered edit cannot unwire it)
// FALSIFIER tests are marked: each fails if the claim it guards is wrong.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { contentAllowed } from "./fold-chat-strand.js";
import { mergeSessions } from "./fold-chat-sessions.js";
import { answerCardModel } from "./fold-chat-answercard.js";
import { newTurnTrace, lineEvent, storeEvents } from "./fold-chat-turnfeed.js";
import { caseless } from "./fold-chat-frame.js";
import { wikiLead, referentPassages } from "./fold-chat-web.js";
import {
  WIRE, SLOW_WHY, slotTurnWanted, slotPipelineOn, SLOT_PIPELINE_KEY, passagesForTurn, slotDeps, runSlotTurn, endsTurn, answerLine, storeAnswerTurn, traceFeed, answerRecordNote, answerProcessLine,
} from "./fold-chat-answerwire.js";

const ROWS = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const CHAT_SRC = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
const WIRE_SRC = fs.readFileSync(new URL("./fold-chat-answerwire.js", import.meta.url), "utf8");
const titlesOf = (id) => ROWS.cases.find((c) => c.id === id).titles;
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── the world (page texts as fold-e2e-popper.mjs stubs them; each is at least 200 chars, as an encyclopedia extract is) ─────────────
const PAGES = {
  monarchyUK: { title: "Monarchy of the United Kingdom", text: "The monarchy of the United Kingdom is the constitutional form of government by which a hereditary monarch reigns as head of state of the United Kingdom. Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded to the throne on 8 September 2022. The monarch is a constitutional figurehead; executive power is exercised by the government led by the prime minister." },
  charles3: { title: "Charles III", text: "Charles III (Charles Philip Arthur George; born 14 November 1948) is King of the United Kingdom and the 14 other Commonwealth realms. He acceded to the throne on 8 September 2022, upon the death of his mother, Elizabeth II. He was crowned at Westminster Abbey on 6 May 2023." },
  staleMonarchy: { title: "Monarchy of the United Kingdom", text: "The monarchy of the United Kingdom is the constitutional form of government by which a hereditary monarch reigns as head of state of the United Kingdom. Elizabeth II is the queen of the United Kingdom and the other Commonwealth realms, the reigning monarch since 6 February 1952. The monarch is a constitutional figurehead; executive power is exercised by the government led by the prime minister." },
  elizabethLead: { title: "Elizabeth II", text: "Elizabeth II (21 April 1926 – 8 September 2022) was Queen of the United Kingdom and the other Commonwealth realms from 6 February 1952 until her death in 2022. She was succeeded by her eldest son, Charles III. Her reign of 70 years and 214 days was the longest of any British monarch." },
  australia: { title: "Australia", text: "Australia, officially the Commonwealth of Australia, is a country comprising the mainland of the Australian continent, the island of Tasmania and numerous smaller islands. It is the sixth-largest country by total area and has a population of about twenty-seven million people, most of whom live near the coasts." },
  pmUK: { title: "Prime Minister of the United Kingdom", text: "The prime minister of the United Kingdom is the head of government of the United Kingdom. The current prime minister is Andy Burnham, who has held the office since 20 July 2026. The prime minister is appointed by the monarch." },
  monarchyFR: { title: "List of French monarchs", text: "Louis XVI was the last king of France before the fall of the monarchy during the French Revolution; he reigned from 1774 until 1792. The monarchy was abolished in September 1792 and France was proclaimed a republic. France has had no king since the final removal of the monarchy in 1848." },
  spider: { title: "Spider", text: "Spiders are air-breathing arthropods that have eight legs, chelicerae with fangs, and spinnerets that extrude silk. They are the largest order of arachnids and rank seventh in total species diversity among all orders of organisms." },
  ww2: { title: "World War II", text: "World War II, also known as the Second World War, was a global conflict between two coalitions, the Allies and the Axis powers. It lasted from 1 September 1939 to 2 September 1945. It involved the vast majority of the world's countries, including all of the great powers." },
  canberra: { title: "Canberra", text: "Canberra is the capital city of Australia. Founded following the federation of the colonies of Australia as the seat of government for the new nation, it is Australia's largest inland city. Canberra is located at the northern end of the Australian Capital Territory." },
  usPresident: { title: "President of the United States", text: "The president of the United States (POTUS) is the head of state and head of government of the United States. The power of the presidency has grown since the first president, George Washington, took office in 1789. The president is elected to a four-year term and may serve at most two terms." },
  frPresident: { title: "President of France", text: "The president of France, officially the President of the French Republic, is the head of state of France. The president is elected for a five-year term. The office of president was created by the Constitution of the Fifth Republic in 1958." },
};
// what the title service answers for the names that can be fillers (the ask's own names come from the fixture's table)
const FILLERS = {
  "charles iii": { title: "Charles III", redirectedFrom: null, disambiguation: false },
  "elizabeth ii": { title: "Elizabeth II", redirectedFrom: null, disambiguation: false },
  "canberra": { title: "Canberra", redirectedFrom: null, disambiguation: false },
  "andy burnham": { title: "Andy Burnham", redirectedFrom: null, disambiguation: false },
  "louis xvi": { title: "Louis XVI", redirectedFrom: null, disambiguation: false },
};
const wiki = (t) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_"));
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), body: null });

/** A fake encyclopedia behind ONE fetch. `pages` are returned by every search; `world` pages only by a search whose words match. Every
 *  call is logged; any host but the encyclopedia is REFUSED (the open-web relay is down) and counted. */
function fakeWorld({ titles, pages = [], world = [], hangLeads = false }) {
  const log = { calls: [], searches: [], titleAsks: [], refused: 0, extracts: [] };
  const all = () => pages.concat(world.flatMap((w) => w.pages));
  const fetchImpl = async (url, o = {}) => {
    const u = String(url);
    log.calls.push(u);
    if (o.signal && o.signal.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
    if (!/^https:\/\/en\.wikipedia\.org\/w\/api\.php/.test(u)) { log.refused++; return json({}, 502); }
    if (/list=search/.test(u)) {
      const q = decodeURIComponent((u.match(/srsearch=([^&]*)/) || [])[1] || "").replace(/\+/g, " ");
      log.searches.push(q);
      const hit = pages.concat(world.filter((w) => w.when.test(q)).flatMap((w) => w.pages));
      return json({ query: { search: hit.map((p) => ({ title: p.title, snippet: p.text.slice(0, 120), wordcount: 5000 })) } });
    }
    if (/prop=extracts/.test(u)) {
      const t = decodeURIComponent((u.match(/titles=([^&]*)/) || [])[1] || "");
      log.extracts.push({ title: t, intro: /exintro=1/.test(u) });
      if (hangLeads && /exintro=1/.test(u)) return new Promise((_, rej) => { o.signal && o.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); }); });
      const p = all().find((x) => x.title === t);
      return json({ query: { pages: { 1: { title: p ? p.title : t, extract: p ? p.text : "" } } } });
    }
    if (/prop=pageprops/.test(u)) {
      const cands = decodeURIComponent((u.match(/titles=([^&]*)/) || [])[1] || "").split("|");
      log.titleAsks.push(cands);
      const redirects = [], normalized = [], pgs = [];
      for (const c of cands) {
        const e = titles[caseless(c)] ?? FILLERS[caseless(c)] ?? null;
        if (!e) { pgs.push({ title: c, ns: 0, missing: "" }); continue; }
        if (e.redirectedFrom) redirects.push({ from: c, to: e.title }); else if (c !== e.title) normalized.push({ from: c, to: e.title });   // the API folds a title's first letter itself
        pgs.push({ title: e.title, ns: 0, ...(e.disambiguation ? { pageprops: { disambiguation: "" } } : {}) });
      }
      return json({ query: { normalized, redirects, pages: pgs } });
    }
    return json({});
  };
  return { fetchImpl, log };
}
const asPassage = (p) => ({ ref: "en.wikipedia.org — " + p.title, source: wiki(p.title), url: wiki(p.title), text: p.text, via: "direct" });
const NOW = new Date("2026-10-06T12:00:00Z");

// ── 1. the stored message and the invariant ────────────────────────────────────────────────────────────────────────────────────
async function turnFor(ask, caseId, { pages, world = [], read = pages, now = NOW } = {}) {
  const w = fakeWorld({ titles: titlesOf(caseId), pages, world });
  const turn = await runSlotTurn({ question: ask, lang: "en", webPassages: read.map(asPassage), searchQ: ask, now, fetchImpl: w.fetchImpl });
  return { turn, ...w };
}
/** The message exactly as fold-chat.js stores a slot turn (authored by the sources, no snips, the answer line as content). */
const storedMessage = (turn) => ({ role: "assistant", content: answerLine(turn), mode: "chat", authored: "sources", answerTurn: storeAnswerTurn(turn), grounding: { nSources: 1, kind: "research", authored: "sources" } });

test("INVARIANT: a stored slot answer (A1) satisfies contentAllowed — authored by the sources, content = the realised line", async () => {
  const { turn } = await turnFor("Who is the king of the UK?", "A1", { pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }] });
  assert.ok(turn.answer, JSON.stringify(turn.gap || turn));
  const msg = storedMessage(turn);
  assert.equal(msg.content, "Charles III is the king of the United Kingdom.");
  assert.equal(contentAllowed(msg), true);
  assert.equal(msg.snips, undefined, "a slot turn is not a strand: it carries no snips");
});

test("INVARIANT: a typed gap and a contest are stored with content '' (drawn, not said) and satisfy contentAllowed", async () => {
  const gap = (await turnFor("Who is the president of the UK?", "A2", { pages: [PAGES.usPresident, PAGES.frPresident] })).turn;
  assert.ok(gap.gap, "A2 is a typed gap");
  assert.equal(storedMessage(gap).content, "");
  assert.equal(contentAllowed(storedMessage(gap)), true);
  const contest = { schema: "AnswerTurn@1", contest: [{ sentence: "A is the king of X.", source: { title: "T", url: "https://e.org/a" } }, { sentence: "B is the king of X.", source: { title: "U", url: "https://e.org/b" } }], answer: null, gap: null, trace: [] };
  assert.equal(storedMessage(contest).content, "");
  assert.equal(contentAllowed(storedMessage(contest)), true);
});

test("FALSIFIER: the invariant still REFUSES a slot message whose content is not the answer line, adds a word the source lacks, or has no answer at all", async () => {
  const { turn } = await turnFor("Who is the king of the UK?", "A1", { pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }] });
  const ok = storedMessage(turn);
  assert.equal(contentAllowed(ok), true);
  assert.equal(contentAllowed({ ...ok, content: ok.content + " And the model added this." }), false, "extra words the source sentence does not hold");
  assert.equal(contentAllowed({ ...ok, content: "Charles III is the king of Narnia." }), false, "a word the source sentence lacks");
  assert.equal(contentAllowed({ ...ok, content: "The king is Charles III." }), false, "content that is not the answer's own text is refused even when every word is in the sentence");
  const noAnswer = { ...ok, answerTurn: { ...ok.answerTurn, answer: null } };
  assert.equal(contentAllowed(noAnswer), false, "content with no answer behind it");
  const noRow = { ...ok, answerTurn: { ...ok.answerTurn, answer: { ...ok.answerTurn.answer, row: null } } };
  assert.equal(contentAllowed(noRow), false, "an answer that cannot show its source sentence");
  const noSource = { ...ok, answerTurn: { ...ok.answerTurn, answer: { ...ok.answerTurn.answer, row: { ...ok.answerTurn.answer.row, source: null } } } };
  assert.equal(contentAllowed(noSource), false, "an answer with no source");
  assert.equal(contentAllowed({ ...ok, authored: "sources", answerTurn: undefined, snips: undefined }), false, "sources-authored with neither snips nor an answer turn is still refused");
});

test("the strand branch of the invariant is unchanged (snips must equal content)", () => {
  const snips = [{ n: 1, text: "A sentence.", source: "https://e.org/p", title: "P", site: "e.org", credit: "from e.org", kind: "passage" }];
  assert.equal(contentAllowed({ role: "assistant", content: "A sentence.", authored: "sources", snips }), true);
  assert.equal(contentAllowed({ role: "assistant", content: "A sentence. plus", authored: "sources", snips }), false);
  assert.equal(contentAllowed({ role: "assistant", content: "A sentence.", authored: "sources", snips: [] }), false);
});

// ── 2. the gate and the passages ───────────────────────────────────────────────────────────────────────────────────────────────
test("slotTurnWanted: research/chat that searches the web, not live-data, either answer mode; nothing else", () => {
  const yes = { enabled: true, kind: "research", wantWeb: true, liveHit: null, answerMode: "facing" };
  assert.equal(slotTurnWanted(yes), true);
  assert.equal(slotTurnWanted({ ...yes, kind: "chat" }), true);
  assert.equal(slotTurnWanted({ ...yes, answerMode: "snips" }), true, "a slot ask ignores the mode");
  for (const kind of ["smalltalk", "generate", "compute", "transform", "code", "compose", "advice"]) assert.equal(slotTurnWanted({ ...yes, kind }), false, kind);
  assert.equal(slotTurnWanted({ ...yes, wantWeb: false }), false, "a follow-up answered from the thread searches nothing");
  assert.equal(slotTurnWanted({ ...yes, liveHit: { what: "weather" } }), false, "a live-data ask is a different gap");
  assert.equal(slotTurnWanted({ ...yes, answerMode: "weird" }), false);
});

test("passagesForTurn: title/host/lang come from what the page says it is; a search snippet is not a read page", () => {
  const out = passagesForTurn([
    { ref: "en.wikipedia.org — Monarchy of the United Kingdom", source: wiki("Monarchy of the United Kingdom"), url: wiki("Monarchy of the United Kingdom"), text: "Charles III is the king." },
    { ref: "stub — Charles III - Wikipedia", url: "https://es.wikipedia.org/wiki/Carlos_III", text: "Carlos." },
    { ref: "x — A snippet", url: "https://e.org/s", text: "just a snippet of a search result, long enough", snippetOnly: true },
    { ref: "x — Empty", url: "https://e.org/e", text: "   " },
    null,
  ], { query: "q" });
  assert.equal(out.length, 2);
  assert.equal(out[0].title, "Monarchy of the United Kingdom"); assert.equal(out[0].host, "en.wikipedia.org"); assert.equal(out[0].lang, "en"); assert.equal(out[0].query, "q");
  assert.equal(out[1].title, "Charles III", "the relay's ' - Wikipedia' suffix is not part of the title"); assert.equal(out[1].lang, "es");
  assert.deepEqual(out.map((p) => p.ref), ["S1", "S2"]);
  const plain = passagesForTurn([{ ref: "e.org — A page", url: "https://e.org/a", text: "Some prose here." }])[0];
  assert.equal("lang" in plain, false, "a host that names no edition leaves the language to the ask's own grammar");
});

// ── 3. the pipeline over the wire: answers, refutations, gaps ──────────────────────────────────────────────────────────────────
test("A1 over the wire: answer + cite + a search that NAMES Charles III, every call through the one fetch, the model never involved", async () => {
  const { turn, log } = await turnFor("Who is the king of the UK?", "A1", { pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }] });
  assert.equal(turn.schema, "AnswerTurn@1");
  assert.equal(turn.answer.text, "Charles III is the king of the United Kingdom.");
  assert.equal(turn.answer.standing, "survived");
  assert.equal(turn.answer.row.source.title, "Monarchy of the United Kingdom");
  assert.ok(log.searches.some((q) => /charles iii/i.test(q)), "a search names the claim: " + JSON.stringify(log.searches));
  assert.ok(turn.searched.some((q) => /Charles III/.test(q)));
  assert.ok(turn.trace.some((l) => /Charles III/.test(l.say) && /search/i.test(l.say)));
  assert.equal(log.refused, 0, "nothing but the encyclopedia was asked");
  assert.ok(log.calls.every((c) => /^https:\/\/en\.wikipedia\.org\//.test(c)));
  assert.equal(endsTurn(turn), true);
});

test("FALSIFIER A5 over the wire: the stale holder is not shipped as current — the refuting passage is the closest source", async () => {
  const { turn, log } = await turnFor("Who is the monarch of the UK?", "A5", { pages: [PAGES.staleMonarchy], world: [{ when: /elizabeth/i, pages: [PAGES.elizabethLead] }, { when: /charles/i, pages: [PAGES.charles3] }] });
  assert.equal(turn.answer, null, "Elizabeth II must not be the shipped answer: " + JSON.stringify(turn.answer));
  assert.equal(turn.gap && turn.gap.kind, "refuted");
  assert.match(turn.gap.closest.sentence, /8 September 2022/);
  assert.ok(log.searches.some((q) => /elizabeth/i.test(q)));
  assert.equal(storedMessage(turn).content, "", "a refuted claim is not stored as content");
  assert.equal(contentAllowed(storedMessage(turn)), true);
});

test("A6 over the wire (control): a true witnessed slot ask ships", async () => {
  const { turn } = await turnFor("What is the capital of Australia?", "A6", { pages: [PAGES.canberra] });
  assert.ok(turn.answer, JSON.stringify(turn.gap));
  assert.match(turn.answer.text, /Canberra/);
});

test("A4 / A3 / A7 / A8 over the wire (the answers the contract names, the impressions the chat really hands over, no model)", async () => {
  const a4 = (await turnFor("Who is the prime minister of the UK?", "A4", { pages: [PAGES.pmUK] })).turn;
  assert.equal(a4.answer && a4.answer.text, "The current prime minister is Andy Burnham.");
  assert.doesNotMatch(JSON.stringify(a4), /Sunak/);
  const a3 = (await turnFor("Who is the king of France?", "A3", { pages: [PAGES.monarchyFR] })).turn;
  assert.equal(a3.answer, null, "a past-tense sentence cannot witness a present holder");
  assert.equal(a3.gap.kind, "no_present_holder");
  assert.match(a3.gap.closest.sentence, /was the last king of France/);
  const a7 = (await turnFor("How many legs does a spider have?", "A7", { pages: [PAGES.spider] })).turn;
  assert.equal(a7.answer && a7.answer.text, "Spiders have eight legs.");
  const a8 = (await turnFor("What year did World War 2 end?", "A8", { pages: [PAGES.ww2] })).turn;
  const years = JSON.stringify(a8).match(/\b\d{4}\b/g) || [];
  assert.ok(years.every((y) => PAGES.ww2.text.includes(y)), "no year the page never states: " + years);
  assert.ok(a8.gap || a8.answer, "an answer or an honest closest sentence");
  for (const t of [a4, a3, a7, a8]) { const m = storedMessage(t); assert.equal(contentAllowed(m), true); assert.equal(endsTurn(t), true); }
});

test("RELAY DOWN: with nothing read by the web search, the pages the frame's names lead to are read from the encyclopedia alone", async () => {
  const w = fakeWorld({ titles: titlesOf("A6"), pages: [PAGES.canberra, PAGES.australia] });
  const turn = await runSlotTurn({ question: "What is the capital of Australia?", lang: "en", webPassages: [], searchQ: "What is the capital of Australia?", now: NOW, fetchImpl: w.fetchImpl });
  assert.ok(turn.answer, JSON.stringify(turn.gap));
  assert.match(turn.answer.text, /Canberra/);
  assert.ok(turn.trace.some((l) => /wider|read/i.test(l.say)), "the wider read is on the trace");
  assert.equal(w.log.refused, 0);
  assert.ok(w.log.searches.length >= 1);
});

test("referentPassages: the frame's own words are the query (no interrogative), at most `max` pages, each read verbatim; a page that cannot be read is absent", async () => {
  const w = fakeWorld({ titles: {}, pages: [PAGES.monarchyUK, PAGES.charles3] });
  const frame = { referents: [{ surface: "UK", title: "United Kingdom" }], predicate: [{ surface: "king", stem: "king" }] };
  const out = await referentPassages(frame, { fetchImpl: w.fetchImpl, max: 2 });
  assert.deepEqual(w.log.searches, ["United Kingdom king"]);
  assert.equal(out.length <= 2, true);
  assert.deepEqual(out.map((p) => p.title), ["Monarchy of the United Kingdom", "Charles III"]);
  for (const p of out) { assert.equal(p.lang, "en"); assert.equal(p.host, "en.wikipedia.org"); assert.ok(p.url.startsWith("https://en.wikipedia.org/wiki/")); assert.ok(p.text.length >= 200); assert.equal(p.query, "United Kingdom king"); }
  assert.deepEqual(await referentPassages({ referents: [], predicate: [] }, { fetchImpl: w.fetchImpl }), [], "no names, no read");
});

test("wikiLead: the search names the claim, the page whose TITLE is the name wins over a higher hit, and the extract is the intro", async () => {
  const w = fakeWorld({ titles: {}, pages: [{ title: "Charles III of Spain", text: "Charles III of Spain (20 January 1716 – 14 December 1788) was King of Spain." }, PAGES.charles3] });
  const lead = await wikiLead("Charles III", { fetchImpl: w.fetchImpl });
  assert.equal(lead.title, "Charles III");
  assert.match(lead.extract, /born 14 November 1948/);
  assert.equal(lead.url, wiki("Charles III"));
  assert.deepEqual(w.log.searches, ["Charles III"]);
  assert.equal(w.log.extracts[0].intro, true);
  const none = await wikiLead("Nobody At All", { fetchImpl: fakeWorld({ titles: {}, pages: [] }).fetchImpl });
  assert.equal(none, null);
});

// ── 4. a handoff leaves today's path alone ─────────────────────────────────────────────────────────────────────────────────────
test("HANDOFF: an ask that is not a slot ask fetches NOTHING and hands off (today's path runs unchanged)", async () => {
  for (const ask of ["pancake recipe", "tell me about the Eiffel Tower", "write a poem about spring", "hello"]) {
    const w = fakeWorld({ titles: {}, pages: [PAGES.canberra] });
    const r = await runSlotTurn({ question: ask, lang: "en", webPassages: [asPassage(PAGES.canberra)], now: NOW, fetchImpl: w.fetchImpl });
    assert.ok(r.handoff, ask + " -> " + JSON.stringify(r).slice(0, 200));
    assert.equal(r.handoff.kind, "not_a_slot_ask");
    assert.match(r.handoff.why, /usual way/);
    assert.equal(w.log.calls.length, 0, "no outbound call for a non-slot ask: " + ask);
    assert.equal(endsTurn(r), false);
  }
});

test("HANDOFF (item 5): a language with no function-word/grammar prior hands off with a typed reason and fetches nothing", async () => {
  for (const [ask, lang] of [["¿Quién es el rey de España?", "es"], ["Qui est le roi de la France ?", "fr"], ["谁是英国的国王？", "zh"], ["\u00bfQui\u00e9n es el presidente de M\u00e9xico?", undefined]]) {
    const w = fakeWorld({ titles: {}, pages: [PAGES.monarchyUK] });
    const r = await runSlotTurn({ question: ask, lang: lang ? { code: lang, by: "function words" } : "unknown", webPassages: [asPassage(PAGES.monarchyUK)], now: NOW, fetchImpl: w.fetchImpl });
    assert.ok(r.handoff, ask);
    assert.equal(r.handoff.kind, "no_grammar_for_language", ask);
    assert.equal(w.log.calls.length, 0, ask);
  }
});

test("HANDOFF: the title service being down is a handoff (the frame's names could not be matched), never a guess", async () => {
  const down = async () => json({}, 503);
  const r = await runSlotTurn({ question: "Who is the king of the UK?", lang: "en", webPassages: [asPassage(PAGES.monarchyUK)], now: NOW, fetchImpl: down });
  assert.ok(r.handoff); assert.equal(r.handoff.kind, "referents_unresolved");
});

test("TIME BOX: a slot turn that hangs is abandoned for the usual path, and says why in plain words", async () => {
  const w = fakeWorld({ titles: titlesOf("A1"), pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }], hangLeads: true });
  const r = await runSlotTurn({ question: "Who is the king of the UK?", lang: "en", webPassages: [asPassage(PAGES.monarchyUK)], searchQ: "q", now: NOW, fetchImpl: w.fetchImpl, timeBoxMs: 60 });
  assert.ok(r.handoff, JSON.stringify(r).slice(0, 200));
  assert.equal(r.handoff.kind, "too_slow");
  assert.equal(r.handoff.why, SLOW_WHY);
  assert.equal(endsTurn(r), false);
});

test("STOP: an aborted turn comes back aborted (no answer, no handoff) so the chat draws no card", async () => {
  const ac = new AbortController();
  const w = fakeWorld({ titles: titlesOf("A1"), pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }], hangLeads: true });
  const p = runSlotTurn({ question: "Who is the king of the UK?", lang: "en", webPassages: [asPassage(PAGES.monarchyUK)], now: NOW, fetchImpl: w.fetchImpl, signal: ac.signal });
  setTimeout(() => ac.abort(), 30);
  const r = await p;
  assert.ok(r.aborted, JSON.stringify(r).slice(0, 200));
  assert.equal(r.answer, null);
  assert.equal(endsTurn(r), false);
  const pre = new AbortController(); pre.abort();
  const r2 = await runSlotTurn({ question: "Who is the king of the UK?", lang: "en", webPassages: [], now: NOW, fetchImpl: w.fetchImpl, signal: pre.signal });
  assert.ok(r2.aborted);
});

test("endsTurn / answerLine: an answer, a contest or a gap end the turn; a handoff, an abort and nothing do not", () => {
  assert.equal(endsTurn({ answer: { text: "A." } }), true);
  assert.equal(endsTurn({ contest: [{}, {}] }), true);
  assert.equal(endsTurn({ gap: { kind: "unwitnessed" } }), true);
  assert.equal(endsTurn({ handoff: { kind: "x" } }), false);
  assert.equal(endsTurn({ aborted: true, answer: { text: "A." } }), false);
  assert.equal(endsTurn({}), false); assert.equal(endsTurn(null), false);
  assert.equal(answerLine({ answer: { text: "Charles III is the king." } }), "Charles III is the king.");
  assert.equal(answerLine({ gap: { kind: "refuted" } }), ""); assert.equal(answerLine(null), "");
});

// ── 5. persistence ────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("PERSIST: the stored answerTurn survives a JSON round trip (reload) and the session merge, and draws the same card", async () => {
  const { turn } = await turnFor("Who is the king of the UK?", "A1", { pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }] });
  const msg = storedMessage(turn);
  const reloaded = JSON.parse(JSON.stringify({ a: { id: "a", updated: "2026-10-06T10:00:00Z", messages: [{ role: "user", content: "Who is the king of the UK?" }, msg] } }));
  assert.deepEqual(reloaded.a.messages[1], clone(msg), "a JSON round trip changes nothing");
  assert.deepEqual(reloaded.a.messages[1].answerTurn, msg.answerTurn);
  assert.deepEqual(answerCardModel(reloaded.a.messages[1].answerTurn), answerCardModel(turn), "the card is the same after a reload");
  // merge: a chat only one tab has is kept whole; when both have it the later one wins WHOLE (the message is never rebuilt field by field)
  const merged = mergeSessions(reloaded, {}, {});
  assert.deepEqual(merged.a.messages[1].answerTurn, msg.answerTurn);
  const newer = clone(reloaded); newer.a.updated = "2026-10-06T11:00:00Z"; newer.a.messages[1].content = msg.content;
  const merged2 = mergeSessions(reloaded, newer, {});
  assert.deepEqual(merged2.a.messages[1].answerTurn, msg.answerTurn);
  assert.equal(contentAllowed(merged2.a.messages[1]), true);
});

test("storeAnswerTurn: plain JSON; a turn over the ceiling sheds the void's raw events but keeps what the card draws", async () => {
  const { turn } = await turnFor("Who is the king of the UK?", "A1", { pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }] });
  const stored = storeAnswerTurn(turn);
  assert.deepEqual(stored, JSON.parse(JSON.stringify(stored)));
  assert.equal(storeAnswerTurn(null), null);
  const big = clone(turn); big.void.events = [{ pad: "x".repeat(WIRE.maxStoredChars) }];
  const shed = storeAnswerTurn(big);
  assert.equal(shed.void.events, undefined);
  assert.equal(shed.answer.text, turn.answer.text); assert.deepEqual(shed.trace, turn.trace);
});

// ── 6. the feed and the record ────────────────────────────────────────────────────────────────────────────────────────────────
test("FEED: one row per trace line, in order, an unchecked line as a warning, and the rows store", async () => {
  const { turn } = await turnFor("Who is the king of the UK?", "A1", { pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }] });
  const tt = newTurnTrace({ question: "Who is the king of the UK?" });
  const evs = traceFeed(tt, turn, lineEvent);
  assert.equal(evs.length, turn.trace.length);
  assert.deepEqual(evs.map((e) => e.title), turn.trace.map((l) => l.say));
  assert.ok(evs.some((e) => e.tone === "warn") === turn.trace.some((l) => l.unmeasured));
  assert.ok(evs.every((e) => e.op === "line" && e.type === "t"));
  const stored = storeEvents(evs, { max: 60 });
  assert.equal(stored.length, evs.length);
  assert.deepEqual(traceFeed(tt, { trace: [{ say: "" }, null, { n: 1 }] }, lineEvent), [], "a blank or malformed line is not a row");
});

test("the record's summary and process line say what happened in plain words and name no model", async () => {
  const a = (await turnFor("Who is the king of the UK?", "A1", { pages: [PAGES.monarchyUK], world: [{ when: /charles/i, pages: [PAGES.charles3] }] })).turn;
  const n = answerRecordNote(a);
  assert.equal(n.outcome, "answer"); assert.equal(n.standing, "survived"); assert.equal(n.filler, "Charles III");
  assert.match(answerProcessLine(a), /^no model call/); assert.match(answerProcessLine(a), /refute/); assert.match(answerProcessLine(a), /Charles III/);
  const g = (await turnFor("Who is the monarch of the UK?", "A5", { pages: [PAGES.staleMonarchy], world: [{ when: /elizabeth/i, pages: [PAGES.elizabethLead] }, { when: /charles/i, pages: [PAGES.charles3] }] })).turn;
  assert.equal(answerRecordNote(g).outcome, "gap"); assert.equal(answerRecordNote(g).gap, "refuted");
  assert.match(answerProcessLine(g), /no answer/);
  assert.equal(answerRecordNote(null).outcome, "nothing");
});

test("slotDeps hands the pipeline ONLY the declared deps, over the one fetch it was given (nothing global, nothing a model could be)", () => {
  const seen = [];
  const deps = slotDeps({ fetchImpl: async (u) => { seen.push(u); return json({}); }, onStatus: () => {} });
  assert.deepEqual(Object.keys(deps).sort(), ["fetchLead", "fw", "resolveTitles", "searchPassages", "signal"]);
  assert.equal(typeof deps.fw, "function");
  assert.ok(deps.fw("en") instanceof Set); assert.equal(deps.fw("xx"), null);
  assert.doesNotMatch(WIRE_SRC.replace(/\/\/[^\n]*/g, ""), /\bfetch\(|Date\.now|Math\.random|client\.chat|callModel|chat\/completions/);
});

// ── 7. the chat really calls the seams (a static check: nobody may quietly unwire the slice) ────────────────────────────────
test("fold-chat.js is wired: the slot turn runs after the search and before the unsourced plan, bars the model, and is stored + drawn + reloaded", () => {
  const at = (re, from = 0) => { const m = re.exec(CHAT_SRC.slice(from)); return m ? from + m.index : -1; };
  const search = at(/const w = await raceAbort\(web\.searchWeb\(/);
  const call = at(/raceAbort\(runSlotTurn\(\{ question/);
  const plan = at(/plan = unsourcedPlan\(UNSOURCED_ANSWERS, \{ live: !!liveHit \}\)/);
  assert.ok(search > 0 && call > search && plan > call, `order: search ${search} < runSlotTurn ${call} < unsourced plan ${plan}`);
  assert.match(CHAT_SRC, /slotTurnWanted\(/);
  assert.match(CHAT_SRC, /wantWeb && !webPassages\.length && !slotTurn/, "the unsourced gap does not pre-empt a slot turn");
  assert.match(CHAT_SRC, /answerMode === "snips" && wantWeb && webPassages\.length && !slotTurn/, "a slot ask ignores the Sources-only mode");
  assert.match(CHAT_SRC, /const modelBarred = !!\(plan \|\| strand \|\| aloneBarred(?: \|\| \(genGate && !genGate\.ok\))?\)/, "the model is barred by the strand marker a slot turn sets (a failed writing gate may bar it too)");
  assert.match(CHAT_SRC, /handoff/);
  assert.match(CHAT_SRC, /traceFeed\(tt, slotRes, lineEvent\)/);
  assert.match(CHAT_SRC, /answerTurn: slotStored/, "stored on the message");
  assert.match(CHAT_SRC, /answerTurn: msgs\[i\]\.answerTurn/, "redrawn on reload");
  assert.match(CHAT_SRC, /mountAnswerCard\(body, \{ answerTurn:/, "the card is mounted where assistant messages are drawn");
  assert.match(CHAT_SRC, /for \(const b of strandMode \|\| slotCard \? \[\] : artifactsOf\(content\)\)/, "the answer line is not drawn twice (prose and card)");
  assert.match(CHAT_SRC, /else if \(slotCard\) mountAnswerCard\(body, \{ answerTurn: slotCard \}\);\s*else if \(showFace\) renderFacingPage/, "the card sits before the facing page, which is still there");
});

test("THE SWITCH: the pipeline is OFF unless enabled — a turn that would qualify in every other way does not run it", () => {
  const would = { kind: "research", wantWeb: true, liveHit: null, answerMode: "facing" };
  assert.equal(slotTurnWanted(would), false, "default off");
  assert.equal(slotTurnWanted({ ...would, enabled: false }), false);
  assert.equal(slotTurnWanted({ ...would, enabled: "on" }), false, "only the boolean true counts");
  assert.equal(slotTurnWanted({ ...would, enabled: true }), true);
});

test("slotPipelineOn reads localStorage 'fold-chat:answerPipeline' === 'on'; anything else, a missing store or a throwing store is off", () => {
  const store = (v) => ({ getItem: (k) => (k === SLOT_PIPELINE_KEY ? v : null) });
  assert.equal(SLOT_PIPELINE_KEY, "fold-chat:answerPipeline");
  assert.equal(slotPipelineOn(store("on")), true);
  for (const v of [null, "off", "1", "true", "ON", ""]) assert.equal(slotPipelineOn(store(v)), false, JSON.stringify(v));
  assert.equal(slotPipelineOn(null), false);
  assert.equal(slotPipelineOn({ getItem() { throw new Error("blocked"); } }), false);
});

test("WIRING: fold-chat.js passes the switch to slotTurnWanted (a call without it would be off for everyone, a hard-coded true would be on for everyone)", () => {
  assert.match(CHAT_SRC, /slotTurnWanted\(\{[^}]*enabled: slotPipelineOn\(\)/);
  assert.doesNotMatch(CHAT_SRC, /enabled: true/);
});
