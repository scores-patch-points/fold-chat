// fold-chat-origin.test.mjs — an encyclopedia is a POINTER, never a citation (fold-chat-origin.js, fold-chat-tertiary.js).
// Falsifiers are marked FALSIFIER: they fail if the claim they guard is wrong. No network: the article's parse API and every page read are stubs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { askFrame } from "./fold-chat-frame.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { supportByFrame, readFrame, isTertiary, tertiaryOf, parseWikiHtml, noteMarksFor, bodyMarksFor, wikiIndex, supportOf, IDENTITY, ORIGIN, followClaim, corroboration, originateTurn, ORIGIN_NOT_READ, pathWords, pointerWords, traceWords, pageKey, holonAddress, archivedOriginal, slimTrail, FAILURE, failureOfWhy, archivedAsOf } from "./fold-chat-origin.js";

// the asker's frame, read by the Pivot's own askFrame over a title stub (no network): "How many kilometres does the Quillon run?" → quantity of Quillon
const FW = functionWordsOf("en");
const titlesStub = async (c) => new Map(c.map((x) => [x, /^quillon$/i.test(x) ? { title: "Quillon", redirectedFrom: null, disambiguation: false } : null]));
const ASK = "How many kilometres does the Quillon run?";
const READING = { frame: await askFrame(ASK, { fw: FW, lang: "en", resolveTitles: titlesStub }), fw: FW, lang: "en" };

const FIXTURE = fs.readFileSync(new URL("./eval/origin/charles-iii.fixture.html", import.meta.url), "utf8");   // real Wikipedia markup (Charles III, parse API)
const LEAD_58 = "Charles was created Prince of Wales and Earl of Chester on 26 July 1958,";
const LEAD_58_69 = "Charles was created Prince of Wales and Earl of Chester on 26 July 1958, although his investiture did not take place until 1 July 1969, when he was crowned by his mother in a televised ceremony at Caernarfon Castle.";

// ───────────────────────── which hosts are pointers ─────────────────────────
test("tertiary: every Wikipedia edition is a pointer host; no other host is", () => {
  for (const u of ["https://en.wikipedia.org/wiki/X", "https://de.wikipedia.org/wiki/X", "https://en.m.wikipedia.org/wiki/X", "http://wikipedia.org/"]) assert.equal(isTertiary(u), true, u);
  for (const u of ["https://www.royal.uk/", "https://notwikipedia.org/", "https://wikipedia.org.evil.example/", "", null, "not a url"]) assert.equal(isTertiary(u), false, String(u));
  assert.equal(tertiaryOf("https://fr.wikipedia.org/wiki/X").id, "wikipedia");
});

