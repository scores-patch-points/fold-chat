import { test } from "node:test";
import assert from "node:assert/strict";
import { routeSources, probeSources, noteRateLimited, coolingDown, resetCooldowns, COOLDOWN_MS, isRateLimitError } from "./fold-chat-route.js";
import { searchWeb } from "./fold-chat-web.js";

const resp = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

test("a recipe question runs the open web only", () => {
  assert.deepEqual(routeSources("whats a good pancake recipe?").scopes, ["web"]);
});

test("each kind of ask pulls in the source that fits it", () => {
  assert.ok(routeSources("is there an open source library for parsing PDFs in python").scopes.includes("github"));
  assert.ok(routeSources("what does the research say about the effect of creatine on memory").scopes.includes("openalex"));
  assert.ok(routeSources("out of print books about 1850s whaling").scopes.includes("archive"));
  assert.ok(routeSources("who was Ada Lovelace").scopes.includes("wikipedia"));
});

test("web is always on, and the router says why each source runs", () => {
  const r = routeSources("who was Ada Lovelace");
  assert.equal(r.scopes[0], "web");
  assert.ok(r.why.wikipedia);
  assert.ok(r.rest.includes("github"));
});

test("the probe: web hits that are journals pull in the paper sources, one stray link does not", () => {
  const hit = (u) => ({ url: u });
  assert.deepEqual(probeSources([hit("https://pubmed.ncbi.nlm.nih.gov/1"), hit("https://www.nature.com/a"), hit("https://x.com")], ["web"]).add.sort(), ["crossref", "openalex"]);
  assert.deepEqual(probeSources([hit("https://github.com/a/b")], ["web"]).add, []);
  assert.deepEqual(probeSources([hit("https://github.com/a/b"), hit("https://github.com/c/d")], ["web", "github"]).add, [], "already chosen");
});

test("a 429 puts the source on cooldown, and it clears", () => {
  resetCooldowns();
  assert.equal(isRateLimitError(new Error("OpenAlex answered 429.")), true);
  noteRateLimited("openalex", 1000);
  assert.equal(coolingDown("openalex", 1000 + COOLDOWN_MS - 1), true);
  assert.equal(coolingDown("openalex", 1000 + COOLDOWN_MS), false);
});

function net(log, { web = [], wiki = [] } = {}) {
  return async (url) => {
    log.push(url);
    if (/holodeck-proxy.*\/search/.test(url)) return resp({ engine: "DDG", results: web });
    if (/en\.wikipedia\.org\/w\/api/.test(url)) return resp({ query: { search: wiki } });
    if (/api\.github\.com/.test(url)) return resp({ total_count: 0, items: [] });
    if (/archive\.org\/advancedsearch/.test(url)) return resp({ response: { numFound: 0, docs: [] } });
    if (/openalex/.test(url)) return resp({ meta: { count: 0 }, results: [] });
    if (/crossref/.test(url)) return resp({ message: { "total-results": 0, items: [] } });
    return resp("<title>T</title><p>" + "pancake batter flour milk egg ".repeat(20) + "</p>");
  };
}
const hits = (log) => ({ api: log.filter((u) => /wikipedia\.org\/w\/api|github|advancedsearch|openalex|crossref/.test(u)).length, web: log.filter((u) => /holodeck-proxy.*search/.test(u)).length });

test("searchWeb: a recipe question makes ONE search call, not six", async () => {
  const log = [];
  const web = [{ title: "Fluffy pancakes", url: "https://www.allrecipes.com/pancakes", snippet: "flour milk egg", source: "allrecipes.com" }];
  const out = await searchWeb("whats a good pancake recipe?", { fetchImpl: net(log, { web }) });
  assert.deepEqual(hits(log), { api: 0, web: 1 });
  const route = out.trace.find((t) => t.scope === "route");
  assert.deepEqual(route.picked, ["web"]);
  assert.ok(route.skipped.includes("openalex"));
  assert.ok(out.passages.length >= 1, "still reads the recipe page");
});

