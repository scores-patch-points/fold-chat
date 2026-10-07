// fold-chat-primary.test.mjs — pointer-guided primary search. Every falsifier hands the module a lie (a mirror, a denial, a made-up number, a dead page, an abort).
// Pre-registered in eval/ants/A2-PREREG.md (F1-F13). The search, the page read and the model are stubs; the page texts are written the way real pages read.
// PRIMARY_MODULE overrides the module under test (eval/ants/A2-mutate.mjs runs this file against a copy with one gate deleted).
import test from "node:test";
import assert from "node:assert/strict";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { provenanceFor, verifyNarration } from "./fold-chat-provenance.js";

const P = await import(process.env.PRIMARY_MODULE || "./fold-chat-primary.js");
const { findPrimary, queriesFor, distinctivePhrase, dropReason, kindOf, mirrorOf, assertsClaim, assertionOf, mergeProvenance, PRIMARY } = P;
const FW = functionWordsOf("en");

const CLAIM = "The Eiffel Tower is 330 metres tall.";
const SENTENCE = "The Eiffel Tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building.";
const WIKI_SENTENCES = [
  "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.",
  "It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889.",
  SENTENCE,
  "It was the first structure in the world to surpass both the Washington Monument and the Cologne Cathedral in height.",
  "The tower has three levels for visitors, with restaurants on the first and second levels.",
];
const WIKI_TEXT = WIKI_SENTENCES.join(" ");
const WIKI_URL = "https://en.wikipedia.org/wiki/Eiffel_Tower";

const OFFICIAL = "The Eiffel Tower is 330 metres tall, which is about the height of an 81-storey building. The tower was built by the company of Gustave Eiffel for the 1889 World's Fair. Today around six million people climb it each year, which makes it one of the most visited paid monuments in the world.";
const page = (...sentences) => sentences.join(" ");
const PAD = "Visit the official site for opening times, ticket prices and accessibility information before you plan your trip to the monument.";

/** A model stub: replies with the number of the first numbered sentence containing `needle` (the way a model would point), NONE otherwise. Records every call. */
function pointer(needle, log = []) {
  return async (messages) => {
    log.push(messages);
    const lines = String(messages[1].content).split("\n").filter((l) => /^\[\d+\]/.test(l));
    const hit = lines.find((l) => l.includes(needle));
    return hit ? /^\[(\d+)\]/.exec(hit)[1] : "NONE";
  };
}
/** A search stub that answers every query with the same results, and records the queries. */
const searching = (results, log = []) => async (q) => { log.push(q); return results; };
/** A page-read stub from a url → text map, recording the order read. */
const reading = (map, log = []) => async (url) => { log.push(url); if (!(url in map)) return null; const v = map[url]; if (v instanceof Error) throw v; return v; };
const run = (o) => findPrimary({ claim: CLAIM, sentence: SENTENCE, indexHost: "en.wikipedia.org", fw: FW, indexText: WIKI_TEXT, ...o });
const verdicts = (r) => r.trail.map((t) => `${t.host}:${t.verdict}`);

// ─────────────── step 1: queries ───────────────

test("queriesFor: 1-3 queries, the first a quoted phrase taken verbatim from the sentence, no model, no encyclopedia name, pure", () => {
  const a = queriesFor({ claim: CLAIM, sentence: SENTENCE, fw: FW, indexHost: "en.wikipedia.org" });
  const b = queriesFor({ claim: CLAIM, sentence: SENTENCE, fw: FW, indexHost: "en.wikipedia.org" });
  assert.deepEqual(a, b);
  assert.ok(a.length >= 1 && a.length <= 3, String(a.length));
  assert.match(a[0], /^".+"$/);
  const phrase = a[0].slice(1, -1);
  assert.ok(SENTENCE.includes(phrase), "verbatim and contiguous: " + phrase);
  assert.ok(WIKI_SENTENCES.every((s) => { const p = distinctivePhrase(s, FW); return p && s.includes(p); }), "every sentence's phrase is a contiguous slice of it (including across 'Dr.' and brackets)");
  assert.ok(["Dr. Smith, Ph.D. (born 1950) studied the long-lived Greenland shark in 2016."].every((s) => s.includes(distinctivePhrase(s, FW))));
  assert.ok(a.slice(1).every((q) => !/wikipedia/i.test(q)));
  assert.match(a[1], /eiffel/); assert.match(a[1], /330/);
  assert.equal(new Set(a).size, a.length);
});

