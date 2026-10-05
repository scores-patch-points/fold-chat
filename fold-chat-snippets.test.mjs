import { test } from "node:test";
import assert from "node:assert/strict";
import { snippetsSufficient, snippetPassages, makeBackground, learnBackground, exportBackground, languageOf, DECLARED } from "./fold-chat-snippets.js";
import { searchWeb, makeMemo } from "./fold-chat-web.js";

const card = (host, title, snippet) => ({ title, url: `https://${host}/p`, snippet, source: host, kind: "web" });
const pad = " This sentence is here so that the card is long enough to count as a card on its own.";
// A background in which function words are common (measured over many cards) and everything else is rare.
const bgEn = () => makeBackground({ en: { n: 400, df: { what: 300, is: 380, the: 390, of: 370, a: 360, in: 350, and: 340, to: 330, it: 300, this: 310, that: 290, as: 280, on: 270, for: 260, so: 200, here: 150, card: 140, long: 120, enough: 110, count: 100, own: 100, sentence: 90, its: 200, are: 250, was: 240, by: 230, with: 220, from: 210, capital: 90, city: 120, who: 100, year: 110 } } });

const SERP = [
  card("a.test", "Capital of Australia", "Canberra is the capital city of Australia, chosen as a compromise." + pad),
  card("b.test", "Australia's capital", "The capital of Australia is Canberra, not Sydney." + pad),
  card("c.test", "Canberra facts", "Canberra, the national capital of Australia, sits inland." + pad),
  card("d.test", "Sydney", "Sydney is Australia's largest city and a popular destination." + pad),
];

test("independent sites on the question's topic agreeing on a rare term → the cards are sufficient, and the cards that carry the term are handed over", () => {
  const out = snippetsSufficient(SERP, "what is the capital of Australia", { background: bgEn() });
  assert.equal(out.sufficient, true, out.why);
  assert.equal(out.term, "canberra");
  assert.ok(out.hosts >= 3);
  assert.ok(out.covering.every((r) => /canberra/i.test(r.title + r.snippet)));
});

test("a no-answer question fails the on-topic test: no card carries ALL its rare words, so nothing is handed over", () => {
  const nonsense = [
    card("a.test", "Hanseatic League", "The Hanseatic League was a medieval trade network of north German towns." + pad),
    card("b.test", "Hansa history", "The Hansa dominated Baltic trade for centuries before its decline." + pad),
    card("c.test", "Rivets", "A rivet is a permanent mechanical fastener used in bridges and ships." + pad),
    card("d.test", "Riveting", "Rivets are installed hot or cold depending on the metal in use here." + pad),
  ];
  const out = snippetsSufficient(nonsense, "how many rivets does the Hanseatic League have", { background: bgEn() });
  assert.equal(out.sufficient, false);
  assert.equal(out.abstained, false);
});

test("a language with too little background ABSTAINS — read the pages — instead of guessing", () => {
  const out = snippetsSufficient(SERP, "what is the capital of Australia", { background: makeBackground() });
  assert.equal(out.sufficient, false);
  assert.equal(out.abstained, true);
  assert.match(out.why, /reading the pages instead/);
  const thin = makeBackground({ en: { n: DECLARED.minBackground - 1, df: {} } });
  assert.equal(snippetsSufficient(SERP, "what is the capital of Australia", { background: thin }).abstained, true);
});

test("one site is not independent sources — the same rare term on 2 sites is not enough", () => {
  const two = SERP.slice(0, 2).concat(SERP.slice(3));
  assert.equal(snippetsSufficient(two, "what is the capital of Australia", { background: bgEn() }).sufficient, false);
});

