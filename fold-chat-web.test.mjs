import { test } from "node:test";
import assert from "node:assert/strict";
import { search, readText, searchWeb, SCOPES } from "./fold-chat-web.js";

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
    if (/en\.wikipedia\.org/.test(url)) return resp({ query: { search: [{ title: "Fold", snippet: "s", wordcount: 1 }] } });
    if (/api\.github\.com/.test(url)) return resp({ total_count: 1, items: [{ full_name: "a/b", html_url: "https://github.com/a/b", description: "d", stargazers_count: 1 }] });
    if (/archive\.org/.test(url)) return resp({ response: { numFound: 0, docs: [] } });
    if (/openalex\.org/.test(url)) return resp({ meta: { count: 0 }, results: [] });
    if (/crossref\.org/.test(url)) return resp({ message: { "total-results": 0, items: [] } });
    // page reads
    if (/wikipedia\.org\/wiki|github\.com\/a\/b/.test(url)) return resp("<title>T</title><p>" + "body ".repeat(50) + "</p>");
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