test("queriesFor: works without a closed-class list, honours max, and a sentence too short for a phrase still yields a terms query", () => {
  assert.ok(queriesFor({ claim: CLAIM, sentence: SENTENCE, fw: null }).length >= 1);
  assert.equal(queriesFor({ claim: CLAIM, sentence: SENTENCE, fw: FW, max: 1 }).length, 1);
  const q = queriesFor({ claim: "Charles III is king.", sentence: "Charles III reigns.", fw: FW });
  assert.ok(q.length >= 1 && q.every((x) => typeof x === "string"));
  assert.equal(distinctivePhrase("too short", FW), null);
});

// ─────────────── the happy path ───────────────

test("a primary page that says it: returned as an origin passage with the contract's shape; the encyclopedia, its mirrors and a content farm are on the trail, not in the passages", async () => {
  const reads = [];
  const r = await run({
    search: searching([
      { title: "Eiffel Tower - Wikipedia", url: WIKI_URL, snippet: "" },
      { title: "Eiffel Tower | Wikiwand", url: "https://www.wikiwand.com/en/Eiffel_Tower", snippet: "" },
      { title: "How tall is the Eiffel Tower? - Quora", url: "https://www.quora.com/How-tall-is-the-Eiffel-Tower", snippet: "" },
      { title: "The Eiffel Tower — facts", url: "https://www.toureiffel.paris/en/the-monument", snippet: "" },
    ]),
    readPage: reading({ "https://www.toureiffel.paris/en/the-monument": page(OFFICIAL, PAD) }, reads),
    point: pointer("330 metres"),
  });
  assert.equal(r.passages.length, 1);
  const p = r.passages[0];
  assert.deepEqual(Object.keys(p).sort(), ["foundVia", "origin", "ref", "text", "title", "url"]);
  assert.equal(p.origin, true); assert.deepEqual(p.foundVia, { host: "en.wikipedia.org" });
  assert.equal(p.url, "https://www.toureiffel.paris/en/the-monument");
  assert.match(p.ref, /^toureiffel\.paris — /);
  assert.equal(p.text, page(OFFICIAL, PAD));
  assert.deepEqual(reads, ["https://www.toureiffel.paris/en/the-monument"], "only the primary page was read");
  const v = verdicts(r);
  assert.ok(v.includes("en.wikipedia.org:tertiary")); assert.ok(v.includes("wikiwand.com:mirror")); assert.ok(v.includes("quora.com:tertiary")); assert.ok(v.includes("toureiffel.paris:origin"));
  // F10: the pointer's sentence is a verbatim slice of the page's own text
  assert.equal(r.pointers.length, 1);
  assert.equal(p.text.slice(r.pointers[0].start, r.pointers[0].end).startsWith("The Eiffel Tower is 330 metres tall"), true);
  assert.equal(r.pointers[0].tier, "origin"); assert.equal(r.pointers[0].index, 0);
  for (const t of r.trail) assert.ok(["read", "mirror", "tertiary", "unreadable", "unsupported", "origin"].includes(t.verdict));
});

// ─────────────── F1: a mirror is not a witness ───────────────

