import { test } from "node:test";
import assert from "node:assert/strict";
import { search, readText, searchWeb, SCOPES, queriesFor, onTopic, EFFORT, EFFORT_LEVELS, normEffort, effortOfTurn, resolveEffort } from "./fold-chat-web.js";

const resp = (body, { ok = true, status = 200 } = {}) => ({
  ok, status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

function router(map) {
  return async (url) => {
    for (const [re, r] of map) if (re.test(url)) return typeof r === "function" ? r(url) : r;
    throw new Error("no route: " + url);
  };
}

test("every declared scope runs one search and keeps the holodeck result shape", async () => {
  assert.ok(SCOPES.length >= 4);
  const f = router([
    [/holodeck-proxy\.prometheoid\.workers\.dev\/search/, resp({ scope: "web", engine: "DuckDuckGo", count: 2, results: [{ title: "Judy Liff", url: "https://whitepages.com/name/Judy-Liff", snippet: "Nashville TN", source: "whitepages.com" }, { title: "Zachary Liff", url: "https://elementix.com/investors/tn/zachary-liff", snippet: "Real Estate Investor", source: "elementix.com" }] })],
    [/api\.github\.com/, resp({ total_count: 3, items: [{ full_name: "a/b", html_url: "https://github.com/a/b", description: "x", stargazers_count: 4200, language: "JS", pushed_at: "2024-01-01" }] })],
    [/en\.wikipedia\.org/, resp({ query: { search: [{ title: "Fold", snippet: "<b>fold</b> here", wordcount: 900 }] }, continue: { sroffset: 20 } })],
    [/archive\.org/, resp({ response: { numFound: 5, docs: [{ identifier: "id1", title: ["A Book"], description: "desc", mediatype: "texts", year: "1900" }] } })],
    [/openalex\.org/, resp({ meta: { count: 4 }, results: [{ title: "Paper", publication_year: 2020, cited_by_count: 7, doi: "https://doi.org/10.1/x", abstract_inverted_index: { a: [0], thing: [1] }, primary_location: { source: { display_name: "J" } } }] })],
    [/crossref\.org/, resp({ message: { "total-results": 9, items: [{ title: ["CR"], DOI: "10.2/y", "is-referenced-by-count": 2, "container-title": ["K"], issued: { "date-parts": [[2019]] } }] } })],
  ]);
  for (const s of SCOPES) {
    const out = await search(s.id, "the fold", 0, { fetchImpl: f });
    assert.ok(Array.isArray(out.results), s.id + " results array");
    assert.equal(typeof out.engine, "string");
    assert.equal(typeof out.more, "boolean");
    for (const r of out.results) for (const k of ["title", "url", "snippet", "source", "meta", "kind"]) assert.ok(k in r, s.id + " has " + k);
  }
});

test("readText: a site that answers directly is marked via=direct, never a proxy", async () => {
  const f = router([[/^https:\/\/example\.com/, resp("<html><head><title>Ex</title></head><body><p>" + "word ".repeat(30) + "</p></body></html>")]]);
  const rd = await readText("https://example.com/p", { fetchImpl: f });
  assert.equal(rd.ok, true);
  assert.equal(rd.via, "direct");
  assert.equal(rd.title, "Ex");
  assert.ok(rd.text.length > 40);
});

test("readText: a refused direct read does not claim direct — it names the third party that fetched", async () => {
  let hit = 0;
  const f = async (url) => {
    hit++;
    if (/^https:\/\/blocked\.example/.test(url)) return resp("", { ok: false, status: 403 });
    if (/allorigins/.test(url)) return resp("<title>Via proxy</title><p>" + "text ".repeat(30) + "</p>");
    throw new Error("unexpected " + url);
  };
  const rd = await readText("https://blocked.example/a", { fetchImpl: f });
  assert.equal(rd.ok, true);
  assert.notEqual(rd.via, "direct");
  assert.match(rd.via, /proxy|reader/);
  // FALSIFIER: if direct had been silently reported, via would be "direct".
  assert.ok(hit >= 2, "direct was attempted before the proxy");
});

test("readText: a page only a text reader can read is marked as the reader", async () => {
  const f = async (url) => {
    if (/^https:\/\/spa\.example/.test(url)) return resp("", { ok: false, status: 403 });
    if (/allorigins|codetabs|corsproxy|cors\.eu|thingproxy/.test(url)) throw new Error("proxy down");
    if (/r\.jina\.ai/.test(url)) return resp("Title: X\n\nMarkdown Content:\n" + "deep text ".repeat(40));
    throw new Error("unexpected " + url);
  };
  const rd = await readText("https://spa.example/x", { fetchImpl: f });
  assert.equal(rd.ok, true);
  assert.match(rd.via, /reader/);
});

test("searchWeb merges scopes, reads the top hits into passages, and traces every step", async () => {
  const f = async (url) => {
    if (/en\.wikipedia\.org\/w\/api/.test(url)) return resp({ query: { search: [{ title: "Fold", snippet: "s", wordcount: 1 }] } });
    if (/api\.github\.com/.test(url)) return resp({ total_count: 1, items: [{ full_name: "a/b", html_url: "https://github.com/a/b", description: "the fold, a small library", stargazers_count: 1 }] });
    if (/archive\.org/.test(url)) return resp({ response: { numFound: 0, docs: [] } });
    if (/openalex\.org/.test(url)) return resp({ meta: { count: 0 }, results: [] });
    if (/crossref\.org/.test(url)) return resp({ message: { "total-results": 0, items: [] } });
    if (/holodeck-proxy.*\/search/.test(url)) return resp({ engine: "DuckDuckGo", results: [{ title: "The fold", url: "https://example.org/fold", snippet: "the fold", source: "example.org" }] });
    // page reads
    if (/wikipedia\.org\/wiki|github\.com\/a\/b|example\.org\/fold/.test(url)) return resp("<title>T</title><p>" + "body ".repeat(50) + "</p>");
    throw new Error("no route " + url);
  };
  const out = await searchWeb("the fold", { fetchImpl: f, read: 2 });
  assert.ok(out.results.length >= 1);
  assert.ok(out.passages.length >= 1, "top hits read into passages");
  assert.ok(out.passages[0].text.length > 40);
  assert.ok(out.passages[0].via, "passage names who fetched it");
  assert.ok(out.trace.some((t) => t.engine), "trace names the engines");
  assert.ok(out.trace.some((t) => t.read), "trace names the reads");
});

test("queriesFor splits a comparison into per-entity queries", () => {
  const qs = queriesFor("Compare the founding dates and first leaders of Canberra, Brasília, Ottawa, and Washington, D.C.");
  assert.ok(qs.includes("Canberra"), "Canberra is its own query");
  assert.ok(qs.includes("Brasília") || qs.includes("Brasília,") || qs.some((q) => /Bras/.test(q)), "Brasília is its own query");
  assert.ok(qs.some((q) => /Ottawa/.test(q)));
  assert.ok(qs.some((q) => /Washington/.test(q)));
  assert.ok(!qs.includes("Compare the founding dates and first leaders of Canberra, Brasília, Ottawa, and Washington, D.C."), "not the whole question");
});

test("effort levers: fast reads fewer sources, deep reads more and strict-gates", async () => {
  const f = async (url) => {
    if (/holodeck-proxy.*\/search/.test(url)) return resp({ scope: "web", engine: "DDG", count: 2, results: [{ title: "Judy Liff Zachary Liff", url: "https://whitepages.com/judy-liff", snippet: "Judy Liff Nashville", source: "whitepages.com" }, { title: "Wrong Judy film", url: "https://en.wikipedia.org/wiki/Judy_(film)", snippet: "a film", source: "en.wikipedia.org" }] });
    if (/en\.wikipedia\.org/.test(url)) return resp({ query: { search: [{ title: "Judy", snippet: "s", wordcount: 1 }] } });
    if (/whitepages\.com/.test(url)) return resp("<title>Judy Liff</title><p>" + "Judy Liff Nashville associate of Zachary Liff ".repeat(20) + "</p>");
    if (/en\.wikipedia\.org\/wiki|whitepages/.test(url)) return resp("<title>T</title><p>" + "body ".repeat(50) + "</p>");
    throw new Error("no route " + url);
  };
  const fast = await searchWeb("find the relationship between Judy and Zachary Liff from Nashville", { fetchImpl: f, effort: "fast" });
  assert.ok(fast.passages.length >= 1, "fast still reads");
  const deep = await searchWeb("find the relationship between Judy and Zachary Liff from Nashville", { fetchImpl: f, effort: "deep" });
  assert.ok(deep.passages.every((p) => /whitepages/.test(p.ref)), "deep strict gate reads only the people record, skips the film");
});

test("effort levels: the menu lists exactly the levers searchWeb knows", () => {
  assert.deepEqual(EFFORT_LEVELS.map((l) => l.key), Object.keys(EFFORT));
  assert.equal(normEffort("deep"), "deep");
  assert.equal(normEffort("bogus"), "balanced");
  assert.equal(normEffort("toString"), "balanced", "inherited keys are not levels");
  assert.equal(normEffort(undefined, null), null);
});

test("effortOfTurn reads the turn's own record, from either side of the pair", () => {
  const msgs = [
    { role: "user", content: "a", effort: "fast" },
    { role: "assistant", content: "A", grounding: { effort: "fast" } },
    { role: "user", content: "b" },                                  // legacy: no effort field
    { role: "assistant", content: "B", grounding: { effort: "deep" } },
    { role: "user", content: "hi" },                                 // greeting: no record
    { role: "assistant", content: "hello", grounding: null },
  ];
  assert.equal(effortOfTurn(msgs, 0), "fast");
  assert.equal(effortOfTurn(msgs, 1), "fast");
  assert.equal(effortOfTurn(msgs, 2), "deep", "a legacy ask takes the effort its answer recorded");
  assert.equal(effortOfTurn(msgs, 3), "deep");
  assert.equal(effortOfTurn(msgs, 4), null);
  assert.equal(effortOfTurn(msgs, 5), null);
  assert.equal(effortOfTurn(msgs, 99), null);
  assert.equal(effortOfTurn(null, 0), null);
});

test("resolveEffort: a re-run keeps the original turn's effort unless the control was moved", () => {
  assert.equal(resolveEffort({ original: "fast", composer: "deep", changed: false }), "fast");
  assert.equal(resolveEffort({ original: "fast", composer: "deep", changed: true }), "deep");
  assert.equal(resolveEffort({ original: null, composer: "deep" }), "deep", "a fresh send takes the composer");
  assert.equal(resolveEffort({ original: "nonsense", composer: "fast" }), "fast");
  assert.equal(resolveEffort({}), "balanced");
});
