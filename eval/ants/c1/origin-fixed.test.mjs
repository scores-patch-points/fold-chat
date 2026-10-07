// C1 — tests for the three fixes in origin-fixed.mjs (a copy of fold-chat-origin.js with: minAtomsSlot, folded() pronunciation, corroborateAnswer/admitHost + followClaim `hits`).
// node --test eval/ants/c1/origin-fixed.test.mjs        (mutation-checked by eval/ants/c1/mutate.mjs: delete each gate, a test here must fail)
import test from "node:test";
import assert from "node:assert/strict";
import * as O from "./origin-fixed.mjs";
const T = (url, text, extra = {}) => ({ url, title: url, text, ...extra });
const reader = (map, log = []) => async (u) => { log.push(u); const v = map[u]; return v === undefined ? { ok: false } : v === null ? (() => { throw new Error("boom"); })() : { ok: true, text: v, title: u, url: u, via: "direct" }; };

// ── Fix 1: the slot gate ─────────────────────────────────────────────────────────────────────────────────────
const EIF = "The Eiffel Tower is 330 metres tall.";
test("Fix 1: a slot claim (figure + name, 2 atoms) is not idle: a page that says it is `same`", () => {
  const r = O.supportOf(EIF, T("https://x.fr/a", "The Eiffel Tower is 330 metres (1,083 ft) tall, antennas included. It was built in 1889."), { forWhom: "How tall is the Eiffel Tower?" });
  assert.equal(r.verdict, "same", JSON.stringify(r));
});
test("Fix 1: wrong-figure and other-tower decoys stay rejected at 2 atoms", () => {
  for (const [text, why] of [["The Eiffel Tower is 300 metres (984 feet) tall. The Statue of Liberty is 93 metres tall.", "wrong figure"], ["The Tokyo Tower is 333 metres tall. The Eiffel Tower inspired it.", "other tower"], ["The Eiffel Tower stands on the Champ de Mars. The Statue of Liberty is 93 metres tall.", "neighbour"]]) {
    const r = O.supportOf(EIF, T("https://x.fr/b", text), {});
    assert.notEqual(r.verdict, "same", why + " " + JSON.stringify(r));
  }
});
test("Fix 1: a claim with a figure but NO name (fig + term = 2 atoms) stays idle: min 3 still holds outside the slot rule", () => {
  const r = O.supportOf("The tower is 330 metres tall.", T("https://x.fr/c", "The tower is 330 metres tall. It is old."), {});
  assert.equal(r.verdict, "undecidable"); assert.equal(r.why, "idle");
  assert.match(r.detail, /2 of 3 atoms/);
});
test("Fix 1: the slot rule's own threshold is the one reported (a name alone = 1 atom: '1 of 3')", () => {
  const r = O.supportOf("Mount Everest is tall.", T("https://x.fr/c", "Mount Everest is tall. It is in Nepal."), {});
  assert.equal(r.why, "idle"); assert.match(r.detail, /1 of 3 atoms/);
});

// ── Fix 6: pronunciation is not part of the sentence ─────────────────────────────────────────────────────────
const HTML_LEAD = "The Eiffel Tower (/ˈaɪfəl/ ⓘ EYE-fəl; French: Tour Eiffel [tuʁ ɛfɛl] ⓘ) is a lattice tower on the Champ de Mars in Paris, France.";
const EXTRACT_LEAD = "The Eiffel Tower ( EYE-fəl; French: Tour Eiffel [tuʁ ɛfɛl] ) is a lattice tower on the Champ de Mars in Paris, France.";
test("Fix 6: the plain-text extract's lead is found in the parse HTML's block, whose marks are returned at their place", () => {
  const blocks = [{ text: HTML_LEAD + " It is named after the engineer.", marks: [{ at: HTML_LEAD.length, id: "n1", n: 1 }] }];
  const m = O.noteMarksFor(blocks, EXTRACT_LEAD);
  assert.ok(m, "located"); assert.equal(m.length, 1); assert.equal(m[0].n, 1);
});
test("Fix 6: only IPA is dropped — a bracketed figure or a slash is part of the sentence", () => {
  const blocks = [{ text: "The tower is 330 metres [1,083 ft] tall and/or wide.", marks: [] }];
  assert.ok(O.noteMarksFor(blocks, "The tower is 330 metres [1,083 ft] tall and/or wide."));
  assert.equal(O.noteMarksFor(blocks, "The tower is 330 metres tall and/or wide."), null, "a sentence without the bracketed figure is not the same sentence");
});
test("Fix 6: the mapping still indexes the ORIGINAL block (the marks keep their place after a skipped pronunciation)", () => {
  const text = "Foo (/ˈfuː/ ⓘ) is a thing.[x]  Bar is another thing here, too, and so it goes on.";
  const blocks = [{ text, marks: [{ at: text.indexOf("Bar"), id: "a", n: 1 }] }];
  const m = O.noteMarksFor(blocks, "Foo ( ) is a thing.");
  assert.ok(m, "located"); assert.deepEqual(m.map((x) => x.n), []);   // the mark stands after the sentence's end
});