test("F1: a page that copies the encyclopedia page (re-ordered, padded, on an unknown host) is a mirror by TEXT, never a passage", async () => {
  const copy = page(WIKI_SENTENCES[2], WIKI_SENTENCES[0], WIKI_SENTENCES[4], WIKI_SENTENCES[1], WIKI_SENTENCES[3], "Related articles: Paris, Gustave Eiffel, iron architecture, the 1889 Exposition Universelle.");
  const r = await run({
    search: searching([{ title: "Eiffel Tower facts", url: "https://eiffelfacts.example/tower", snippet: "" }]),
    readPage: reading({ "https://eiffelfacts.example/tower": copy }),
    point: pointer("330 metres"),
  });
  assert.equal(r.passages.length, 0);
  assert.deepEqual(r.trail.map((t) => t.verdict), ["mirror"]);
  assert.match(r.trail[0].why, /^shares_\d+pct/);
});

test("F1: declared mirror hosts are dropped BEFORE reading (never fetched)", async () => {
  const urls = ["https://www.wikiwand.com/en/Eiffel_Tower", "https://dbpedia.org/page/Eiffel_Tower", "https://alchetron.com/Eiffel-Tower", "https://kids.kiddle.co/Eiffel_Tower", "https://wikimili.com/en/Eiffel_Tower", "https://eiffel.fandom.com/wiki/Tower"];
  const reads = [];
  const r = await run({ search: searching(urls.map((url) => ({ title: "t", url }))), readPage: reading({}, reads), point: pointer("330") });
  assert.deepEqual(reads, []);
  assert.equal(r.passages.length, 0);
  assert.ok(r.trail.filter((t) => t.url).length === urls.length && r.trail.every((t) => t.verdict === "mirror" && t.why === "mirror_host"), JSON.stringify(r.trail));
});

test("F1: a page carrying the encyclopedia's own attribution is a mirror even with no index text to compare with", async () => {
  const stamped = page("From Wikipedia, the free encyclopedia.", OFFICIAL, PAD);
  const r = await run({ indexText: null, search: searching([{ title: "x", url: "https://copycat.example/eiffel" }]), readPage: reading({ "https://copycat.example/eiffel": stamped }), point: pointer("330 metres") });
  assert.equal(r.passages.length, 0);
  assert.equal(r.trail[0].verdict, "mirror"); assert.equal(r.trail[0].why, "carries_encyclopedia_attribution");
});

test("mirrorOf: the 80% boundary, the sentence floor, and a page with only some shared sentences is NOT a mirror", () => {
  const mk = (shared, own) => [...WIKI_SENTENCES.slice(0, shared), ...own].join(" ");
  const own = ["The monument reopened to visitors after a long closure caused by the pandemic.", "Engineers repaint the structure every seven years to protect the iron."];
  assert.equal(mirrorOf(mk(5, []), WIKI_TEXT).mirror, true);
  assert.equal(mirrorOf(mk(4, own.slice(0, 1)), WIKI_TEXT).mirror, true, "4 of 5 = 80%");
  assert.equal(mirrorOf(mk(3, own), WIKI_TEXT).mirror, false, "3 of 5 = 60%");
  assert.equal(mirrorOf(WIKI_SENTENCES[2] + " " + own[0], WIKI_TEXT).mirror, false, "a page of two sentences is under the floor");
  assert.equal(mirrorOf(OFFICIAL, null).mirror, false);
});

// ─────────────── F2: mentions is not asserts ───────────────

