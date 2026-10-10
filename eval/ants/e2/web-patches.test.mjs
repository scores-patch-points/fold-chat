// eval/ants/e2/web-patches.test.mjs — PROPOSED tests for diffs 4 (direct read cap) and 5 (read grace). Imports "./fold-chat-web.js": run where the patched file sits (repo root after the diffs; or the scratch
// dir E2-RESULTS.md describes). Mutation check: against the tracked file both timing tests FAIL.
import test from "node:test";
import assert from "node:assert/strict";
import * as W from "./fold-chat-web.js";
const { readText, searchWeb } = W;
const resp = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), body: null });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = (t) => "<title>" + t + "</title><p>" + (t + " has a long paragraph of plain prose about the tower and its height in metres. ").repeat(8) + "</p>";

test("E2 diff 4: a CORS-closed host (its direct answer only arrives to be refused, seconds later) costs the direct budget, not its whole failure time, before the relay is asked", async () => {
  const log = [];
  const f = async (url, o = {}) => {
    log.push(url);
    if (/holodeck-proxy.*\/raw/.test(url)) { await wait(60); return resp(page("closed")); }                // the relay
    // the browser's own fetch of the closed host: it "answers" 4 s later with a network error (CORS), or earlier if aborted
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new TypeError("Failed to fetch")), 4000); o.signal?.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); }, { once: true }); });
  };
  const t0 = Date.now();
  const rd = await readText("https://closed.example/a", { fetchImpl: f });
  const ms = Date.now() - t0;
  assert.equal(rd.ok, true);
  assert.equal(rd.via, "the fold's relay");
  assert.ok(ms < 2800, `took ${ms} ms; the direct attempt must be cut at its budget (<= ~1.5 s) before the relay`);
});

test("E2 diff 4: a host that answers directly inside the budget is still read directly, and the relay is never asked", async () => {
  const log = [];
  const f = async (url) => { log.push(url); if (/holodeck/.test(url)) throw new Error("the relay must not be asked"); await wait(30); return resp(page("open")); };
  const rd = await readText("https://open.example/a", { fetchImpl: f });
  assert.equal(rd.ok, true); assert.equal(rd.via, "direct");
  assert.equal(log.length, 1);
});

test("E2 diff 5: once enough pages are read, a straggler does not hold the turn past the grace; the pages kept are the ones that answered", async () => {
  const urls = ["https://a.example/p", "https://b.example/p", "https://c.example/p"];
  const f = async (url, o = {}) => {
    if (/holodeck-proxy.*\/search/.test(url)) return resp({ engine: "DuckDuckGo", results: urls.map((u, i) => ({ title: "Eiffel Tower page " + i, url: u, snippet: "Eiffel Tower", source: new URL(u).host })) });
    if (/holodeck-proxy.*\/raw/.test(url)) throw new Error("no relay in this test");
    if (url === urls[2]) { await wait(7000); return resp(page("late")); }                                  // the straggler
    await wait(80); return resp(page("fast " + url));
  };
  const t0 = Date.now();
  const out = await searchWeb("Eiffel Tower height", { fetchImpl: f, effort: "fast", route: false });
  const ms = Date.now() - t0;
  assert.equal(out.passages.length, 2, "fast reads two pages");
  assert.deepEqual(out.passages.map((p) => p.url).sort(), [urls[0], urls[1]]);
  assert.ok(ms < 4500, `took ${ms} ms; a straggler may add at most the grace (1.5 s), not its own 7 s`);
});

test("E2 diff 5: a slow page ranked ABOVE the last kept one is still waited for, for the grace — so a merely-slow top page is not lost when it lands in time", async () => {
  const urls = ["https://a.example/p", "https://b.example/p", "https://c.example/p"];
  const f = async (url) => {
    if (/holodeck-proxy.*\/search/.test(url)) return resp({ engine: "DuckDuckGo", results: urls.map((u, i) => ({ title: "Eiffel Tower page " + i, url: u, snippet: "Eiffel Tower", source: new URL(u).host })) });
    if (url === urls[0]) { await wait(900); return resp(page("top")); }                                    // ranked first, slower than the others but inside the grace
    await wait(40); return resp(page("fast " + url));
  };
  const out = await searchWeb("Eiffel Tower height", { fetchImpl: f, effort: "fast", route: false });
  assert.ok(out.passages.some((p) => p.url === urls[0]), "the top-ranked page that finished within the grace is kept");
});