// ── Fix 2: corroborateAnswer ─────────────────────────────────────────────────────────────────────────────────
const CLAIM = "Canberra is the capital of Australia.";
const OK = "Canberra is the capital of Australia. It lies in the Australian Capital Territory.";
test("Fix 2: the first page IN SEARCH ORDER that carries the claim is the origin", async () => {
  const hits = [{ url: "https://a.gov.au/x" }, { url: "https://b.org/x" }, { url: "https://c.com/x" }];
  const r = await O.corroborateAnswer(CLAIM, hits, { read: reader({ "https://a.gov.au/x": "Sydney is a large city on the coast. It is not the capital.", "https://b.org/x": OK, "https://c.com/x": OK }) });
  assert.equal(r.origin.url, "https://b.org/x"); assert.equal(r.origin.host, "b.org");
  assert.deepEqual(r.tried.map((t) => t.verdict === "same"), [false, true, true]);
  assert.match(r.origin.sentence, /^Canberra is the capital of Australia/);
});
test("Fix 2: encyclopedias, mirrors, farms, Q&A and social hosts are never read and never the origin", async () => {
  const log = [];
  const hosts = ["https://www.britannica.com/place/Canberra", "https://www.wikiwand.com/en/Canberra", "https://en.wikipedia.org/wiki/Canberra", "https://www.quora.com/q", "https://spiderpedia.com/x", "https://www.answers.com/q", "https://www.youtube.com/v", "https://fandom.com/x", "https://grokipedia.com/x", "https://geeksforgeeks.org/x"];
  const map = Object.fromEntries(hosts.map((h) => [h, OK]));
  const r = await O.corroborateAnswer(CLAIM, hosts.map((url) => ({ url })), { read: reader(map, log) });
  assert.equal(r.origin, null); assert.deepEqual(log, []); assert.deepEqual(r.tried, []);
});
test("Fix 2: a gov page behind the farms is still found; `admit` replaces the table", async () => {
  const r = await O.corroborateAnswer(CLAIM, [{ url: "https://www.answers.com/q" }, { url: "https://nca.gov.au/p" }], { read: reader({ "https://nca.gov.au/p": OK, "https://www.answers.com/q": OK }) });
  assert.equal(r.origin.host, "nca.gov.au");
  const r2 = await O.corroborateAnswer(CLAIM, [{ url: "https://www.answers.com/q" }], { read: reader({ "https://www.answers.com/q": OK }), admit: () => true });
  assert.equal(r2.origin.host, "answers.com");
});
test("Fix 2: at most `max` (8) distinct pages are read; the 9th is not", async () => {
  const log = [];
  const hits = Array.from({ length: 12 }, (_, i) => ({ url: `https://s${i}.org/p` }));
  const r = await O.corroborateAnswer(CLAIM, hits, { read: reader({ "https://s8.org/p": OK }, log) });
  assert.equal(log.length, 8); assert.equal(r.origin, null);
  const r2 = await O.corroborateAnswer(CLAIM, hits, { read: reader({ "https://s7.org/p": OK }, []), max: 8 });
  assert.equal(r2.origin.host, "s7.org");
});
test("Fix 2: one page, one read (www, fragment, trailing slash are not a second page)", async () => {
  const log = [];
  await O.corroborateAnswer(CLAIM, [{ url: "https://www.a.org/x/" }, { url: "https://a.org/x#top" }, { url: "http://a.org/x" }], { read: reader({}, log) });
  assert.equal(log.length, 1);
});
test("Fix 2: unreadable pages, a throwing reader and non-supporting pages give no origin; the page's verdict is typed in `tried`", async () => {
  const r = await O.corroborateAnswer(CLAIM, [{ url: "https://u.org/1" }, { url: "https://u.org/2" }, { url: "https://u.org/3" }], { read: reader({ "https://u.org/1": undefined, "https://u.org/2": null, "https://u.org/3": "Sydney is the largest city of Australia and a major port." }) });
  assert.equal(r.origin, null);
  assert.deepEqual(r.tried.map((t) => t.read), [false, false, true]);
  assert.notEqual(r.tried[2].verdict, "same");
});
test("Fix 2: a hit that carries its text is not read again; a snippet-only hit is", async () => {
  const log = [];
  const r = await O.corroborateAnswer(CLAIM, [{ url: "https://t.org/1", text: OK }], { read: reader({}, log) });
  assert.equal(r.origin.url, "https://t.org/1"); assert.equal(log.length, 0);
  const r2 = await O.corroborateAnswer(CLAIM, [{ url: "https://t.org/2", text: "Canberra", snippetOnly: true }], { read: reader({ "https://t.org/2": OK }, log) });
  assert.equal(log.length, 1); assert.equal(r2.origin.url, "https://t.org/2");
});
test("Fix 2: never throws on garbage", async () => {
  for (const h of [null, undefined, 5, [null, 3, {}, { url: 7 }], "x"]) { const r = await O.corroborateAnswer(null, h, {}); assert.equal(r.origin, null); }
});
test("Fix 2: an aborted signal reads nothing", async () => {
  const log = []; const ac = new AbortController(); ac.abort();
  const r = await O.corroborateAnswer(CLAIM, [{ url: "https://t.org/1" }], { read: reader({ "https://t.org/1": OK }, log), signal: ac.signal });
  assert.equal(r.origin, null); assert.equal(log.length, 0);
});
test("admitHost: wikipedia is a pointer; a relative or non-http URL is not a witness", () => {
  assert.equal(O.admitHost("https://en.wikipedia.org/wiki/X"), false);
  assert.equal(O.admitHost("/x"), false); assert.equal(O.admitHost("ftp://a.org/x"), false); assert.equal(O.admitHost(""), false);
  assert.equal(O.admitHost("https://www.royal.uk/the-king"), true); assert.equal(O.admitHost("https://nobelprize.org/x"), true);
});