for (const [name, sentence, why] of [
  ["a denial (the myth)", "A popular guidebook says the Eiffel Tower is 330 metres tall, but that is a myth.", /denies/],
  ["a hedge (some people say)", "Some people say the Eiffel Tower is 330 metres tall.", /hedges/],
  ["a question", "Is the Eiffel Tower 330 metres tall?", /asks_not_asserts/],
  ["the opposite polarity", "The Eiffel Tower is not 330 metres tall.", /polarity/],
  ["a debunking", "It has been debunked that the Eiffel Tower is 330 metres tall.", /denies/],
]) {
  test(`F2: a page whose sentence has every word of the claim but ${name} is rejected even when the model points at it`, async () => {
    const body = page("The Eiffel Tower attracts millions of visitors to Paris every year and has done since it opened.", sentence, PAD);
    const log = [];
    const r = await run({ search: searching([{ title: "t", url: "https://guide.example.org/eiffel" }]), readPage: reading({ "https://guide.example.org/eiffel": body }), point: pointer(sentence.slice(0, 20), log) });
    assert.equal(r.passages.length, 0, "no passage");
    assert.equal(r.trail[0].verdict, "unsupported");
    assert.match(r.trail[0].why, why);
    assert.ok(log.length >= 1, "the model was asked: the gate is the app's, not the model's");
  });
}

test("F8: a sentence with only SOME of the claim's content stems, or a different figure, is unsupported", async () => {
  for (const sentence of ["The Eiffel Tower is tall and iron.", "The Eiffel Tower is 300 metres tall.", "The Eiffel Tower rises 330 metres above the plaza."]) {
    const body = page("The monument stands on the Champ de Mars in the seventh arrondissement of Paris.", sentence, PAD);
    const r = await run({ search: searching([{ title: "t", url: "https://guide.example.org/e" }]), readPage: reading({ "https://guide.example.org/e": body }), point: pointer(sentence.slice(0, 22)) });
    assert.equal(r.passages.length, 0, sentence);
    assert.equal(r.trail[0].verdict, "unsupported", sentence);
  }
});

test("assertsClaim / assertionOf: the gate in isolation (a claim that itself denies matches a page that denies)", () => {
  assert.equal(assertsClaim(CLAIM, SENTENCE, { fw: FW }).ok, true);
  assert.equal(assertsClaim(CLAIM, "Some say the Eiffel Tower is 330 metres tall.", { fw: FW }).ok, false);
  assert.equal(assertsClaim("It is a myth that the Eiffel Tower is 330 metres tall.", "The idea that the Eiffel Tower is 330 metres tall is a myth.", { fw: FW }).ok, true);
  assert.equal(assertsClaim("It is a myth that the Eiffel Tower is 330 metres tall.", SENTENCE, { fw: FW }).ok, false);
  assert.deepEqual(assertionOf("The tower is tall."), { neg: false, deny: false, hedge: false, question: false });
  assert.equal(assertionOf("Isn't it tall?").question, true);
  assert.equal(assertsClaim("The Eiffel Tower is 330 metres tall according to Wikipedia.", SENTENCE, { fw: FW, indexHost: "en.wikipedia.org" }).ok, true, "the answer's own attribution is not something the primary must say");
  assert.equal(assertsClaim("On Wikipedia, the Eiffel Tower is 330 metres tall.", SENTENCE, { fw: FW, indexHost: "en.wikipedia.org" }).ok, true, "the encyclopedia's own name is not a stem the primary must carry");
  assert.equal(assertsClaim("On Wikipedia, the Eiffel Tower is 330 metres tall.", SENTENCE, { fw: FW }).ok, false, "without knowing the index host the name is a missing stem");
});

// ─────────────── F3: the model's reply is a claim to be checked ───────────────

for (const [name, reply] of [["a made-up number", "99"], ["NONE", "NONE"], ["prose", "I could not say, sorry"], ["a number with a fib attached", "99 — the page also says the Moon is cheese"]]) {
  test(`F3: ${name} from the model → no passage, typed unsupported, none of the model's words in the result`, async () => {
    const r = await run({ search: searching([{ title: "t", url: "https://toureiffel.paris/m" }]), readPage: reading({ "https://toureiffel.paris/m": page(OFFICIAL, PAD) }), point: async () => reply });
    assert.equal(r.passages.length, 0);
    assert.equal(r.pointers.length, 0);
    assert.equal(r.trail[0].verdict, "unsupported");
    assert.ok(["no_such_sentence", "none", "unparsed"].includes(r.trail[0].why), r.trail[0].why);
    assert.ok(!JSON.stringify(r).includes("cheese") && !JSON.stringify(r).includes("sorry"), "F11");
  });
}