test("the background learns a SERP only when told to (after it is judged), per language, and exports as plain JSON", () => {
  const bg = makeBackground();
  assert.equal(snippetsSufficient(SERP, "what is the capital of Australia", { background: bg }).abstained, true);
  assert.equal(bg.byLang.size, 0, "judging does not learn");
  learnBackground(bg, "en", SERP);
  assert.equal(bg.byLang.get("en").n, SERP.length);
  assert.ok(bg.byLang.get("en").df.get("canberra") >= 3);
  learnBackground(bg, "unknown", SERP);
  assert.ok(!bg.byLang.has("unknown"));
  const json = exportBackground(bg);
  assert.ok(json.en.df.canberra >= 3 && !("here" in json.en.df && json.en.df.here < 2));
  assert.equal(makeBackground(json).byLang.get("en").n, SERP.length, "a seed round-trips");
});

test("languageOf reads the cards, not just the question — 'who wrote Moby Dick' alone is too short for the detector", () => {
  const cards = [card("a.test", "Moby-Dick", "Moby-Dick is a novel by Herman Melville, and it was published in the year 1851 and is one of the great works of the English language." + pad)];
  assert.equal(languageOf("who wrote Moby Dick", cards), "en");
});

test("snippetPassages: one per distinct site, labelled as snippets, never as read pages", () => {
  const p = snippetPassages([...SERP, SERP[0]]);
  assert.equal(p.length, 4);
  assert.ok(p.every((x) => x.snippetOnly === true && x.via === "snippet"));
});

const resp = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
const net = (log) => async (u) => { log.push(new URL(u).hostname); return /holodeck-proxy.*search/.test(u) ? resp({ engine: "DDG", results: SERP.map(({ title, url, snippet, source }) => ({ title, url, snippet, source })) }) : resp("<title>T</title><p>" + "A page body about Canberra the capital of Australia. ".repeat(30) + "</p>"); };
const seeded = () => makeMemo({ backgroundSeed: { en: { n: 400, df: Object.fromEntries([...bgEn().byLang.get("en").df]) } } });

test("searchWeb snippetFirst + a seeded background: sufficient cards → NO page is fetched, passages are snippets, the trace says why", async () => {
  const log = [];
  const out = await searchWeb("what is the capital of Australia", { fetchImpl: net(log), snippetFirst: true, direct: false, memo: seeded() });
  assert.ok(out.passages.length >= 1 && out.passages.every((p) => p.snippetOnly));
  assert.ok(!log.some((h) => /^[a-d]\.test$/.test(h)), "no result page was fetched");
  assert.ok(out.trace.some((t) => t.scope === "snippets" && t.sufficient && t.term === "canberra"));
});

test("searchWeb snippetFirst with NO background (cold start) abstains and reads the pages as before", async () => {
  const log = [];
  const out = await searchWeb("what is the capital of Australia", { fetchImpl: net(log), snippetFirst: true, direct: false, memo: makeMemo({ backgroundSeed: null }) });
  assert.ok(log.some((h) => /^[a-d]\.test$/.test(h)), "pages were fetched");
  assert.ok(out.trace.some((t) => t.scope === "snippets" && t.abstained));
});

test("searchWeb snippetFirst OFF (the default): pages are read exactly as before — and the background still learns", async () => {
  const log = []; const memo = makeMemo({ backgroundSeed: null });
  const out = await searchWeb("what is the capital of Australia", { fetchImpl: net(log), direct: false, memo });
  assert.ok(log.some((h) => /^[a-d]\.test$/.test(h)));
  assert.ok(out.passages.some((p) => !p.snippetOnly));
  assert.ok(memo.background.byLang.get("en").n >= 4, "it learned the SERP so the rule can speak later");
});

test("searchWeb snippetFirst: deep effort always reads", async () => {
  const log = [];
  await searchWeb("what is the capital of Australia", { fetchImpl: net(log), snippetFirst: true, effort: "deep", direct: false, memo: seeded() });
  assert.ok(log.some((h) => /^[a-d]\.test$/.test(h)));
});

test("makeMemo ships with the English seed, so snippetFirst can be switched on without a cold start", () => {
  const m = makeMemo();
  assert.ok(m.background.byLang.get("en").n >= 300);
  assert.equal(makeMemo({ backgroundSeed: null }).background.byLang.size, 0);
});