test("searchWeb: web down + a recipe ask → no specialist guesses, the turn reads nothing rather than the wrong thing", async () => {
  const log = [];
  const out = await searchWeb("whats a good pancake recipe?", { fetchImpl: net(log, { web: [] }) });
  assert.equal(hits(log).api, 0, "no Wikipedia/GitHub/papers guessing");
  assert.equal(out.trace.find((t) => t.scope === "route").webDown, true);
  assert.equal(out.passages.length, 0);
});

test("searchWeb: web down + an encyclopedic ask still tries Wikipedia", async () => {
  const log = [];
  const out = await searchWeb("who was Ada Lovelace", { fetchImpl: net(log, { web: [], wiki: [{ title: "Ada Lovelace", snippet: "s", wordcount: 1 }] }) });
  assert.deepEqual(out.trace.find((t) => t.scope === "route").picked, ["web", "wikipedia"]);
});

test("searchWeb: web hits from journals widen the search to the paper sources", async () => {
  const log = [];
  const web = [{ title: "a", url: "https://pubmed.ncbi.nlm.nih.gov/1", snippet: "", source: "p" }, { title: "b", url: "https://www.nature.com/b", snippet: "", source: "n" }];
  const out = await searchWeb("does intermittent fasting help", { fetchImpl: net(log, { web }) });
  const route = out.trace.find((t) => t.scope === "route");
  assert.ok(route.picked.includes("openalex") && route.picked.includes("crossref"));
  assert.ok(!route.picked.includes("github"));
});

test("searchWeb: a rate-limited source is skipped on the next turn", async () => {
  resetCooldowns();
  const f = async (url) => (/openalex/.test(url) ? resp({}, { ok: false, status: 429 }) : net([], { web: [{ title: "a", url: "https://x.org/a", snippet: "", source: "x" }] })(url));
  const q = "what does the research say about the effect of sleep on memory";
  const first = await searchWeb(q, { fetchImpl: f });
  assert.ok(first.trace.some((t) => t.scope === "openalex" && /429/.test(t.why)));
  const second = await searchWeb(q, { fetchImpl: f });
  assert.ok(second.trace.some((t) => t.scope === "openalex" && /cooling down/.test(t.why)));
  resetCooldowns();
});

test("searchWeb: route:false is the old behaviour, every source", async () => {
  const log = [];
  await searchWeb("whats a good pancake recipe?", { fetchImpl: net(log, { web: [{ title: "a", url: "https://x.org/a", snippet: "", source: "x" }] }), route: false });
  assert.equal(hits(log).api, 5);
});

test("searchWeb: a 502 from the relay is retried once before the router gives up on the web", async () => {
  let n = 0;
  const f = async (url) => {
    if (/holodeck-proxy.*\/search/.test(url)) { n++; return n === 1 ? resp({}, { ok: false, status: 502 }) : resp({ engine: "DDG", results: [{ title: "Fluffy pancakes", url: "https://www.allrecipes.com/p", snippet: "", source: "allrecipes.com" }] }); }
    return resp("<title>T</title><p>" + "pancake batter flour milk egg ".repeat(20) + "</p>");
  };
  const out = await searchWeb("whats a good pancake recipe?", { fetchImpl: f });
  assert.equal(n, 2);
  assert.deepEqual(out.trace.find((t) => t.scope === "route").picked, ["web"]);
});

// ── speed: the librarian does not wait on what cannot help, nor read twice ──────────────────────
import { readText, makeMemo, GATEWAY_BUDGET_MS } from "./fold-chat-web.js";

test("speed: every source is asked at once — a slow web search does not hold the fast ones behind it", async () => {
  const started = [];
  const f = async (url) => {
    started.push(/holodeck-proxy.*search/.test(url) ? "web" : /wikipedia\.org\/w\/api/.test(url) ? "wikipedia" : "other");
    if (/holodeck-proxy.*search/.test(url)) return new Promise((r) => setTimeout(() => r(resp({ engine: "DDG", results: [] })), 400));
    if (/wikipedia\.org\/w\/api/.test(url)) return resp({ query: { search: [] } });
    return resp("");
  };
  await searchWeb("who was Ada Lovelace", { fetchImpl: f, webBudgetMs: 5000 });
  assert.ok(started.indexOf("wikipedia") !== -1 && started.indexOf("wikipedia") < started.length, "wikipedia was asked");
  assert.equal(started[0], "web");
  assert.equal(started[1], "wikipedia", "wikipedia started without waiting for the 400 ms web call");
});

