// fold-chat-originwire.test.mjs — the passage-level half of "an encyclopedia is a pointer, never a citation" and what the Sources-only strand does with it.
// No network: the article's parse API and every page read are stubs. FALSIFIER = fails if the claim it guards is wrong.
import test from "node:test";
import assert from "node:assert/strict";
import { originatePassages, MAX_CLAIMS } from "./fold-chat-originwire.js";
import { snipsOf, verifySnips, creditText, storeSnip } from "./fold-chat-strand.js";
import { stripScaffolding } from "./fold-chat-attribution.js";

const WIKI_URL = "https://en.wikipedia.org/wiki/Quillon";
const LEAD = "The Quillon rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea.";
const ARTICLE = `<p>${LEAD}<sup class="reference"><a href="#cite_note-1">[1]</a></sup> Its basin holds about a third of the people of Ostland.<sup class="reference"><a href="#cite_note-2">[2]</a></sup></p>
<ol class="references">
<li id="cite_note-1"><cite><a rel="nofollow" class="external text" href="https://survey.example.org/rivers/quillon">Rivers of Ostland</a></cite></li>
<li id="cite_note-2"><cite><a rel="nofollow" class="external text" href="https://dead.example.org/basin">Basin census</a></cite></li>
</ol>`;
const SURVEY_TEXT = "Rivers of Ostland. The Quillon river rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea. It is the longest river of Ostland and its mouth is wide.";
const api = (html = ARTICLE) => async (url) => {
  if (/wikipedia\.org\/w\/api\.php/.test(String(url))) return { ok: true, json: async () => ({ parse: { title: "Quillon", revid: 7, text: html } }) };
  throw new Error("unexpected fetch " + url);
};
const reader = (pages) => async (url) => (pages[url] ? { ok: true, text: pages[url], title: "T", via: "direct", url } : { ok: false, text: "", title: "", via: null, url });
const wikiPassage = () => ({ ref: "Wikipedia — Quillon", title: "Quillon", url: WIKI_URL, source: WIKI_URL, text: LEAD + " Its basin holds about a third of the people of Ostland." });
const ASK = "How long is the Quillon river";