test("F3: a real number that points at a sentence which does not say it is withdrawn and the model asked once more over the rest", async () => {
  const body = page("The monument is lit with twenty thousand light bulbs every night after sunset.", OFFICIAL, PAD);
  let n = 0;
  const point = async (messages) => {
    n++;
    const lines = String(messages[1].content).split("\n").filter((l) => /^\[\d+\]/.test(l));
    const idx = n === 1 ? lines.findIndex((l) => l.includes("light bulbs")) : lines.findIndex((l) => l.includes("330 metres"));
    return idx >= 0 ? /^\[(\d+)\]/.exec(lines[idx])[1] : "NONE";
  };
  const r = await run({ search: searching([{ title: "t", url: "https://toureiffel.paris/m" }]), readPage: reading({ "https://toureiffel.paris/m": body }), point });
  assert.equal(r.passages.length, 1);
  assert.equal(r.calls, 2);
});

// ─────────────── F4: unreadable is typed, never fatal ───────────────

test("F4: null, empty, too-short and throwing pages are typed 'unreadable' with a why, and the search carries on to the next page", async () => {
  const r = await run({
    limits: { maxPages: 5 },
    search: searching([
      { title: "a", url: "https://a.example.org/x" }, { title: "b", url: "https://b.example.org/x" }, { title: "c", url: "https://c.example.org/x" },
      { title: "d", url: "https://d.example.org/x" }, { title: "e", url: "https://toureiffel.paris/ok" },
    ]),
    readPage: reading({ "https://b.example.org/x": "", "https://c.example.org/x": "Please enable cookies.", "https://d.example.org/x": new Error("ECONNRESET"), "https://toureiffel.paris/ok": page(OFFICIAL, PAD) }),
    point: pointer("330 metres"),
  });
  const by = Object.fromEntries(r.trail.map((t) => [t.host, t]));
  assert.equal(by["a.example.org"].verdict, "unreadable"); assert.equal(by["a.example.org"].why, "empty");
  assert.equal(by["b.example.org"].why, "empty");
  assert.equal(by["c.example.org"].why, "too_short");
  assert.match(by["d.example.org"].why, /^read_failed:ECONNRESET/);
  assert.equal(by["toureiffel.paris"].verdict, "origin");
  assert.equal(r.passages.length, 1);
});

test("F4: a search that throws (not an abort) is a typed trail entry; the next query still runs; nothing rejects", async () => {
  let n = 0; const qs = [];
  const search = async (q) => { qs.push(q); n++; if (n === 1) throw new Error("HTTP 429"); return [{ title: "t", url: "https://toureiffel.paris/ok" }]; };
  const r = await run({ search, readPage: reading({ "https://toureiffel.paris/ok": page(OFFICIAL, PAD) }), point: pointer("330 metres") });
  assert.equal(r.trail[0].verdict, "unreadable"); assert.match(r.trail[0].why, /^search_failed:HTTP 429/); assert.equal(r.trail[0].url, null);
  assert.equal(r.passages.length, 1);
  const none = await run({ search: async () => [], readPage: reading({}), point: pointer("x") });
  assert.equal(none.passages.length, 0); assert.ok(none.trail.every((t) => t.verdict === "unreadable" && t.why === "no_results"));
  const junk = await run({ search: async () => null, readPage: reading({}), point: pointer("x") });
  assert.equal(junk.passages.length, 0);
});

test("F4: a model call that fails (not an abort) is a typed 'unsupported: call_failed', never fatal", async () => {
  const r = await run({ search: searching([{ title: "t", url: "https://toureiffel.paris/m" }]), readPage: reading({ "https://toureiffel.paris/m": page(OFFICIAL, PAD) }), point: async () => { throw new Error("ollama down"); } });
  assert.equal(r.passages.length, 0); assert.equal(r.trail[0].verdict, "unsupported"); assert.match(r.trail[0].why, /^call_failed:ollama down/);
});