// ───────────────────────── reading the article's real markup ─────────────────────────
test("parseWikiHtml: real Wikipedia markup — entity-encoded ids, bracket labels that are not the ids, the footnote list read and cut from the prose", () => {
  const { notes, blocks } = parseWikiHtml(FIXTURE);
  assert.deepEqual([...notes.keys()], ["39", "40", "41", "42", "43", "44", "45"], "ids decode `cite&#95;note-39`");
  assert.deepEqual([...notes.values()].map((n) => n.n), [32, 33, 34, 35, 36, 37, 38], "the number a reader sees is the marker's label, not the id");
  assert.equal(blocks.length, 1);
  assert.match(blocks[0].text, /^Charles was created Prince of Wales and Earl of Chester on 26 July 1958, although/);
  assert.doesNotMatch(blocks[0].text, /\[\s*32\s*\]|\^|cite_note/, "the marker's own [n] is not prose, and the footnote list is not in it");
  assert.equal(blocks[0].marks.length, 7);
  assert.equal(blocks[0].text.slice(0, blocks[0].marks[0].at), LEAD_58, "the first marker stands right after 'July 1958,'");
  const n39 = notes.get("39");
  assert.match(n39.url, /^https?:\/\/(www\.)?thegazette\.co\.uk\//, "the footnote's page is the ORIGINAL");
  assert.ok(n39.label.length > 0 && n39.text.length <= ORIGIN.noteChars);
});

test("noteMarksFor: the footnotes under a sentence, each with the text it stands under — and a sentence the article does not carry is null", () => {
  const { blocks } = parseWikiHtml(FIXTURE);
  const one = noteMarksFor(blocks, LEAD_58);
  assert.deepEqual(one.map((m) => [m.id, m.n]), [["39", 32]]);
  assert.equal(one[0].claim, LEAD_58);
  const two = noteMarksFor(blocks, LEAD_58_69);
  assert.deepEqual(two.map((m) => m.id), ["39", "40"]);
  assert.match(two[1].claim, /^although his investiture did not take place until 1 July 1969/, "the second footnote stands under the text SINCE the first");
  // the extract's text differs in whitespace, case and diacritics from the HTML: found anyway
  assert.equal(noteMarksFor(blocks, "  charles was CREATED prince of wales   and earl of chester on 26 july 1958, ").length, 1);
  // a snip that skipped words in the middle is found by its head and tail
  assert.ok(noteMarksFor(blocks, LEAD_58 + " … " + "crowned by his mother in a televised ceremony at Caernarfon Castle.").length >= 1);
  assert.equal(noteMarksFor(blocks, "The Eiffel Tower is in Paris."), null, "FALSIFIER: a sentence that is not in the article's prose is not given someone else's footnotes");
});

test("parseWikiHtml: archive-only notes lead back to the original; Wikimedia links, book notes and [citation needed] are not origins", () => {
  const html = `<p>Alpha is a thing.<sup class="reference"><a href="#cite_note-a"><span>[</span>1<span>]</span></a></sup> Beta is another.<sup class="reference"><a href="#cite_note-b">[2]</a></sup> Gamma is third.<sup class="noprint Inline-Template"><a href="#x">[citation needed]</a></sup><sup class="reference"><a href="#cite_note-c">[3]</a></sup> Delta is fourth.<sup class="reference"><a href="#cite_note-d">[4]</a></sup></p>
<ol class="references">
<li id="cite_note-a"><cite><a rel="nofollow" class="external text" href="https://web.archive.org/web/20200101000000/https://www.example.org/alpha">Alpha page</a></cite></li>
<li id="cite&#95;note-b"><cite><a class="external text" href="https://en.wikipedia.org/wiki/Beta">Beta on Wikipedia</a></cite></li>
<li id="cite_note-c"><cite>Smith, J. (1999). <i>A Book</i>. Press. p.&#160;12.</cite></li>
<li id="cite_note-d"><cite><a class="external text" href="//www.example.net/delta?x=1&amp;y=2">Delta</a> <a class="external text" href="https://archive.org/wayback/delta">archived</a></cite></li>
</ol>`;
  const { notes, blocks } = parseWikiHtml(html);
  assert.equal(notes.get("a").url, "https://www.example.org/alpha", "the original is read out of the wayback address");
  assert.equal(notes.get("a").archived, "https://web.archive.org/web/20200101000000/https://www.example.org/alpha");
  assert.equal(notes.get("b").url, null, "an encyclopedia link is not an origin");
  assert.equal(notes.get("c").url, null); assert.match(notes.get("c").text, /A Book/, "a book note has no page to fetch but keeps its words");
  assert.equal(notes.get("d").url, "https://www.example.net/delta?x=1&y=2", "protocol-relative, entities decoded"); assert.equal(notes.get("d").archived, "https://archive.org/wayback/delta");
  assert.equal(blocks[0].marks.length, 4, "[citation needed] is not a footnote");
  assert.doesNotMatch(blocks[0].text, /citation needed/);
  assert.equal(archivedOriginal("https://web.archive.org/web/2020/https://a.example/x"), "https://a.example/x");
  assert.equal(archivedOriginal("https://a.example/x"), null);
});

test("pageKey: one page is one page — scheme, www, fragment and a trailing slash are not a second page", () => {
  assert.equal(pageKey("https://www.Example.org/a/b/#frag"), pageKey("http://example.org/a/b"));
  assert.notEqual(pageKey("https://example.org/a?x=1"), pageKey("https://example.org/a?x=2"));
});

// ───────────────────────── identity: does the page say what the claim says? ─────────────────────────
const NOBEL = 'The Nobel Prize in Chemistry 1911 was awarded to Marie Curie, née Skłodowska "in recognition of her services to the advancement of chemistry by the discovery of the elements radium and polonium, by the isolation of radium and the study of the nature and compounds of this remarkable element". She had already received the Nobel Prize in Physics in 1903, together with Pierre Curie and Henri Becquerel. Marie Curie worked in Paris for most of her career.';
const nobel = (t = NOBEL) => ({ url: "https://www.nobelprize.org/prizes/chemistry/1911/summary/", text: t });

test("supportOf: the same claim in other words is SAME — by consequence, not by string — and names the page's own sentence by its address", () => {
  const claim = 'She won the 1911 Nobel Prize in Chemistry "[for] the discovery of the elements radium and polonium, by the isolation of radium and the study of the nature and compounds of this remarkable element".';
  const r = supportOf(claim, nobel(), { forWhom: "Who won the 1911 Chemistry Nobel?" });
  assert.equal(r.verdict, "same");
  assert.match(r.sentence, /^The Nobel Prize in Chemistry 1911 was awarded to Marie Curie/);
  assert.match(r.address, /^origin#0-\d+$/);
  assert.equal(NOBEL.slice(...r.address.split("#")[1].split("-").map(Number)), r.sentence, "the address reads back as the page's own bytes (a holon's identity IS its address)");
  assert.ok(r.atoms.some((a) => a.startsWith("fig:")) && r.atoms.some((a) => a.startsWith("name:")) && r.atoms.some((a) => a.startsWith("term:")));
  assert.equal(r.identity.for, "Who won the 1911 Chemistry Nobel?");
});

test("supportOf: every verdict names its cut and its for-whom and says it is NOMINATED, NOT MEASURED (the user's definition of identity)", () => {
  const r = supportOf("Marie Curie worked in Paris for most of her career.", nobel(), { forWhom: "where did she work" });
  assert.equal(r.verdict, "same");
  assert.deepEqual({ ...r.identity }, { ...IDENTITY("where did she work") });
  assert.equal(r.identity.measured, false); assert.equal(r.identity.basis, "nominated"); assert.match(r.identity.cut, /holon window/);
  assert.equal(IDENTITY().for, null, "no for-whom is said as none, never invented");
});

test("supportOf FALSIFIER: a different name is DIFFERENT; a different figure, a negation, a comparison, another subject are UNDECIDABLE — typed, never 'same'", () => {
  assert.equal(supportOf("Pierre Curie won the 1911 Nobel Prize in Chemistry for the discovery of radium and polonium.", nobel()).verdict, "different");
  const year = supportOf("Marie Curie won the Nobel Prize in Chemistry in 1912.", nobel());
  assert.equal(year.verdict, "undecidable"); assert.match(year.why, /figure/);
  const neg = supportOf("Marie Curie did not win the Nobel Prize in Chemistry in 1911.", nobel());
  assert.equal(neg.verdict, "undecidable"); assert.equal(neg.why, "unread-structure"); assert.equal(neg.detail, "negation");
  const cmp = supportOf("Marie Curie won the Nobel Prize in Chemistry in 1911, earlier than Pierre Curie did.", nobel());
  assert.equal(cmp.verdict, "undecidable");
  const other = supportOf("The Eiffel Tower is 330 metres tall and stands in Paris, France.", nobel());
  assert.equal(other.verdict, "undecidable");
  for (const r of [year, neg, cmp, other]) assert.notEqual(r.verdict, "same");
});

test("supportOf FALSIFIER: a page whose own sentence is NEGATED can never support the affirmative claim", () => {
  const page = nobel(NOBEL.replace("was awarded to", "was not awarded to"));
  const r = supportOf("The Nobel Prize in Chemistry 1911 was awarded to Marie Curie, for the discovery of the elements radium and polonium.", page);
  assert.notEqual(r.verdict, "same", "an affirmative claim is not supported by 'was not awarded'");
});

test("supportOf: EARNED — a claim that carries almost nothing is idle, undecidable, never 'same'", () => {
  const r = supportOf("Marie Curie won.", nobel());
  assert.equal(r.verdict, "undecidable"); assert.equal(r.why, "idle");
  assert.match(r.detail, new RegExp(`of ${ORIGIN.minAtoms} atoms`));
});

test("supportOf: a claim may say LESS than the page's sentence, never something else (a clause of a longer sentence is the same claim)", () => {
  assert.equal(supportOf("Marie Curie was awarded the Nobel Prize in Chemistry in 1911.", nobel()).verdict, "same");
  assert.equal(supportOf("The Nobel Prize in Chemistry 1911 was awarded to Marie Curie.", nobel()).verdict, "same", "a sentence-initial 'The' is not part of a name's identity");
});

// ───────────────────────── following a claim ─────────────────────────
// A small synthetic article (the lead is uncited, as leads are; the body is cited) served by a stub parse API.
const ARTICLE = `<p>Quillon is a river in the north of Ostland and the longest in the country.</p>
<p>The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.<sup class="reference"><a href="#cite_note-1">[1]</a></sup> Its basin holds half of the population of Ostland.<sup class="reference"><a href="#cite_note-2">[2]</a></sup> The first chart of the river was made in 1802.<sup class="reference"><a href="#cite_note-3">[3]</a></sup></p>
<ol class="references">
<li id="cite_note-1"><cite><a rel="nofollow" class="external text" href="https://survey.example.org/rivers/quillon">Rivers of Ostland</a></cite></li>
<li id="cite_note-2"><cite><a rel="nofollow" class="external text" href="https://stats.example.org/basin">Basin census</a></cite></li>
<li id="cite_note-3"><cite><a rel="nofollow" class="external text" href="https://dead.example.org/charts">Charts</a> <a rel="nofollow" class="external text" href="https://web.archive.org/web/2019/https://dead.example.org/charts">archived</a></cite></li>
</ol>`;
const WIKI_URL = "https://en.wikipedia.org/wiki/Quillon";
const PAGES = {
  "https://survey.example.org/rivers/quillon": "Rivers of Ostland. The Quillon river flows for 640 kilometres from the Karth Mountains in the north to the Sund Sea. It is the longest river of Ostland.",
  "https://stats.example.org/basin": "Basin census. About a third of the people of Ostland live in the basin of the Quillon river, according to the 2011 census.",
  "https://web.archive.org/web/2019/https://dead.example.org/charts": "Charts. The first chart of the Quillon river was made in 1802 by the surveyor Mara Dene, who followed it from the Karth Mountains in the north of the country.",
};
const api = (html = ARTICLE, { ok = true } = {}) => async (url) => {
  const u = String(url);
  if (/wikipedia\.org\/w\/api\.php/.test(u)) return ok ? { ok: true, json: async () => ({ parse: { title: "Quillon", revid: 4242, text: html } }) } : { ok: false, status: 503 };
  throw new Error("unexpected fetch " + u);
};
const reader = (pages = PAGES, log = []) => async (url) => { log.push(url); const t = pages[url]; return t ? { ok: true, text: t, title: "T " + url.split("/").pop(), via: "direct", url } : { ok: false, text: "", title: "", via: null, url, error: "unreachable" }; };

test("followClaim: a cited sentence is followed to the page its footnote names — read, shown to carry the claim, the path kept", async () => {
  const read = reader();
  const claim = "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.";
  // reworded ("rises … runs" for the page's "flows"): rung 1 (consequence) cannot decide on WORDS, so without the asker's frame it is not an origin…
  const bare = await followClaim({ sentence: claim, passage: { url: WIKI_URL, title: "Quillon" }, fetchImpl: api(), read: reader() });
  assert.equal(bare.status, "unsupported"); assert.equal(bare.tried[0].verdict, "undecidable");
  // …and under the asker's frame the Pivot reads both sides as assertions (Quillon · quantity · 640) and they are the same
  const t = await followClaim({ sentence: claim, passage: { url: WIKI_URL, title: "Quillon" }, fetchImpl: api(), read, forWhom: ASK, reading: READING });
  assert.equal(t.status, "origin"); assert.equal(t.origin.rung, "bound"); assert.equal(t.origin.identity.by, "bound");
  assert.equal(t.origin.url, "https://survey.example.org/rivers/quillon"); assert.equal(t.origin.host, "survey.example.org");
  assert.match(t.origin.sentence, /^The Quillon river flows for 640 kilometres/);
  assert.match(t.origin.address, /^origin#\d+-\d+$/);
  assert.equal(t.origin.identity.for, ASK); assert.equal(t.origin.identity.measured, false); assert.equal(t.origin.identity.basis, "nominated");
  assert.deepEqual(t.path.map((h) => h.kind), ["found-in", "reference", "read"]);
  assert.equal(t.found.url, WIKI_URL, "the encyclopedia is where the claim was FOUND — a hop, never the origin");
  assert.deepEqual(pathWords(t).map((h) => h.text), ["Wikipedia “Quillon”", "reference 1", "survey.example.org"]);
  assert.equal(t.refs.length, 1); assert.equal(t.refs[0].url, "https://survey.example.org/rivers/quillon");
  assert.doesNotMatch(JSON.stringify(t.origin.url), /wikipedia/);
});

test("followClaim FALSIFIER: a page that is READ but says something else is NOT an origin — the trail keeps it, tried and refused, with the verdict", async () => {
  // the article says half of the population; the census page says a third: the same ground, another figure → not the same claim
  const t = await followClaim({ sentence: "Its basin holds half of the population of Ostland.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader() });
  assert.notEqual(t.status, "origin");
  assert.equal(t.origin, null);
  assert.equal(t.status, "unsupported");
  const tried = t.tried.find((x) => x.url === "https://stats.example.org/basin");
  assert.equal(tried.read, true); assert.equal(tried.supports, false); assert.ok(["different", "undecidable"].includes(tried.verdict));
  assert.match(pointerWords(t), /not cited: its references were read but do not carry this/);
  assert.equal(t.refs.length, 1, "the pointer to the page is still given");
});

test("followClaim: a page that cannot be read falls to its archived copy; a page that DISAGREES does not (an archive is for a page that is gone)", async () => {
  const log = [];
  const t = await followClaim({ sentence: "The first chart of the river was made in 1802.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader(PAGES, log) });
  assert.equal(t.status, "origin"); assert.equal(t.origin.copy, true);
  assert.deepEqual(log, ["https://dead.example.org/charts", "https://web.archive.org/web/2019/https://dead.example.org/charts"]);
  assert.deepEqual(pathWords(t).map((h) => h.text), ["Wikipedia “Quillon”", "reference 3", "dead.example.org (archived copy, 2019)"]);
  const log2 = [];
  await followClaim({ sentence: "Its basin holds half of the population of Ostland.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader(PAGES, log2) });
  assert.deepEqual(log2, ["https://stats.example.org/basin"], "the page was read and disagreed: its archive is not tried");
});

test("followClaim: a lead that cites nothing is followed through the article's BODY (the same thing said where it is cited), and the path says so", async () => {
  const t = await followClaim({ sentence: "Quillon is a river in the north of Ostland and the longest in the country.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader() });
  // the lead's own words are not under a footnote; the body sentence nearest to them is, but a loose match only NAMES a page — the page must carry the lead's claim
  assert.ok(["origin", "unsupported", "no-reference"].includes(t.status));
  if (t.status === "origin") assert.ok(t.path.some((h) => h.kind === "in-article"), "an origin reached through the body says it came through the body");
});

test("followClaim: typed outcomes — no footnote, not in the article, article not served, nothing readable", async () => {
  const lead = "Quillon is a river in the north of Ostland and the longest in the country.";
  const nref = await followClaim({ sentence: lead, passage: { url: WIKI_URL }, fetchImpl: api(`<p>${lead}</p>`), read: reader() });
  assert.equal(nref.status, "no-reference"); assert.match(pointerWords(nref), /cites nothing for this sentence/);
  const unl = await followClaim({ sentence: "Something the article never says at all, in other words.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader() });
  assert.equal(unl.status, "unlocated");
  const unidx = await followClaim({ sentence: lead, passage: { url: WIKI_URL }, fetchImpl: api(ARTICLE, { ok: false }), read: reader() });
  assert.equal(unidx.status, "unindexed"); assert.equal(unidx.found, null);
  const unread = await followClaim({ sentence: "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader({}) });
  assert.equal(unread.status, "unread"); assert.equal(unread.refs.length, 1); assert.match(pointerWords(unread), /references could not be read\. It points to 1 original source\./);
  const notWiki = await followClaim({ sentence: lead, passage: { url: "https://example.org/a" }, fetchImpl: api(), read: reader() });
  assert.equal(notWiki.status, "unindexed", "a page that is not an article has no footnotes to follow");
});

test("followClaim: nothing it was given can make it throw", async () => {
  for (const o of [{}, { sentence: null }, { sentence: "x", passage: null }, { sentence: "a b c d e f", passage: { url: WIKI_URL }, fetchImpl: async () => { throw new Error("boom"); } }]) {
    const t = await followClaim(o); assert.ok(["unindexed", "unlocated", "no-reference", "unread"].includes(t.status), JSON.stringify(o).slice(0, 40));
  }
});

test("followClaim: when no footnote leads anywhere, a page ALREADY READ that says the same is the origin, and the path says 'also on'", async () => {
  const lead = "Quillon is a river in the north of Ostland and the longest in the country.";
  const read = [{ url: "https://geo.example.org/ostland", title: "Ostland", text: "Ostland geography. The Quillon is a river in the north of Ostland and it is the longest river in the country. Its mouth is on the Sund Sea." }];
  const t = await followClaim({ sentence: lead, passage: { url: WIKI_URL, title: "Quillon" }, fetchImpl: api(`<p>${lead}</p>`), read: reader({}), alongside: [{ url: WIKI_URL, text: lead }, ...read] });
  assert.equal(t.status, "origin"); assert.equal(t.origin.url, "https://geo.example.org/ostland");
  assert.deepEqual(t.path.map((h) => h.kind), ["found-in", "alongside", "read"]);
  assert.deepEqual(pathWords(t).map((h) => h.text), ["Wikipedia “Quillon”", "also on", "geo.example.org"]);
  assert.equal(corroboration(lead, [{ url: "https://en.wikipedia.org/wiki/Other", text: lead }]), null, "FALSIFIER: another encyclopedia page is not corroboration");
  assert.equal(corroboration(lead, [{ url: "https://x.example.org/", text: lead, snippetOnly: true }]), null, "a search snippet was never a read page");
});

test("wikiIndex: one parse call per article per tab, and a refusal is null", async () => {
  let calls = 0; const f = async (u, o) => { calls++; return api()(u, o); };
  const memo = { pages: new Map(), dead: new Map() };
  const a = await wikiIndex(WIKI_URL, { fetchImpl: f, memo }); const b = await wikiIndex(WIKI_URL, { fetchImpl: f, memo });
  assert.equal(calls, 1); assert.strictEqual(a, b);
  assert.equal(await wikiIndex("https://example.org/", { fetchImpl: f }), null);
  assert.equal(await wikiIndex(WIKI_URL, { fetchImpl: api(ARTICLE, { ok: false }) }), null);
});

test("holonAddress: the claim's own identity is its address in the passage — and none is given when it does not read back", () => {
  const p = { ref: "S1", url: WIKI_URL, text: "Intro words. The Quillon is long. Outro." };
  assert.equal(holonAddress(p, "The Quillon is long."), "S1#13-33");
  assert.equal(p.text.slice(13, 33), "The Quillon is long.");
  assert.equal(holonAddress(p, "Not in the text."), null); assert.equal(holonAddress({ url: WIKI_URL }, "x"), null);
});

// ───────────────────────── a whole turn ─────────────────────────
const TURN = (row, extra = {}) => ({ schema: "AnswerTurn@1", said: "How long is the Quillon?", searched: [], lang: { code: "en" }, void: null, answer: { text: row.sentence, standing: "survived", row, filler: null, unmeasured: [], survived: [] }, contest: [], gap: null, trace: [{ n: 1, say: "first line", detail: "", result: "", probe: null }], sources: [], ...extra });
const ROW = (sentence = "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.", url = WIKI_URL) => ({ tier: "T1", sentence, source: { ref: "S1", title: "Quillon", url, host: new URL(url).hostname, lang: "en" }, span: [0, sentence.length], polarity: "+", tense: "present", filler: null, emphasis: [] });

test("originateTurn: an encyclopedia row gains its origin; the row's own words, the answer and the standing are untouched; one first-person trace line is added", async () => {
  const row = ROW();
  const out = await originateTurn(TURN(row), { passages: [], fetchImpl: api(), read: reader(), reading: READING });
  assert.equal(out.answer.row.origin.status, "origin");
  assert.equal(out.answer.row.origin.origin.url, "https://survey.example.org/rivers/quillon");
  assert.equal(out.answer.row.sentence, row.sentence); assert.equal(out.answer.standing, "survived"); assert.equal(out.answer.text, row.sentence);
  assert.deepEqual(out.answer.unmeasured, [], "an origin was read: nothing is added to 'not checked'");
  assert.equal(out.trace.length, 2); assert.equal(out.trace[1].n, 2);
  assert.match(out.trace[1].say, /Wikipedia is a pointer, not a source I cite, so I followed the article's own reference to survey\.example\.org and read it/);
  assert.equal(out.origins[0].url, "https://survey.example.org/rivers/quillon");
  assert.equal(out.origin, undefined);
  assert.ok(!("passage" in out.answer.row.origin.origin), "the stored trail carries no page text");
  assert.ok(JSON.stringify(out).length < 6000);
});

test("originateTurn FALSIFIER: with no origin read the answer says so under 'not checked', the trace line says it was not cited, and nothing is cited as Wikipedia", async () => {
  const out = await originateTurn(TURN(ROW("Its basin holds half of the population of Ostland.")), { passages: [], fetchImpl: api(), read: reader() });
  assert.equal(out.answer.row.origin.status, "unsupported");
  assert.deepEqual(out.answer.unmeasured, [ORIGIN_NOT_READ]);
  assert.match(out.trace[1].say, /which I don't cite/); assert.equal(out.trace[1].unmeasured, true);
  assert.deepEqual(out.origins, []);
});

test("originateTurn: a turn with no encyclopedia row, a handoff, an aborted turn are returned as they were; a slow origin is boxed and leaves pointers", async () => {
  const other = TURN(ROW("The Quillon is long and wide, they say, in the north.", "https://geo.example.org/q"));
  assert.strictEqual(await originateTurn(other, { fetchImpl: api(), read: reader() }), other);
  const h = { handoff: { kind: "x" } }; assert.strictEqual(await originateTurn(h, {}), h);
  const ab = { aborted: true }; assert.strictEqual(await originateTurn(ab, {}), ab);
  const slow = async () => new Promise(() => {});
  const t0 = Date.now();
  const out = await originateTurn(TURN(ROW()), { fetchImpl: api(), read: slow, boxMs: 60 });
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(out.answer.row.origin.status, "unread");
});

test("originateTurn: contest and gap rows are followed too, each by its own sentence; a repeated row is followed once", async () => {
  const a = ROW(), b = ROW("The first chart of the river was made in 1802.");
  let reads = 0; const rd = async (u, o) => { reads++; return reader()(u, o); };
  const turn = { ...TURN(a), answer: null, contest: [a, b], gap: { kind: "refuted", closest: a, refuters: [b] } };
  const out = await originateTurn(turn, { fetchImpl: api(), read: rd, reading: READING });
  assert.equal(out.contest[0].origin.status, "origin"); assert.equal(out.contest[1].origin.status, "origin");
  assert.equal(out.gap.closest.origin.status, "origin"); assert.equal(out.gap.refuters[0].origin.status, "origin");
  assert.equal(reads, 3, "rows a and b are followed once each (a's survey page, b's archive after its dead original)");
});

test("slimTrail / pathWords / traceWords tolerate anything", () => {
  assert.equal(slimTrail(null), null); assert.deepEqual(pathWords(null), []); assert.match(pointerWords(null), /not cited/); assert.match(traceWords(null), /which I don't cite/);
});

// ───────────────────────── rung 2: the Pivot's reading under the asker's frame ─────────────────────────
const SURVEY = { url: "https://survey.example.org/q", title: "Rivers of Ostland", text: PAGES["https://survey.example.org/rivers/quillon"] };
const CLAIM = "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.";

test("the frame is the Pivot's own: slot, referent resolved by TITLE, predicate stems — and a question that is not a slot ask has none", async () => {
  assert.equal(READING.frame.ok, true); assert.equal(READING.frame.slot, "quantity");
  assert.deepEqual(READING.frame.referents.map((r) => r.title), ["Quillon"]);
  assert.equal(await readFrame("", {}), null);
  assert.equal(await readFrame("Tell me about rivers.", { fetchImpl: async () => { throw new Error("no network for a non-slot ask"); }, lang: "en" }), null, "not a slot ask: no frame, no network");
  assert.equal(await readFrame("How many kilometres does the Quillon run?", { fetchImpl: async () => { throw new Error("down"); }, lang: "en" }), null, "titles unreachable: no frame, never a throw");
});

test("supportByFrame: the same assertion in other words is SAME and addressed; another filler is DIFFERENT (a rival); a negated page is DIFFERENT; an unrelated page is UNDECIDABLE", () => {
  const same = supportByFrame(CLAIM, SURVEY, READING);
  assert.equal(same.verdict, "same"); assert.equal(same.filler, "640");
  assert.equal(SURVEY.text.slice(...same.address.split("#")[1].split("-").map(Number)), same.sentence, "the address reads back as the page's own bytes");
  const rival = supportByFrame(CLAIM, { ...SURVEY, text: "The Quillon river flows for 580 kilometres from the Karth Mountains to the Sund Sea." }, READING);
  assert.equal(rival.verdict, "different"); assert.equal(rival.why, "filler"); assert.equal(rival.filler, "580");
  const neg = supportByFrame(CLAIM, { ...SURVEY, text: "The Quillon river does not run for 640 kilometres at all." }, READING);
  assert.equal(neg.verdict, "different"); assert.equal(neg.why, "polarity");
  const none = supportByFrame(CLAIM, { ...SURVEY, text: "The Karth Mountains are the highest range of Ostland and they are cold." }, READING);
  assert.equal(none.verdict, "undecidable"); assert.equal(none.why, "frame-unbound");
  assert.equal(supportByFrame(CLAIM, SURVEY, null), null, "no frame: the rung does not apply");
  assert.equal(supportByFrame("Nothing about the river is said here at all.", SURVEY, READING), null, "a claim that holds no filler under the frame has nothing to compare");
});

test("supportByFrame: a quantity is the same quantity however it is written; a tense the page does not share is not support", () => {
  assert.equal(supportByFrame("The Quillon runs for 1,200 kilometres to the sea.", { ...SURVEY, text: "The Quillon river runs for 1200 kilometres to the Sund Sea." }, READING).verdict, "same");
  const past = supportByFrame("The Quillon is 640 kilometres in length.", { ...SURVEY, text: "The Quillon was 640 kilometres in length before the dam." }, READING);
  assert.notEqual(past.verdict, "same");
});

test("supportOf: rung 1 first (a claim in the page's own words needs no frame); rung 2 only when the words differ; a rival from rung 2 is reported", () => {
  const verbatim = supportOf("The Quillon river flows for 640 kilometres from the Karth Mountains in the north to the Sund Sea.", SURVEY, { forWhom: ASK, reading: READING });
  assert.equal(verbatim.verdict, "same"); assert.equal(verbatim.identity.by, "consequence");
  const reworded = supportOf(CLAIM, SURVEY, { forWhom: ASK, reading: READING });
  assert.equal(reworded.verdict, "same"); assert.equal(reworded.identity.by, "bound"); assert.equal(reworded.rung, "bound");
  const rival = supportOf(CLAIM, { ...SURVEY, text: "The Quillon river flows for 580 kilometres from the Karth Mountains to the Sund Sea." }, { forWhom: ASK, reading: READING });
  assert.equal(rival.verdict, "different"); assert.match(rival.detail, /another filler/);
  assert.equal(supportOf(CLAIM, SURVEY, { forWhom: ASK }).verdict, "undecidable", "without the frame the reworded claim is typed undecidable, never guessed");
});

// ───────────────────────── how a fact fails here (the nine operators, at three grains) ─────────────────────────
test("failure typing: a REFUSAL (SIG: nobody marked it, nothing reached) is not a FALSEHOOD (CON: a contradicted edge) — and each says at which grain it failed", async () => {
  const lead = "Quillon is a river in the north of Ostland and the longest in the country.";
  const nref = await followClaim({ sentence: lead, passage: { url: WIKI_URL }, fetchImpl: api(`<p>${lead}</p>`), read: reader() });
  assert.deepEqual({ ...nref.fails }, { ...FAILURE["no-reference"] }); assert.equal(nref.fails.op, "SIG"); assert.equal(nref.fails.kind, "refusal"); assert.equal(nref.fails.grain, "figure");
  const unread = await followClaim({ sentence: "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader({}) });
  assert.equal(unread.fails.op, "SIG"); assert.equal(unread.fails.grain, "ground", "a record that cannot be reached is a failure of the record, not of this claim");
  const down = await followClaim({ sentence: lead, passage: { url: WIKI_URL }, fetchImpl: api(ARTICLE, { ok: false }), read: reader() });
  assert.equal(down.fails.grain, "ground");
  for (const k of Object.keys(FAILURE)) assert.ok(["refusal", "gap", "falsified"].includes(FAILURE[k].kind) && ["ground", "figure", "pattern"].includes(FAILURE[k].grain), k);
  assert.deepEqual(Object.entries(FAILURE).filter(([, v]) => v.kind === "falsified").map(([k]) => k), ["contradicted"], "only a contradicted edge FALSIFIES; everything else is a refusal or a typed gap");
});

test("failureOfWhy: each typed reason lands at the operator whose question it is — and an unknown reason is a said gap, never a guess", () => {
  const f = (w, v) => { const r = failureOfWhy(w, v); return [r.op, r.kind]; };
  assert.deepEqual(f("figure", "undecidable"), ["SEG", "gap"]); assert.deepEqual(f("figure-unit"), ["SEG", "gap"]); assert.deepEqual(f("tense"), ["SEG", "gap"]);
  assert.deepEqual(f("unread-structure"), ["EVA", "gap"], "a comparison or negation: no null, no verdict");
  assert.deepEqual(f("terms"), ["DEF", "gap"]); assert.deepEqual(f("no-overlap"), ["NUL", "gap"]); assert.deepEqual(f("idle"), ["NUL", "gap"]);
  assert.deepEqual(f("polarity", "different"), ["CON", "falsified"]); assert.deepEqual(f("filler", "different"), ["CON", "falsified"]);
  assert.deepEqual(f("something-new"), ["SIG", "gap"]); assert.deepEqual(f(undefined), ["SIG", "gap"]);
});

test("followClaim: a footnote's page that says something ELSE about the same thing makes the claim CONTRADICTED (CON) — kept apart from 'unsupported', with the page's own sentence", async () => {
  const pages = { ...PAGES, "https://survey.example.org/rivers/quillon": "Rivers of Ostland. The Quillon river flows for 580 kilometres from the Karth Mountains to the Sund Sea. It is the longest river of Ostland." };
  const t = await followClaim({ sentence: "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.", passage: { url: WIKI_URL, title: "Quillon" }, fetchImpl: api(), read: reader(pages), forWhom: ASK, reading: READING });
  assert.equal(t.status, "contradicted"); assert.equal(t.fails.op, "CON"); assert.equal(t.fails.kind, "falsified");
  assert.equal(t.origin, null, "a contradicting page is never an origin");
  assert.equal(t.refuter.url, "https://survey.example.org/rivers/quillon"); assert.match(t.refuter.sentence, /580 kilometres/); assert.match(t.refuter.address, /^origin#\d+-\d+$/);
  assert.match(pointerWords(t), /not cited: a page it points to says something else about the same thing/);
  assert.equal(t.tried[0].fails.op, "CON");
  const slim = slimTrail(t); assert.equal(slim.status, "contradicted"); assert.equal(slim.refuter.url, t.refuter.url);
  // the SAME claim against a page that merely does not carry it is NOT contradicted
  const silent = await followClaim({ sentence: "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader({ ...PAGES, "https://survey.example.org/rivers/quillon": "Rivers of Ostland. The Karth Mountains are the highest range of the country and they are cold." }), reading: READING });
  assert.equal(silent.status, "unsupported"); assert.equal(silent.fails.kind, "gap");
});

test("pattern: several footnotes that carry the claim are counted, and 'independent' is distinct HOSTS — one upstream repeated is not several attestations", async () => {
  const two = `<p>The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.<sup class="reference"><a href="#cite_note-1">[1]</a></sup><sup class="reference"><a href="#cite_note-2">[2]</a></sup><sup class="reference"><a href="#cite_note-3">[3]</a></sup></p>
<ol class="references"><li id="cite_note-1"><cite><a class="external text" href="https://survey.example.org/rivers/quillon">A</a></cite></li><li id="cite_note-2"><cite><a class="external text" href="https://atlas.example.net/quillon">B</a></cite></li><li id="cite_note-3"><cite><a class="external text" href="https://survey.example.org/other/quillon-2">C</a></cite></li></ol>`;
  const pages = { ...PAGES, "https://atlas.example.net/quillon": "Atlas. The Quillon river flows for 640 kilometres from the Karth Mountains to the Sund Sea.", "https://survey.example.org/other/quillon-2": "Survey. The Quillon river flows for 640 kilometres from the Karth Mountains to the Sund Sea." };
  const t = await followClaim({ sentence: "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.", passage: { url: WIKI_URL }, fetchImpl: api(two), read: reader(pages), reading: READING, maxAttempts: 3 });
  assert.equal(t.status, "origin"); assert.equal(t.origin.url, "https://survey.example.org/rivers/quillon", "the first, in the article's own order, is the origin");
  assert.equal(t.pattern.attests, 3); assert.equal(t.pattern.independent, 2); assert.deepEqual(t.pattern.hosts, ["survey.example.org", "atlas.example.net"]);
  assert.equal(t.pattern.also.length, 2); assert.match(t.pattern.basis, /declared proxy/);
  const one = await followClaim({ sentence: "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.", passage: { url: WIKI_URL }, fetchImpl: api(), read: reader(), reading: READING });
  assert.equal(one.pattern.attests, 1); assert.equal(one.pattern.independent, 1);
});

test("REC: the article's revision and an archived copy's date are recorded — a claim is true on ITS ground", async () => {
  assert.equal(archivedAsOf("https://web.archive.org/web/20190301120000/https://a.example/x"), "2019-03-01");
  assert.equal(archivedAsOf("https://web.archive.org/web/2019/https://a.example/x"), "2019");
  assert.equal(archivedAsOf("https://a.example/x"), null); assert.equal(archivedAsOf(null), null);
  const t = await followClaim({ sentence: "The first chart of the river was made in 1802.", passage: { url: WIKI_URL, title: "Quillon" }, fetchImpl: api(), read: reader() });
  assert.equal(t.found.revid, 4242, "which revision of the article the claim was read from");
  assert.equal(t.origin.copy, true); assert.equal(t.origin.asOf, "2019");
  assert.equal(t.origin.url, "https://dead.example.org/charts", "cited as the page the footnote names; the archive is how it was read");
  assert.equal(slimTrail(t).origin.asOf, "2019");
});
