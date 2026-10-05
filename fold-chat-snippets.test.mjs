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

// ── v2: independent chains (Bukhari), placement against a null (Fisher), little input (Chomsky / Sullivan) ──
import { registrable, chainsOf, placement, DECLARED_V2 } from "./fold-chat-snippets.js";
// every card needs its OWN tail: an identical sentence on every card is (correctly) read as a copy and merges them into one chain
const uniq = (k) => " " + Array.from({ length: 12 }, (_, j) => `w${k}x${j}`).join(" ");

test("registrable domain: en. and simple.wikipedia.org are ONE publisher; two .co.uk sites are two", () => {
  assert.equal(registrable("en.wikipedia.org"), registrable("simple.wikipedia.org"));
  assert.notEqual(registrable("a.co.uk"), registrable("b.co.uk"));
  assert.equal(registrable("www.example.com"), "example.com");
});

const cardsFor = (rs) => rs.map((r) => ({ r, host: new URL(r.url).hostname, seq: (r.title + " " + r.snippet).toLowerCase().match(/[\p{L}\p{N}']+/gu) || [] })).map((c) => ({ ...c, w: new Set(c.seq) }));

test("chainsOf: cards sharing a run of 6 words are one chain even on different domains; same domain is one chain", () => {
  const copy = "the quick brown fox jumps over the lazy dog near the river bank today";
  const rs = [card("a.test", "A", copy + uniq(1)), card("b.test", "B", "Mirror: " + copy + uniq(2)), card("c.test", "C", "Something entirely different and unrelated to foxes at all." + uniq(3)), card("sub.c.test", "C2", "Another page from the same publisher with its own words." + uniq(4))];
  const ch = chainsOf(cardsFor(rs));
  assert.equal(ch[0], ch[1], "the mirror is the same chain");
  assert.equal(ch[2], ch[3], "same registrable domain is the same chain");
  assert.notEqual(ch[0], ch[2]);
});

const PHRASING = ["Canberra serves as the capital city of Australia.", "The seat of government of Australia is Canberra.", "Australia: national capital Canberra, in the ACT.", "Many visitors ask which Australia city leads; Canberra does.", "Capital city Canberra, home of Parliament House in Australia.", "Founded as the capital in 1913, Canberra is the Australia seat of power."];
const topic = (host, extra, k) => card(host, `Capital ${host}`, `${PHRASING[k - 10]} ${extra}` + uniq(k));
const EIGHT = ["a.test", "b.test", "c.test", "d.test", "e.test", "f.test"].map((h, i) => topic(h, `Source number ${i} adds its own distinct words ${["alpha beta", "gamma delta", "epsilon zeta", "eta theta", "iota kappa", "lambda mu"][i]} here.`, i + 10))
  .concat([card("g.test", "Sydney", "Sydney is the largest city of Australia and a tourist magnet." + uniq(30)), card("h.test", "Perth", "Perth sits on the west coast of Australia near the ocean." + uniq(31))]);

test("v2: six independent chains agreeing on a rare term are PLACED against the null and the cards are sufficient", () => {
  const out = snippetsSufficient(EIGHT, "what is the capital of Australia", { background: bgEn(), lang: "en", rule: "v2" });
  assert.equal(out.sufficient, true, out.why);
  assert.equal(out.term, "canberra");
  assert.ok(out.chains >= 6 && out.placement <= DECLARED_V2.alpha);
});

test("v2: three mirrors of one page are ONE witness — too few independent chains", () => {
  const body = "Canberra is the capital of Australia, chosen as a compromise between Sydney and Melbourne in 1908.";
  const mirrors = [card("en.wikipedia.org", "Canberra", body + pad), card("simple.wikipedia.org", "Canberra", body + pad), card("wikiwand.example", "Canberra", body + pad), card("x.test", "Other", "Sydney is a large city of Australia." + uniq(40))];
  const out = snippetsSufficient(mirrors, "what is the capital of Australia", { background: bgEn(), lang: "en", rule: "v2" });
  assert.equal(out.sufficient, false);
  assert.match(out.why, /independent chain/);
  // v1 counted hosts, so it would have been fooled by the two wikipedia hostnames plus the third mirror:
  assert.equal(snippetsSufficient(mirrors, "what is the capital of Australia", { background: bgEn(), lang: "en" }).sufficient, true);
});

test("v2: a term that merely belongs to the topic's vocabulary is refused — it is what chance among these cards gives (Fisher)", () => {
  // five publishers, each writing about "uranium halflife" with 20 words drawn from one shared 40-word topic vocabulary
  const vocab = Array.from({ length: 40 }, (_, i) => `topicword${i}`);
  const draw = (seed) => { let x = seed >>> 0; const out = new Set(); let guard = 0; while (out.size < 20 && guard++ < 10000) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; out.add(vocab[(x >>> 16) % 40]); } return [...out]; };
  const rs = ["a", "b", "c", "d", "e"].map((h, i) => card(h + ".test", `Uranium halflife ${h}`, `uranium halflife discussed here: ${draw(i * 7919 + 13).join(" ")}.` + uniq(50 + i)));
  const out = snippetsSufficient(rs, "uranium halflife", { background: bgEn(), lang: "en", rule: "v2" });
  assert.equal(out.sufficient, false);
  assert.ok(out.placement !== undefined, "it got as far as a placement, so the refusal is the null's, not a count: " + out.why);
  assert.ok(out.placement > DECLARED_V2.alpha, out.why);
});

test("placement: a figure is placed against a null built by shuffling, deterministically", () => {
  const chains = Array.from({ length: 6 }, (_, i) => new Set(["shared", ...Array.from({ length: 10 }, (_, j) => `w${i}_${j}`)]));
  const p1 = placement(chains, 6, { seed: "q" }), p2 = placement(chains, 6, { seed: "q" });
  assert.equal(p1, p2);
  assert.ok(p1 <= 0.05, "6 of 6 chains sharing one term out of a large pool is far from chance: " + p1);
  const same = Array.from({ length: 4 }, () => new Set(Array.from({ length: 6 }, (_, j) => `w${j}`)));
  assert.ok(placement(same, 3, { seed: "q" }) > 0.05, "when every chain draws from the same few terms, 3 agreeing is what chance gives");
});

test("v2: speaks with three SERPs (24 cards) of same-language background, abstains below — a parameter set from little input", () => {
  const thin = makeBackground({ en: { n: DECLARED_V2.minBackground - 1, df: { what: 10, is: 20, the: 22, of: 20, a: 20 } } });
  assert.equal(snippetsSufficient(EIGHT, "what is the capital of Australia", { background: thin, lang: "en", rule: "v2" }).abstained, true);
  const ok = makeBackground({ en: { n: DECLARED_V2.minBackground, df: { what: 10, is: 20, the: 22, of: 20, a: 20 } } });
  assert.equal(snippetsSufficient(EIGHT, "what is the capital of Australia", { background: ok, lang: "en", rule: "v2" }).abstained, false);
  // v1 still wants 80
  assert.equal(snippetsSufficient(EIGHT, "what is the capital of Australia", { background: ok, lang: "en" }).abstained, true);
});

// ── v3: ask the priors first (Bayes · Chomsky · Sullivan) ──────────────────────────────────────────
import { functionWordsOf, DECLARED_V3 } from "./fold-chat-snippets.js";

test("functionWordsOf: closed-class forms from the khora's gold-treebank priors; null where there is no committed prior", () => {
  const es = functionWordsOf("es");
  assert.ok(es.has("por") && es.has("de") && es.has("que"));
  assert.ok(functionWordsOf("zh").has("的") && functionWordsOf("ru").has("в") && functionWordsOf("fr").has("les"));
  assert.equal(functionWordsOf("de"), null, "German has no committed prior yet");
  assert.equal(functionWordsOf("ja"), null);
});

const es = (host, k, text) => card(host, `Argentina ${k}`, text + uniq(60 + k));
const ARG = [
  es("a.test", 1, "Buenos Aires es la capital de Argentina y su ciudad más grande."),
  es("b.test", 2, "La capital argentina, Buenos Aires, se encuentra junto al Río de la Plata."),
  es("c.test", 3, "Capital de Argentina: Buenos Aires, sede del gobierno nacional."),
  es("d.test", 4, "Argentina tiene por capital a Buenos Aires desde mil ochocientos ochenta."),
  es("e.test", 5, "Datos de Argentina: la capital federal es Buenos Aires, ciudad autónoma."),
  es("f.test", 6, "Córdoba es una ciudad del interior de Argentina conocida por sus sierras."),
];

test("v3 speaks in Spanish with NO learned background, because the prior says which words are filler — and v2 cannot", () => {
  const v3 = snippetsSufficient(ARG, "¿cuál es la capital de Argentina?", { background: makeBackground(), lang: "es", rule: "v3" });
  assert.equal(v3.sufficient, true, v3.why);
  assert.ok(["buenos", "aires"].includes(v3.term), v3.term);
  const v2 = snippetsSufficient(ARG, "¿cuál es la capital de Argentina?", { background: makeBackground(), lang: "es", rule: "v2" });
  assert.equal(v2.abstained, true);
});

test("v3 with no list and no background ABSTAINS (German has no committed prior): it does not guess", () => {
  const out = snippetsSufficient(ARG, "was ist die Hauptstadt von Argentinien?", { background: makeBackground(), lang: "de", rule: "v3" });
  assert.equal(out.abstained, true);
  assert.match(out.why, /no function-word prior/);
});

test("v3's stricter mode: with no learned background EVERY content word of the question must be on a card, and 4 chains must agree", () => {
  assert.equal(DECLARED_V3.topicFracNoBackground, 1.0);
  assert.equal(DECLARED_V3.minChainsNoBackground, 4);
  // 3 of the 5 chains carry "capital" + "argentina"; the other two say only one of them → not enough on-topic chains
  const partial = [ARG[0], ARG[1], ARG[2], es("d.test", 4, "Argentina is large and has a famous steak culture here."), es("e.test", 5, "La capital del país tiene un puerto muy activo desde hace siglos."), ARG[5]];
  const out = snippetsSufficient(partial, "¿cuál es la capital de Argentina?", { background: makeBackground(), lang: "es", rule: "v3" });
  assert.equal(out.sufficient, false);
  assert.match(out.why, /independent chain/);
});

test("v3 with a learned background uses it too — function words are common AND the learned shares count", () => {
  const bgEs = makeBackground({ es: { n: 40, df: { es: 38, la: 39, de: 40, el: 36, y: 35, por: 30, en: 34, que: 33, cuál: 5 } } });
  const out = snippetsSufficient(ARG, "¿cuál es la capital de Argentina?", { background: bgEs, lang: "es", rule: "v3" });
  assert.equal(out.sufficient, true, out.why);
});