// ─────────────── F5: abort propagates ───────────────

function abortErr(msg = "The operation was aborted") { const e = new Error(msg); e.name = "AbortError"; return e; }
test("F5: an AbortError from search, from readPage, from point and from the indexUrl read REJECTS findPrimary", async () => {
  const ok = { search: searching([{ title: "t", url: "https://toureiffel.paris/m" }]), readPage: reading({ "https://toureiffel.paris/m": page(OFFICIAL, PAD) }), point: pointer("330 metres") };
  await assert.rejects(run({ ...ok, search: async () => { throw abortErr(); } }), (e) => e.name === "AbortError");
  await assert.rejects(run({ ...ok, readPage: async () => { throw abortErr(); } }), (e) => e.name === "AbortError");
  await assert.rejects(run({ ...ok, point: async () => { throw abortErr(); } }), (e) => e.name === "AbortError");
  await assert.rejects(run({ ...ok, point: async () => { throw new Error("generation stopped by the user"); } }), /stopped/);
  await assert.rejects(run({ ...ok, indexText: null, indexUrl: WIKI_URL, readPage: async (u) => { if (u === WIKI_URL) throw abortErr(); return null; } }), (e) => e.name === "AbortError");
});

// ─────────────── F6: tertiary hosts ───────────────

test("F6: Wikipedia (any language), other encyclopedias, content farms, Q&A and social hosts are never returned and never read", async () => {
  const urls = ["https://en.wikipedia.org/wiki/Eiffel_Tower", "https://fr.wikipedia.org/wiki/Tour_Eiffel", "https://www.britannica.com/topic/Eiffel-Tower-Paris-landmark", "https://www.answers.com/Q/How_tall", "https://www.reference.com/world-view/tall", "https://www.quora.com/q", "https://www.reddit.com/r/paris", "https://www.facebook.com/eiffel"];
  const reads = [];
  const r = await run({ search: searching(urls.map((url) => ({ title: "t", url }))), readPage: reading({}, reads), point: pointer("330") });
  assert.deepEqual(reads, []); assert.equal(r.passages.length, 0);
  assert.equal(r.trail.length, urls.length);
  assert.ok(r.trail.every((t) => t.verdict === "tertiary"), JSON.stringify(r.trail));
});

test("readPage may return the chat's own { ok, text, title } shape: accepted; { ok:false } is a typed unreadable", async () => {
  const r = await run({ limits: { maxPages: 3 }, search: searching([{ title: "", url: "https://toureiffel.paris/m" }, { title: "x", url: "https://dead.example.org/m" }]),
    readPage: async (u) => (u.includes("dead") ? { ok: false, text: "", error: "turned away" } : { ok: true, text: page(OFFICIAL, PAD), title: "The monument", url: u }), point: pointer("330 metres") });
  assert.equal(r.passages.length, 1); assert.equal(r.passages[0].title, "The monument"); assert.match(r.passages[0].ref, /^toureiffel\.paris — The monument$/);
  assert.match(r.trail.find((t) => t.host === "dead.example.org").why, /^read_failed:turned away/);
});

test("dropReason: other wikis and -pedias, and the A3 corpus's forbidden hosts, are dropped", () => {
  for (const u of ["https://grokipedia.com/page/Eiffel_Tower", "https://wikitia.com/wiki/X", "https://en.wiktionary.org/wiki/tower", "https://www.wikispecies.org/x", "https://www.worldhistory.org/Eiffel_Tower/", "https://www.famousbirthdays.com/x", "https://citizendium.org/x", "https://kids.kiddle.co/x"]) assert.ok(dropReason(u), u);
  assert.equal(dropReason("https://www.nasa.gov/wiki-style-name"), null, "the path is not the host");
  assert.equal(dropReason("https://pedigree.example.org/x"), null);
});

