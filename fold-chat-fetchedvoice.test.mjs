// node --test fold-chat-fetchedvoice.test.mjs — C6, fetched voices (docs/VOICE.md stage 5). Every gate has a test that FAILS when the gate is removed (eval/ants/c6/mutate.mjs checks that).
import test from "node:test";
import assert from "node:assert/strict";
import * as FV from "./fold-chat-fetchedvoice.js";
import { buildIndex, resonance, quoteFromBank, asideOf } from "./fold-chat-voice.js";

const { classifyPage, fetchVoice, createFetchedBank, nameParts, authorMatches, extractMeta, gutenberg, featuresOf, sentenceBank, voicesFor, rankHits, sha256Hex } = FV;

// ---- fixtures -------------------------------------------------------------------------------------------------------------------------------------------------------
const OWN = "I have thought long about this, and I am convinced that we must act. My friends, our work is not finished, and I will not pretend that it is. We have seen what we can do together; I believe we shall do more. Let us go on, for I cannot stop and neither can you. I ask nothing of you that I do not ask of myself, and my own duty is plain to me. ".repeat(4);
const ABOUT = "Henry Maddox was born in a small town. He studied law and he married early. His career was long; his death came in 1901. Maddox became a senator and Maddox served two terms. His legacy endures, and Maddox is remembered. He wrote letters and he published essays. ".repeat(4);
const page = (title, body, head = "") => `<html><head><title>${title}</title>${head}</head><body><h1>${title}</h1><p>${body.replace(/\n/g, "</p><p>")}</p></body></html>`;
const P = "Henry Maddox";

// ---- names and authors ----------------------------------------------------------------------------------------------------------------------------------------------
test("nameParts drops suffixes and folds accents", () => {
  assert.deepEqual(nameParts("Martin Luther King Jr."), { given: ["martin", "luther"], surname: "king", full: "martin luther king" });
  assert.equal(nameParts("Søren Kierkegaard").surname, "soren".length ? "kierkegaard" : "");
  assert.equal(nameParts({ name: "Henry Maddox" }).surname, "maddox");
});
test("authorMatches needs the surname AND a given name or its initial; understands Last, First", () => {
  assert.equal(authorMatches("Henry Maddox", P), true);
  assert.equal(authorMatches("Maddox, Henry", P), true);
  assert.equal(authorMatches("H. Maddox", P), true);
  assert.equal(authorMatches("Maddox", P), false);            // a surname alone is not an author
  assert.equal(authorMatches("Paula Maddox", P), false);      // same surname, other person
  assert.equal(authorMatches("Marcus Aurelius, Emperor of Rome", "Marcus Aurelius"), true);
  assert.equal(authorMatches("Eric Blair", { name: "George Orwell", aliases: ["Eric Blair"] }), true);
  assert.equal(authorMatches("Eric Blair", "George Orwell"), false);
});

// ---- markup -------------------------------------------------------------------------------------------------------------------------------------------------------
test("extractMeta reads meta author, JSON-LD author and rel=author", () => {
  const m = extractMeta(`<title>T</title><meta name="author" content="Henry Maddox"><script type="application/ld+json">{"@type":"Article","author":{"name":"Ann Other"}}</script><a rel="author" href="/x">By Zed Zed</a><h1>Head</h1>`);
  assert.equal(m.title, "T"); assert.equal(m.h1, "Head");
  assert.deepEqual(m.authors.map((a) => a.value), ["Henry Maddox", "Ann Other", "Zed Zed"]);
});
test("gutenberg strips the licence and reads Author", () => {
  const g = gutenberg("The Project Gutenberg eBook of X\nTitle: X\nAuthor: Henry Maddox\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nBODY TEXT\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nlicence");
  assert.equal(g.author, "Henry Maddox"); assert.equal(g.body.trim(), "BODY TEXT");
  assert.equal(gutenberg("just a page"), null);
});

// ---- features -----------------------------------------------------------------------------------------------------------------------------------------------------
test("featuresOf: pronoun, surname, quote and attribution-line statistics", () => {
  const f = featuresOf(OWN, P); assert.ok(f.fp > 60 && f.tp === 0 && f.nm === 0);
  const g = featuresOf(ABOUT, P); assert.ok(g.tp > 20 && g.nm > 40 && g.bio > 5 && g.fp === 0);
  const q = featuresOf('“Be yourself; everyone else is already taken.”\n— Henry Maddox\n“Life is what you make it, always.”\n— Henry Maddox\n“We are what we repeatedly do, therefore.”\n— Henry Maddox', P);
  assert.ok(q.quoteShare > 0.5 && q.attrLines >= 3);
});