test("E2 diff 8: the open web's 6 s budget ends 2 s after another source has answered with a usable list (it was a flat clock), and the web's results are still used when they arrive inside that grace", async () => {
  const mk = (webMs) => async (url) => {
    if (/holodeck-proxy.*\/search/.test(url)) { await wait(webMs); return resp({ engine: "DuckDuckGo", results: [{ title: "Eiffel Tower facts", url: "https://web.example/tower", snippet: "Eiffel Tower", source: "web.example" }] }); }
    if (/en\.wikipedia\.org\/w\/api/.test(url)) { await wait(100); return resp({ query: { search: ["Eiffel Tower", "Gustave Eiffel", "Eiffel Tower (disambiguation)"].map((title) => ({ title, snippet: "tower", wordcount: 900 })) } }); }
    if (/api\.github\.com|archive\.org|openalex\.org|crossref\.org/.test(url)) return resp({ items: [], total_count: 0, response: { numFound: 0, docs: [] }, meta: { count: 0 }, results: [], message: { "total-results": 0, items: [] } });
    if (/wikipedia\.org\/w\/api.*extracts|wikipedia\.org\/wiki/.test(url)) return resp(page("wiki"));
    return resp(page("page " + url));
  };
  let t0 = Date.now();
  const slow = await searchWeb("Eiffel Tower height", { fetchImpl: mk(5500), effort: "balanced", route: false });
  const msSlow = Date.now() - t0;
  assert.ok(slow.passages.length >= 1, "it still reads");
  assert.ok(msSlow < 5000, `took ${msSlow} ms; with the web stuck, the turn must not wait out the whole 6 s budget`);
  t0 = Date.now();
  const quickWeb = await searchWeb("Eiffel Tower height", { fetchImpl: mk(900), effort: "balanced", route: false });
  assert.ok(quickWeb.results.some((r) => r.kind === "web"), "a web that answers inside the grace is still used");
});

test("E2 diff 9: a door that has never answered is left alone — the five public proxies are asked in the first six refused reads, not in every one; the relay always is; a host whose own read failed is not read directly again", async () => {
  W._doors?.clear();   // the memory is module state: start clean
  const log = { direct: [], relay: 0, proxy: {} };
  const f = async (url) => {
    if (/holodeck-proxy.*\/raw/.test(url)) { log.relay++; return resp(page("via relay " + url)); }
    const m = /(allorigins|codetabs|corsproxy|cors\.eu\.org|thingproxy)/.exec(url);
    if (m) { log.proxy[m[1]] = (log.proxy[m[1]] || 0) + 1; throw new TypeError("refused"); }
    log.direct.push(url); throw new TypeError("Failed to fetch");                        // the page's own host: CORS-closed
  };
  const hosts = Array.from({ length: 9 }, (_, i) => `https://closed${i}.example/a`);
  for (const h of hosts) { const rd = await readText(h, { fetchImpl: f }); assert.equal(rd.ok, true); assert.equal(rd.via, "the fold's relay"); }
  assert.equal(log.relay, 9, "the relay is asked for every page");
  for (const [k, n] of Object.entries(log.proxy)) assert.ok(n <= 6, `${k} was asked ${n} times; a door with no answer in 6 tries is left alone`);
  const before = log.direct.length;
  await readText(hosts[0], { fetchImpl: f });                                              // same host again (not memoised: a fresh read)
  assert.equal(log.direct.length, before, "a host whose own read failed is not tried directly again");
});

test("E2 diff 9: one answer keeps a door alive", async () => {
  W._doors?.clear();
  const f = async (url) => {
    if (/holodeck-proxy.*\/raw/.test(url)) throw new TypeError("relay down");
    if (/allorigins/.test(url)) return resp(page("via allorigins"));
    if (/codetabs|corsproxy|cors\.eu\.org|thingproxy/.test(url)) throw new TypeError("refused");
    throw new TypeError("Failed to fetch");
  };
  for (let i = 0; i < 9; i++) { const rd = await readText(`https://alive${i}.example/a`, { fetchImpl: f }); assert.equal(rd.ok, true, "read " + i); }
});