test("dropReason / kindOf: the declared table, by host", () => {
  assert.equal(dropReason("https://en.wikipedia.org/wiki/X").verdict, "tertiary");
  assert.equal(dropReason("https://www.wikiwand.com/en/X").verdict, "mirror");
  assert.equal(dropReason("https://www.britannica.com/x").why, "encyclopedia");
  assert.equal(dropReason("https://www.nasa.gov/x"), null);
  assert.equal(dropReason("ftp://x.example/a").verdict, "unreadable");
  assert.equal(dropReason("not a url").why, "bad_url");
  assert.equal(dropReason("https://x.example/a", "x.example").why, "the_index_itself");
  assert.equal(kindOf("www.cdc.gov").id, "government"); assert.equal(kindOf("data.gov.uk").id, "government"); assert.equal(kindOf("mit.edu").id, "education"); assert.equal(kindOf("ox.ac.uk").id, "education");
  assert.equal(kindOf("reuters.com").id, "agency"); assert.equal(kindOf("who.int").id, "government"); assert.equal(kindOf("redcross.org").id, "organisation"); assert.equal(kindOf("randomblog.com").id, "other");
  assert.ok(kindOf("nasa.gov").rank > kindOf("redcross.org").rank && kindOf("redcross.org").rank > kindOf("randomblog.com").rank);
});

// ─────────────── F7 / F9 / F13: ranking, limits, same host ───────────────

test("F7: reading order is by declared host kind (government / education / agency before an unknown .com; a content farm never), ties in search order", async () => {
  const urls = ["https://www.randomblog.com/eiffel", "https://www.answers.com/eiffel", "https://www.cdc.gov/eiffel", "https://www.reuters.com/eiffel", "https://physics.mit.edu/eiffel", "https://another.com/eiffel"];
  const reads = [];
  const r = await run({ limits: { maxPages: 3, maxVerified: 5 }, search: searching(urls.map((url) => ({ title: "t", url }))), readPage: reading({}, reads), point: pointer("zz") });
  assert.deepEqual(reads, ["https://www.cdc.gov/eiffel", "https://physics.mit.edu/eiffel", "https://www.reuters.com/eiffel"]);
  assert.equal(r.trail.find((t) => t.host === "answers.com").verdict, "tertiary");
  assert.ok(!r.trail.some((t) => t.host === "randomblog.com" && t.verdict !== undefined && reads.includes(t.url)));
});

test("F9: at most maxPages pages are read and at most maxQueries searches made, however many results come back", async () => {
  const qs = [], reads = [];
  const many = Array.from({ length: 8 }, (_, i) => ({ title: "t", url: `https://site${i}.example.org/p` }));
  await run({ limits: { maxPages: 2, maxQueries: 2 }, search: searching(many, qs), readPage: reading({}, reads), point: pointer("zz") });
  assert.ok(qs.length <= 2, String(qs.length)); assert.equal(reads.length, 2);
  for (const k of [1, 2]) { const qk = []; await run({ limits: { maxQueries: k }, search: searching([], qk), readPage: reading({}), point: pointer("zz") }); assert.equal(qk.length, k, "every query runs when nothing is found, and no more than maxQueries"); }
  const qs3 = []; await run({ search: searching([], qs3), readPage: reading({}), point: pointer("zz") });
  assert.ok(qs3.length >= 1 && qs3.length <= PRIMARY.maxQueries);
  const reads3 = []; await run({ search: searching(many), readPage: reading({}, reads3), point: pointer("zz") });
  assert.equal(reads3.length, PRIMARY.maxPages);
});