// ---- the verdict, gate by gate ------------------------------------------------------------------------------------------------------------------------------------
const run = (o) => classifyPage({ person: P, ...o });
test("own: a first-person page whose title names the person", () => {
  const r = run({ url: "https://archive.example.edu/x", html: page("Letter from Henry Maddox", OWN) });
  assert.equal(r.verdict, "own"); assert.equal(r.attribution.tier, "heading");
});
test("GATE host: a dropped host is refused before the text is read (farm, mirror, encyclopedia, tertiary)", () => {
  for (const u of ["https://www.wikipedia.org/wiki/X", "https://www.britannica.com/biography/X", "https://x.fandom.com/wiki/X", "https://www.ehow.com/x"]) {
    const r = run({ url: u, html: page("Letter from Henry Maddox", OWN) }); assert.equal(r.verdict, "refuse", u); assert.match(r.reasons[0], /^host:/);
  }
});
test("Wikisource (a primary-text archive) is NOT dropped as a 'wiki' mirror; Wikipedia, Wikiquote and fandom still are", () => {
  assert.equal(rankHits(P, [{ url: "https://en.wikisource.org/wiki/Letter" }, { url: "https://en.wikiquote.org/wiki/Henry_Maddox" }, { url: "https://en.wikipedia.org/wiki/Henry_Maddox" }]).map((r) => r.host).join(), "en.wikisource.org");
  assert.notEqual(run({ url: "https://en.wikisource.org/wiki/Letter", html: page("Letter from Henry Maddox", OWN) }).reasons[0]?.slice(0, 5), "host:");
});
test("GATE host: quote farms are refused", () => {
  const r = run({ url: "https://www.brainyquote.com/authors/x", html: page("Henry Maddox", OWN) });
  assert.equal(r.verdict, "refuse"); assert.equal(r.reasons[0], "host:quote_farm");
});
test("GATE title: hypothetical and listicle and secondary-genre titles are refused even on a clean host", () => {
  for (const t of ["What would Henry Maddox say about AI?", "50 best Henry Maddox quotes", "The Wisdom of Henry Maddox for Modern Life", "Quotes by Henry Maddox"]) {
    const r = run({ url: "https://blog.example.org/p", html: page(t, OWN) }); assert.equal(r.verdict, "refuse", t); assert.match(r.reasons[0], /^title:/);
  }
});
test("GATE author_is_other: a byline or author field naming ANOTHER person refuses (a book BY someone ABOUT them)", () => {
  const r = run({ url: "https://x.example.org/b", html: page("Letter from Henry Maddox", OWN, '<meta name="author" content="James Smith">') });
  assert.equal(r.verdict, "refuse"); assert.match(r.reasons[0], /^author_is_other:James Smith/);
  const g = run({ url: "https://www.gutenberg.org/x.txt", text: `The Project Gutenberg eBook of Life of Maddox\nAuthor: James Smith\n*** START OF THE PROJECT GUTENBERG EBOOK ***\n${OWN}\n*** END OF THE PROJECT GUTENBERG EBOOK ***` });
  assert.match(g.reasons[0], /^author_is_other:James Smith/);
});
test("an organisation author is not 'another person'", () => {
  const r = run({ url: "https://x.example.org/b", html: page("Letter from Henry Maddox", OWN, '<meta name="author" content="The Maddox Foundation">') });
  assert.equal(r.verdict, "own");
});
test("a line-anchored 'By <Name>' byline is evidence; a mid-sentence 'by <Name>' is not", () => {
  const a = run({ url: "https://x.example.org/b", text: "Notes\nBy Ann Other\n" + OWN });
  assert.match(a.reasons[0], /^author_is_other:Ann Other/);
  const b = run({ url: "https://x.example.org/b", text: "Letter from Henry Maddox\nThe garden was drawn by Walter Reed.\n" + OWN });
  assert.equal(b.verdict, "own");
});
test("a matching author field is strong attribution", () => {
  const r = run({ url: "https://x.example.org/b", html: page("An essay", OWN, '<meta name="author" content="Henry Maddox">') });
  assert.equal(r.verdict, "own"); assert.equal(r.attribution.tier, "strong");
});
test("GATE quote compilation: quotation share and attribution lines", () => {
  const share = ('“' + "I believe that we must act now and always together.".padEnd(60, "x") + '” ').repeat(20) + "We I my our me";
  const r = run({ url: "https://x.example.org/q", html: page("Letter from Henry Maddox", share) });
  assert.equal(r.verdict, "refuse"); assert.match(r.reasons[0], /^quote_farm:share/);
  const lines = run({ url: "https://x.example.org/q", text: "Letter from Henry Maddox\n" + OWN + "\n— Henry Maddox\n— Henry Maddox\n— Henry Maddox\n" });
  assert.match(lines.reasons[0], /^quote_farm:attribution_lines/);
});
test("GATE biography: bio cues with he/she > I/we", () => {
  const r = run({ url: "https://x.example.org/bio", html: page("Henry Maddox", ABOUT) });
  assert.equal(r.verdict, "refuse"); assert.equal(r.reasons[0], "biography");
});
test("GATE third_person_about: the surname recurs and he/she dominates, without the biography cues", () => {
  const t = "Maddox argues that people matter. He says that Maddox is right and he thinks Maddox knows. His view is that Maddox must lead. ".repeat(8);
  const r = run({ url: "https://x.example.org/t", html: page("Henry Maddox", t) });
  assert.equal(r.verdict, "refuse"); assert.equal(r.reasons[0], "third_person_about");
});
test("GATE no_attribution: first-person text with no sign it is theirs is refused", () => {
  const r = run({ url: "https://x.example.org/n", html: page("A letter", OWN) });
  assert.equal(r.verdict, "refuse"); assert.equal(r.reasons[0], "no_attribution");
});
test("cross-person: the same page under another person is refused (the name is the only link)", () => {
  assert.equal(run({ url: "https://x.example.org/b", html: page("Letter from Henry Maddox", OWN) }).verdict, "own");
  assert.equal(classifyPage({ person: "Zelda Fitz", url: "https://x.example.org/b", html: page("Letter from Henry Maddox", OWN) }).verdict, "refuse");
});
test("GATE voice: attributed but impersonal is UNSURE (not admitted); attributed by heading only and impersonal is refused", () => {
  const impersonal = "The universe is change. Nature loves to alter things and to make new ones like them. Everything is in a way the seed of what is to come. ".repeat(8);
  const a = run({ url: "https://x.example.org/b", html: page("Meditations", impersonal, '<meta name="author" content="Henry Maddox">') });
  assert.equal(a.verdict, "unsure"); assert.equal(a.reasons[0], "attributed_but_impersonal");
  const b = run({ url: "https://x.example.org/b", html: page("Henry Maddox", impersonal) });
  assert.equal(b.verdict, "refuse"); assert.match(b.reasons[0], /^no_first_person/);
});
test("genre_heading: surname plus a genre word in the title is attribution; surname alone is not", () => {
  const a = run({ url: "https://x.example.org/b", html: page("Maddox's Farewell Address", OWN) });
  assert.equal(a.verdict, "own"); assert.equal(a.attribution.tier, "genre_heading");
  const b = run({ url: "https://x.example.org/b", html: page("About Maddox", OWN) });
  assert.equal(b.verdict, "refuse");
});
test("host_is_person: the registrable label is the person's name", () => {
  const r = run({ url: "https://henrymaddox.com/essay", html: page("On starting", OWN) });
  assert.equal(r.verdict, "own"); assert.equal(r.attribution.tier, "host_is_person");
  const s = run({ url: "https://maddoxfan.com/essay", html: page("On starting", OWN) });
  assert.equal(s.verdict, "refuse");
});
test("GATE platform: a publishing platform needs an author field that names them, a heading is not enough", () => {
  assert.equal(run({ url: "https://henry.substack.com/p/x", html: page("Henry Maddox on things", OWN) }).reasons[0], "platform_unattributed");
  assert.equal(run({ url: "https://henry.substack.com/p/x", html: page("On things", OWN, '<meta name="author" content="Henry Maddox">') }).verdict, "own");
});
test("too short a page is refused", () => { assert.equal(run({ url: "https://x.example.org/s", text: "Henry Maddox: I am." }).reasons[0], "too_short"); });
test("arms: hosts_only accepts what the host table lets through (the baseline); features_only ignores the host tables", () => {
  const bio = page("Henry Maddox", ABOUT);
  assert.equal(run({ url: "https://x.example.org/bio", html: bio, arm: "hosts_only" }).verdict, "own");
  assert.equal(run({ url: "https://x.example.org/bio", html: bio }).verdict, "refuse");
  const fan = run({ url: "https://x.fandom.com/wiki/Maddox", html: page("Letter from Henry Maddox", OWN), arm: "features_only" });
  assert.equal(fan.verdict, "own");
});