// ── followClaim: footnotes, then already-read pages, then the search's pages for the ANSWER's claim ─────────────
const wikiFetch = (html) => async () => ({ ok: true, json: async () => ({ parse: { title: "Canberra", text: html, revid: 1 } }) });
const WIKI = "https://en.wikipedia.org/wiki/Canberra";
const LEAD = "Canberra is the capital city of Australia and the largest inland city.";
test("followClaim: a lead with no footnote -> `no-reference` -> the search hits are asked for the ANSWER's claim (path: found-in, alongside, read)", async () => {
  const t = await O.followClaim({ sentence: LEAD, passage: { url: WIKI, title: "Canberra", text: LEAD }, fetchImpl: wikiFetch(`<p>${LEAD}</p>`), read: reader({ "https://nca.gov.au/p": OK }), hits: [{ url: "https://nca.gov.au/p" }], answerClaim: CLAIM, forWhom: "What is the capital of Australia?" });
  assert.equal(t.status, "origin"); assert.equal(t.origin.host, "nca.gov.au");
  assert.deepEqual(t.path.map((h) => h.kind), ["found-in", "alongside", "read"]);
  assert.match(t.pattern.basis, /found by searching the answer/);
});
test("followClaim: without `hits` (today's call) the trail is what it was: no-reference", async () => {
  const t = await O.followClaim({ sentence: LEAD, passage: { url: WIKI, title: "Canberra", text: LEAD }, fetchImpl: wikiFetch(`<p>${LEAD}</p>`), read: reader({ "https://nca.gov.au/p": OK }) });
  assert.equal(t.status, "no-reference");
});
test("followClaim: the answer's claim, not the encyclopedia sentence, is what the search page must carry", async () => {
  const t = await O.followClaim({ sentence: LEAD, passage: { url: WIKI, title: "Canberra", text: LEAD }, fetchImpl: wikiFetch(`<p>${LEAD}</p>`), read: reader({ "https://nca.gov.au/p": OK }), hits: [{ url: "https://nca.gov.au/p" }] });
  assert.equal(t.status, "no-reference", "the long lead sentence carries 'inland' and 'largest', which the page does not: no origin for it");
});
test("followClaim: a page already read (alongside) wins before any search hit is read", async () => {
  const log = [];
  const t = await O.followClaim({ sentence: CLAIM, passage: { url: WIKI, title: "Canberra", text: CLAIM }, fetchImpl: wikiFetch(`<p>${CLAIM}</p>`), read: reader({ "https://nca.gov.au/p": OK }, log), alongside: [T("https://b.org/z", OK)], hits: [{ url: "https://nca.gov.au/p" }] });
  assert.equal(t.status, "origin"); assert.equal(t.origin.host, "b.org"); assert.equal(log.length, 0);
});
test("followClaim: a search page that does not say it leaves the trail as it was", async () => {
  const t = await O.followClaim({ sentence: LEAD, passage: { url: WIKI, title: "Canberra", text: LEAD }, fetchImpl: wikiFetch(`<p>${LEAD}</p>`), read: reader({ "https://n.org/p": "Sydney is a large city." }), hits: [{ url: "https://n.org/p" }], answerClaim: CLAIM });
  assert.equal(t.status, "no-reference");
});