test("F13: two verified pages on one host are one witness; a second host is a second one; maxVerified stops the reading", async () => {
  const good = page(OFFICIAL, PAD);
  const map = { "https://www.toureiffel.paris/a": good, "https://www.toureiffel.paris/b": good + " ", "https://www.paris.fr/c": good, "https://www.cdc.gov/d": good };
  const reads = [];
  const r = await run({ limits: { maxVerified: 5 }, search: searching(Object.keys(map).map((url) => ({ title: "t", url }))), readPage: reading(map, reads), point: pointer("330 metres") });
  assert.deepEqual(r.passages.map((p) => new URL(p.url).hostname.replace(/^www\./, "")).sort(), ["cdc.gov", "paris.fr", "toureiffel.paris"].sort().slice(0, 3));
  assert.equal(new Set(r.passages.map((p) => new URL(p.url).hostname)).size, r.passages.length);
  const two = await run({ search: searching(Object.keys(map).map((url) => ({ title: "t", url }))), readPage: reading(map), point: pointer("330 metres") });
  assert.equal(two.passages.length, PRIMARY.maxVerified);
});

test("an empty or incomplete call resolves to an empty result, not a throw", async () => {
  const r = await findPrimary({});
  assert.deepEqual(r.passages, []); assert.deepEqual(r.trail, []);
  const r2 = await findPrimary({ claim: CLAIM, search: async () => [], readPage: async () => null });
  assert.deepEqual(r2.passages, []);
});

test("indexUrl: the encyclopedia page is read once to recognise its copies by overlap", async () => {
  const copy = page(...WIKI_SENTENCES, "See also: Paris.");
  const reads = [];
  const r = await run({ indexText: null, indexUrl: WIKI_URL, search: searching([{ title: "t", url: "https://eiffelfacts.example/t" }]), readPage: reading({ [WIKI_URL]: WIKI_TEXT, "https://eiffelfacts.example/t": copy }, reads), point: pointer("330 metres") });
  assert.equal(r.trail[0].verdict, "mirror");
  assert.equal(reads[0], WIKI_URL);
});

// ─────────────── joining to provenance ───────────────

test("mergeProvenance: an index-tier provenance plus a found primary page → the app's origin line around the primary page's verbatim sentence; the narration verifies", async () => {
  const wiki = { ref: "en.wikipedia.org — Eiffel Tower", title: "Eiffel Tower", url: WIKI_URL, tertiary: true, text: WIKI_TEXT };
  const pr = await provenanceFor({ answer: CLAIM, passages: [wiki], fw: FW, point: pointer("330 metres") });
  assert.equal(pr.pointers[0].tier, "index");
  const found = await run({ search: searching([{ title: "The monument", url: "https://www.toureiffel.paris/m" }]), readPage: reading({ "https://www.toureiffel.paris/m": page(OFFICIAL, PAD) }), point: pointer("330 metres") });
  const m = mergeProvenance(pr, found, { indexHost: "en.wikipedia.org" });
  assert.match(m.narr.parts[0].text, /^I checked this on Wikipedia, but I treat that as an index to primary sources, so I followed it to toureiffel\.paris and verified it there\./);
  assert.equal(m.narr.parts[1].kind, "quote"); assert.match(m.narr.parts[1].text, /330 metres tall/);
  assert.ok(verifyNarration(m.narr, m.ps, m.pointers.filter((p) => p.tier === "origin"), { indexHost: "en.wikipedia.org" }).ok);
  assert.equal(m.ps[0].origin, true); assert.equal(m.ps[1].url, WIKI_URL);
  assert.equal(m.stored.verified, 1); assert.equal(m.stored.pointers[0].tier, "origin"); assert.equal(m.stored.pointers[1].tier, "index");
  assert.ok(m.stored.via.trail.some((t) => t.verdict === "origin"));
  assert.equal(m.calls, pr.calls + found.calls);
  // nothing found → provenance is returned unchanged
  const nothing = await run({ search: async () => [], readPage: reading({}), point: pointer("x") });
  assert.equal(mergeProvenance(pr, nothing, {}), pr);
});