// ---- fetch, entry, provenance --------------------------------------------------------------------------------------------------------------------------------------
const NOW = () => "2026-10-06T12:00:00.000Z";
const reader = (map) => async (u) => (map[u] ? { ok: true, via: "node", url: u, ...map[u] } : { ok: false, why: "status_404" });
test("fetchVoice: an accepted page yields an entry with host, url, fetchedAt, sha256 of exactly the stored text, licence and standing 'fetched'", async () => {
  const url = "https://archive.example.edu/x";
  const r = await fetchVoice({ person: P, url, read: reader({ [url]: { html: page("Letter from Henry Maddox", OWN) } }), now: NOW });
  assert.equal(r.verdict, "own"); const e = r.entry;
  assert.equal(e.grade, "fetched"); assert.equal(e.source.host, "archive.example.edu"); assert.equal(e.source.fetchedAt, NOW()); assert.equal(e.source.url, url);
  assert.equal(e.source.sha256, await sha256Hex(e.text)); assert.equal(e.source.chars, e.text.length);
  assert.match(e.source.license, /unverified/); assert.match(e.handle, /^fetched:henry-maddox:[0-9a-f]{8}$/);
  assert.equal(e.standing.tier, "fetched"); assert.equal(e.standing.attribution.tier, "heading");
});
test("fetchVoice: refused hosts are not even read; unreadable pages are typed", async () => {
  let reads = 0; const read = async () => { reads++; return { ok: true, html: "x" }; };
  const r = await fetchVoice({ person: P, url: "https://www.brainyquote.com/a", read, now: NOW });
  assert.equal(r.verdict, "refuse"); assert.equal(reads, 0); assert.equal(r.unread, true);
  const w = await fetchVoice({ person: P, url: "https://en.wikipedia.org/wiki/Henry_Maddox", read, now: NOW });
  assert.equal(w.verdict, "refuse"); assert.equal(w.unread, true); assert.equal(reads, 0);
  const u = await fetchVoice({ person: P, url: "https://nowhere.example.org/z", read: reader({}), now: NOW });
  assert.equal(u.verdict, "unreadable");
});
test("every banked sentence slices back verbatim from the stored text by its offsets", async () => {
  const body = "Letter from Henry Maddox\n" + "I have thought about the harbour for many years and I do not think that it can wait. We shall build the wall before the winter comes, and my own hands will lay the first stone. ".repeat(6);
  const url = "https://archive.example.edu/y";
  const r = await fetchVoice({ person: P, url, read: reader({ [url]: { text: body } }), now: NOW });
  assert.equal(r.verdict, "own"); assert.ok(r.entry.bank.length >= 2);
  for (const s of r.entry.bank) assert.equal(r.entry.text.slice(s.start, s.end), s.text);
});
test("sentenceBank keeps only quotable sentences (length, letters, sentence end)", () => {
  const b = sentenceBank("Too short.\nThis sentence is long enough to be quoted by the voice and ends properly here.\n12 34 56 78 90 12 34 56 78 90 12 34 56 78 90 12 34 56 78 90 12.\nA long sentence with no ending punctuation at all stays out of the bank because it is cut");
  assert.equal(b.length, 1); assert.match(b[0].text, /quoted by the voice/);
  assert.equal(sentenceBank("Table 1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234 5678 shows about results.").length, 0);   // a table row of figures is not a quotable sentence
});