test("originatePassages: a footnote's page that carries the claim is APPENDED as an origin passage (with the sentence's address) and the encyclopedia passage becomes a pointer", async () => {
  const passages = [wikiPassage()];
  const { trails } = await originatePassages(passages, ASK, { fetchImpl: api(), read: reader({ "https://survey.example.org/rivers/quillon": SURVEY_TEXT }), reading: null });
  assert.ok(MAX_CLAIMS >= 1);
  const [wiki, origin] = passages;
  assert.equal(passages.length, 2);
  assert.equal(wiki.tertiary, true); assert.deepEqual(wiki.origins.map((o) => o.url), ["https://survey.example.org/rivers/quillon"]);
  assert.equal(origin.origin, true); assert.equal(origin.url, "https://survey.example.org/rivers/quillon");
  assert.equal(origin.holons.length, 1); assert.match(origin.holons[0].address, /^origin#\d+-\d+$/);
  assert.match(SURVEY_TEXT.slice(origin.holons[0].start, origin.holons[0].end), /^The Quillon river rises in the Karth Mountains and runs for 640 kilometres/, "the holon reads back as the page's own bytes");
  assert.ok(trails.length >= 1 && trails.every((t) => t.url === WIKI_URL));
});

test("originatePassages: the Sources-only strand shows the ORIGIN's supporting sentence and none of the encyclopedia's words — verified against the page, path kept", async () => {
  const passages = [wikiPassage()];
  await originatePassages(passages, ASK, { fetchImpl: api(), read: reader({ "https://survey.example.org/rivers/quillon": SURVEY_TEXT }), reading: null });
  const strand = snipsOf(passages, ASK);
  assert.ok(strand.snips.length >= 1);
  assert.ok(strand.snips.every((s) => !/wikipedia/i.test(s.source || "")), "no snip is sourced to the encyclopedia");
  const sn = strand.snips.find((s) => s.source === "https://survey.example.org/rivers/quillon");
  assert.ok(sn); assert.match(sn.text, /^The Quillon river rises in the Karth Mountains and runs for 640 kilometres/); assert.equal(sn.kind, "passage");
  assert.equal(sn.via.status, "origin"); assert.equal(sn.via.found.url, WIKI_URL, "the path is kept: where it was found");
  assert.match(sn.address, /^origin#\d+-\d+$/);
  assert.equal(verifySnips(strand.snips, passages).ok, true, "every snip is verbatim in the page it claims");
  assert.equal(storeSnip(sn).via.status, "origin"); assert.equal(storeSnip(sn).address, sn.address, "the path and the address ride the stored snip");
});

test("originatePassages FALSIFIER: with no origin reached the encyclopedia's words are drawn as a POINTER — never as the source — and the pages it points at ride along", async () => {
  const passages = [wikiPassage()];
  await originatePassages(passages, ASK, { fetchImpl: api(), read: reader({}), reading: null });
  assert.equal(passages.length, 1, "nothing appended");
  assert.equal(passages[0].tertiary, true); assert.deepEqual(passages[0].origins, []);
  assert.deepEqual(passages[0].pointers.map((p) => p.url), ["https://survey.example.org/rivers/quillon", "https://dead.example.org/basin"], "one pointer per footnote, in the article's order");
  const strand = snipsOf(passages, ASK);
  assert.ok(strand.snips.length >= 1);
  for (const s of strand.snips) { assert.equal(s.kind, "pointer"); assert.equal(s.credit, ""); assert.match(creditText(s), /^a pointer, not a source/); }
  assert.deepEqual(strand.snips[0].pointers.map((p) => p.url), ["https://survey.example.org/rivers/quillon", "https://dead.example.org/basin"]);
  assert.equal(strand.snips[0].via.found.url, WIKI_URL);
  assert.equal(verifySnips(strand.snips, passages).ok, true, "a pointer's words are still verbatim in the page they were found on");
  assert.equal(storeSnip(strand.snips[0]).pointers.length, 2);
});

test("originatePassages: a page ALREADY READ that says the same is the origin (no fetch), and a passage that is not an encyclopedia page is untouched", async () => {
  const geo = { ref: "geo — Ostland", title: "Ostland", url: "https://geo.example.org/ostland", text: "Ostland geography. The Quillon river rises in the Karth Mountains and runs for 640 kilometres to the Sund Sea, and it is the longest river here." };
  const passages = [wikiPassage(), geo];
  const before = JSON.stringify(geo);
  await originatePassages(passages, ASK, { fetchImpl: api(ARTICLE.replace(/<sup[\s\S]*?<\/sup>/g, "")), read: reader({}), reading: null });
  assert.equal(passages.length, 2, "no passage appended: the origin was already read");
  assert.equal(passages[0].origins[0].url, "https://geo.example.org/ostland");
  assert.equal(passages[1].tertiary, undefined); assert.equal(passages[1].origin, undefined);
  assert.ok(passages[1].holons && passages[1].holons.length >= 1);
  const strand = snipsOf(passages, ASK);
  assert.ok(strand.snips.some((s) => s.source === "https://geo.example.org/ostland" && s.via && s.via.status === "origin"));
  assert.ok(strand.snips.every((s) => !/wikipedia/i.test(s.source || "")));
  assert.notEqual(before, JSON.stringify(passages[1]), "(it gained its holon)");
  const only = [geo]; assert.deepEqual((await originatePassages(only, ASK, { fetchImpl: api(), read: reader({}) })).trails, []);
});

test("originatePassages: never throws and never hangs — a refused article, a slow read, a snippet, a non-array", async () => {
  const p1 = [wikiPassage()];
  const down = await originatePassages(p1, ASK, { fetchImpl: async () => { throw new Error("down"); }, read: reader({}), reading: null });
  assert.equal(p1[0].tertiary, true); assert.ok(down.trails.every((t) => t.trail.status === "unindexed"));
  const p2 = [wikiPassage()]; const t0 = Date.now();
  await originatePassages(p2, ASK, { fetchImpl: api(), read: () => new Promise(() => {}), reading: null, boxMs: 50 });
  assert.ok(Date.now() - t0 < 3000); assert.equal(p2[0].tertiary, true);
  const snippet = [{ ...wikiPassage(), snippetOnly: true }]; assert.deepEqual((await originatePassages(snippet, ASK, {})).trails, []); assert.equal(snippet[0].tertiary, undefined);
  assert.deepEqual(await originatePassages(null, ASK, {}), { trails: [] });
});

test("the model-facing chips: a [W#] on a marked encyclopedia passage shows the originals that were read, else pointers — never the encyclopedia", async () => {
  const passages = [wikiPassage()];
  await originatePassages(passages, ASK, { fetchImpl: api(), read: reader({ "https://survey.example.org/rivers/quillon": SURVEY_TEXT }), reading: null });
  const chips = stripScaffolding("It runs for 640 kilometres [W1].", passages.slice(0, 1)).cited;
  assert.deepEqual(chips.map((c) => [c.url, !!c.pointer]), [["https://survey.example.org/rivers/quillon", false]]);
  const unread = [wikiPassage()];
  await originatePassages(unread, ASK, { fetchImpl: api(), read: reader({}), reading: null });
  const pc = stripScaffolding("It runs far [W1].", unread).cited;
  assert.ok(pc.length >= 1 && pc.every((c) => c.pointer === true && !/wikipedia/i.test(c.url)));
});