// ── originateTurn threads the answer's text and the hits ─────────────────────────────────────────────────────
test("originateTurn: the answer row's realised text is the claim asked of the hits; a non-answer row is not", async () => {
  const row = { source: { url: WIKI, title: "Canberra", ref: "W" }, sentence: LEAD };
  const turn = { said: "What is the capital of Australia?", answer: { text: CLAIM, row, unmeasured: [] }, contest: [], trace: [] };
  const out = await O.originateTurn(turn, { passages: [], fetchImpl: wikiFetch(`<p>${LEAD}</p>`), read: reader({ "https://nca.gov.au/p": OK }), hits: [{ url: "https://nca.gov.au/p" }], reading: null });
  assert.equal(out.answer.row.origin.status, "origin"); assert.equal(out.origins[0].host, "nca.gov.au");
  const other = { source: { url: WIKI, title: "Canberra", ref: "W" }, sentence: LEAD };
  const turn2 = { said: "q", answer: null, contest: [other, { source: { url: WIKI + "2", title: "x", ref: "W" }, sentence: "Another long sentence about the city of Canberra here." }], trace: [] };
  const out2 = await O.originateTurn(turn2, { passages: [], fetchImpl: wikiFetch(`<p>${LEAD}</p><p>Another long sentence about the city of Canberra here.</p>`), read: reader({ "https://nca.gov.au/p": OK }), hits: [{ url: "https://nca.gov.au/p" }], reading: null });
  assert.equal(out2.origins.length, 0, "no answer text -> the long sentence is the claim -> not carried by the page");
});

// ── the pages ALREADY READ (corroboration) pass the same host gate ───────────────────────────────────────────────
test("corroboration: a Britannica / mirror / farm page already read is not an origin; a first-party page is", () => {
  const bad = O.corroboration(CLAIM, [T("https://www.britannica.com/place/Canberra", OK), T("https://www.wikiwand.com/en/Canberra", OK), T("https://www.quora.com/q", OK)]);
  assert.equal(bad, null);
  const good = O.corroboration(CLAIM, [T("https://www.britannica.com/place/Canberra", OK), T("https://nca.gov.au/p", OK)]);
  assert.equal(good.host, "nca.gov.au");
});
test("followClaim: `alongside` pages pass the host gate too (the already-read Britannica page is not the origin)", async () => {
  const t = await O.followClaim({ sentence: CLAIM, passage: { url: WIKI, title: "Canberra", text: CLAIM }, fetchImpl: wikiFetch(`<p>${CLAIM}</p>`), read: reader({}), alongside: [T("https://www.britannica.com/place/Canberra", OK)] });
  assert.equal(t.status, "no-reference");
});

// ── post-hoc Fix 7: the bound rung must not accept a page that carries a different day of the same year ─────────────
test("figuresCovered: every number the claim states is in the sentence (separators ignored)", () => {
  assert.equal(O.figuresCovered("Apollo 11 landed on the Moon on 20 July 1969.", "Apollo 11 landed on 20 July 1969."), true);
  assert.equal(O.figuresCovered("Apollo 11 landed on the Moon on 20 July 1969.", "the launch on July 16, 1969"), false);
  assert.equal(O.figuresCovered("Mount Everest is 8,848.86 metres tall.", "It is 8848.86 meters."), true);
  assert.equal(O.figuresCovered("The Moon is 384,400 km away.", "238,855 miles"), false);
  assert.equal(O.figuresCovered("Canberra is the capital.", "anything"), true);
});
const titles = async (u) => { const ts = decodeURIComponent(new URL(u).searchParams.get("titles") || "").split("|"); return { ok: true, json: async () => ({ query: { pages: Object.fromEntries(ts.map((x, k) => [String(k + 1), { pageid: k + 1, title: x }])) } }) }; };   // a title service that knows every title
test("Fix 7 (post-hoc): the bound rung (year-level `time` filler) does not accept another DAY of the same year; the same day is still accepted", async () => {
  const reading = await O.readFrame("When did Apollo 11 land on the Moon?", { fetchImpl: titles });
  assert.ok(reading && reading.frame.slot === "time", "the stub title service yields a time frame");
  const claim = "Apollo 11 landed on the Moon on 20 July 1969.";
  const wrong = O.supportOf(claim, T("https://x.org/a", "Apollo 11 landed on the Moon on 21 July 1969."), { reading });
  assert.notEqual(wrong.verdict, "same", JSON.stringify(wrong));
  const right = O.supportOf(claim, T("https://x.org/b", "Apollo 11 landed on the Moon on 20 July 1969, and Neil Armstrong walked."), { reading });
  assert.equal(right.verdict, "same");
});