// ---- the bank, and the existing voice core --------------------------------------------------------------------------------------------------------------------------
test("the session bank admits only accepted fetched entries; verify detects a changed page; spans re-verify", async () => {
  const url = "https://archive.example.edu/z";
  const r = await fetchVoice({ person: P, url, read: reader({ [url]: { html: page("Letter from Henry Maddox", OWN) } }), now: NOW });
  const bank = createFetchedBank();
  assert.equal(bank.admit({ ...r.entry, standing: { ...r.entry.standing, verdict: "unsure" } }), false);
  assert.equal(bank.admit({ ...r.entry, grade: "canon" }), false);
  assert.equal(bank.admit(r.entry), true); assert.equal(bank.size(), 1);
  assert.deepEqual((await bank.verify(r.entry.handle, r.entry.text)), { ok: true });
  assert.equal((await bank.verify(r.entry.handle, r.entry.text + "x")).why, "page_changed");
  const s = r.entry.bank[0]; assert.equal(bank.spanOk(r.entry.handle, s.start, s.end, s.text), true); assert.equal(bank.spanOk(r.entry.handle, s.start + 1, s.end, s.text), false);
});
test("INTEGRATION: a fetched voice goes through fold-chat-voice.js buildIndex / resonance / quoteFromBank and returns a verbatim quote with an address", async () => {
  const body = "Letter from Zebulon Quartermaine\n" + [
    "I have always held that the lighthouse keeper's patience is the only true navigation we possess in storms.",
    "My own harbour taught me that the lantern matters less than the vigil kept beside the lantern through the night.",
    "We cannot command the tide, but we can keep the lighthouse burning until the fishing boats come home.",
  ].join(" ").repeat(3);
  const url = "https://zebulon.example.org/essay";
  const r = await fetchVoice({ person: "Zebulon Quartermaine", url, read: reader({ [url]: { text: body } }), now: NOW });
  assert.equal(r.verdict, "own");
  const bank = createFetchedBank(); bank.admit(r.entry);
  const other = { handle: "canon:x", giver: "Someone Else", work: "W", source: { path: "p", sha256: "s", chars: 1 }, terms: ["market", "ledger", "tariff", "currency"] };
  const index = buildIndex([...bank.archons(), other], null);
  const conv = new Map([["lighthouse", 2], ["lantern", 2], ["harbour", 2], ["patienc", 1]]); conv.surface = new Map();
  const ranked = resonance(index, conv, { draws: 50 });
  assert.equal(ranked[0].handle, r.entry.handle);
  const q = quoteFromBank(bank.bank()[r.entry.handle], ranked[0].shared);
  assert.ok(q && r.entry.text.slice(q.start, q.end) === q.text);
});