test("speed: a web search that blows its budget is left behind, said so, and its late answer is not used", async () => {
  const f = async (url) => {
    if (/holodeck-proxy.*search/.test(url)) return new Promise((r) => setTimeout(() => r(resp({ engine: "DDG", results: [{ title: "Late", url: "https://late.test/a", snippet: "x".repeat(60), source: "late.test" }] })), 300));
    if (/wikipedia\.org\/w\/api/.test(url)) return resp({ query: { search: [{ title: "Ada Lovelace", snippet: "s", wordcount: 1 }] } });
    return resp("<title>T</title><p>" + "Ada Lovelace wrote the first program for the Analytical Engine. ".repeat(20) + "</p>");
  };
  const t0 = Date.now();
  const out = await searchWeb("who was Ada Lovelace", { fetchImpl: f, webBudgetMs: 60 });
  assert.ok(out.trace.some((t) => t.scope === "web" && /went on without the web/.test(t.why || "")));
  assert.ok(!out.results.some((r) => r.url === "https://late.test/a"), "the late web answer is not mixed in");
  assert.ok(out.results.some((r) => /Ada_Lovelace/.test(r.url)), "the fast source stands");
  await new Promise((r) => setTimeout(r, 350));          // let the late call finish; it must not mutate the finished turn
  assert.ok(!out.results.some((r) => r.url === "https://late.test/a"));
  assert.ok(Date.now() - t0 < 5000);
});

test("speed: Wikipedia is read through its plain-text extract, not by parsing the page", async () => {
  const calls = [];
  const f = async (url) => { calls.push(url); return /prop=extracts/.test(url) ? resp({ query: { pages: { 1: { title: "Eiffel Tower", extract: "The Eiffel Tower is a lattice tower in Paris. ".repeat(20) } } } }) : resp("<p>nope</p>"); };
  const rd = await readText("https://en.wikipedia.org/wiki/Eiffel_Tower", { fetchImpl: f });
  assert.equal(rd.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /prop=extracts/);
  assert.match(rd.title, /Eiffel Tower/);
});

test("speed: a page read once in this tab is not fetched again; a host that turned us away on every door is not retried", async () => {
  const memo = makeMemo();
  let n = 0;
  const f = async () => { n++; return resp("<title>T</title><p>" + "a page worth reading about pancakes ".repeat(20) + "</p>"); };
  await readText("https://x.test/p", { fetchImpl: f, memo });
  const again = await readText("https://x.test/p", { fetchImpl: f, memo });
  assert.equal(n, 1);
  assert.equal(again.cached, true);
  let tries = 0;
  const dead = async () => { tries++; return resp({}, { ok: false, status: 403 }); };
  const first = await readText("https://blocked.test/a", { fetchImpl: dead, memo, timeoutMs: 200 });
  assert.equal(first.ok, false);
  const t1 = tries;
  const second = await readText("https://blocked.test/b", { fetchImpl: dead, memo, timeoutMs: 200 });
  assert.equal(second.ok, false);
  assert.equal(tries, t1, "no door was tried a second time");
});

test("speed: when nothing else answered, a slow web search is WAITED for, not abandoned", async () => {
  const f = async (url) => {
    if (/holodeck-proxy.*search/.test(url)) return new Promise((r) => setTimeout(() => r(resp({ engine: "DDG", results: [{ title: "Sourdough starter guide", url: "https://good.test/s", snippet: "ferment ".repeat(10), source: "good.test" }] })), 250));
    return resp("<title>T</title><p>" + "A sourdough starter takes about seven days to ferment fully. ".repeat(20) + "</p>");
  };
  const out = await searchWeb("how long does a sourdough starter take to ferment", { fetchImpl: f, webBudgetMs: 40 });
  assert.ok(out.results.some((r) => r.url === "https://good.test/s"), "the slow web answer was used");
  assert.ok(out.passages.length >= 1);
});

test("speed: the proxy and reader gateways have a budget far under the old 8 s", () => {
  assert.ok(GATEWAY_BUDGET_MS <= 4000);
});