// ---- search → pages → entries --------------------------------------------------------------------------------------------------------------------------------------
test("rankHits drops dropped hosts, ranks archives first, then a host named for the person", () => {
  const rows = rankHits(P, [
    { url: "https://www.brainyquote.com/a" }, { url: "https://en.wikipedia.org/wiki/H" }, { url: "https://example.com/p" },
    { url: "https://www.gutenberg.org/ebooks/1" }, { url: "https://henrymaddox.com/e" }, { url: "https://www.gutenberg.org/ebooks/1" },
  ]);
  assert.deepEqual(rows.map((r) => r.host), ["www.gutenberg.org".replace("www.", ""), "henrymaddox.com", "example.com"]);
});
test("voicesFor: search → rank → read at most maxPages → classify; the trail names every page and why", async () => {
  const pages = {
    "https://henrymaddox.com/e": { html: page("On harbours", OWN) },
    "https://example.com/p": { html: page("Henry Maddox", ABOUT) },
  };
  const hits = [{ url: "https://www.brainyquote.com/a" }, { url: "https://example.com/p" }, { url: "https://henrymaddox.com/e" }];
  const res = await voicesFor({ person: P, search: async () => hits, read: reader(pages), now: NOW });
  assert.equal(res.entries.length, 1); assert.equal(res.entries[0].source.host, "henrymaddox.com");
  const by = Object.fromEntries(res.trail.filter((t) => t.url).map((t) => [t.url, t]));
  assert.equal(by["https://www.brainyquote.com/a"].verdict, "refuse");
  assert.equal(by["https://example.com/p"].reasons[0], "biography");
  assert.equal(by["https://henrymaddox.com/e"].verdict, "own");
  let reads = 0; const r2 = await voicesFor({ person: P, search: async () => hits, read: async (u) => { reads++; return reader(pages)(u); }, now: NOW, limits: { maxPages: 1 } });
  assert.equal(reads, 1); assert.equal(r2.entries.length, 1);
});
test("an AbortError from the reader rejects (never a trail entry)", async () => {
  const e = Object.assign(new Error("aborted"), { name: "AbortError" });
  await assert.rejects(fetchVoice({ person: P, url: "https://x.example.org/a", read: async () => { throw e; }, now: NOW }), /aborted/);
});
