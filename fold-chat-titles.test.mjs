// fold-chat-titles.js — one batched Wikipedia title lookup (redirects + disambiguation). No network: fetchImpl is injected.
import test from "node:test";
import assert from "node:assert/strict";
import { resolveTitlesWikipedia, TitlesError, DECLARED } from "./fold-chat-titles.js";

// A stand-in for action=query&titles=…&redirects=1&prop=pageprops (shapes follow a live batch of 2026-10-06).
const WORLD = {
  redirects: { "World War 2": "World War II", "UK": "United Kingdom", "Uk": "United Kingdom" },
  pages: { "World War II": {}, "United Kingdom": {}, "King": {}, "End": { pageprops: { disambiguation: "" } } },
};
const capFirst = (t) => (t ? t[0].toLocaleUpperCase("und") + t.slice(1) : t);     // MediaWiki's own first-letter rule, here only to stub it
function fakeApi(world = WORLD, log = []) {
  return async (url) => {
    const u = new URL(url);
    log.push(u);
    const titles = (u.searchParams.get("titles") || "").split("|");
    const normalized = [], redirects = [], pages = {};
    let id = 1;
    for (const t of titles) {
      let cur = t;
      const n = capFirst(cur); if (n !== cur) { normalized.push({ from: cur, to: n }); cur = n; }
      if (world.redirects[cur]) { redirects.push({ from: cur, to: world.redirects[cur] }); cur = world.redirects[cur]; }
      const p = world.pages[cur];
      if (p) pages[String(id++)] = { pageid: id, ns: 0, title: cur, ...p };
      else pages["-" + id++] = { ns: 0, title: cur, missing: "" };
    }
    const q = { pages }; if (normalized.length) q.normalized = normalized; if (redirects.length) q.redirects = redirects;
    return { ok: true, status: 200, json: async () => ({ batchcomplete: "", query: q }) };
  };
}

test("ONE batched call carries every candidate: redirects give the title, a disambiguation page says so, a missing page is null", async () => {
  const log = [];
  const out = await resolveTitlesWikipedia(["World War 2", "UK", "king", "end", "zzqx"], { fetchImpl: fakeApi(WORLD, log) });
  assert.equal(log.length, 1, "one request for five candidates");
  const u = log[0];
  assert.equal(u.hostname, "en.wikipedia.org");
  assert.equal(u.searchParams.get("action"), "query");
  assert.equal(u.searchParams.get("redirects"), "1");
  assert.equal(u.searchParams.get("prop"), "pageprops");
  assert.equal(u.searchParams.get("ppprop"), "disambiguation");
  assert.equal(u.searchParams.get("format"), "json");
  assert.equal(u.searchParams.get("origin"), "*");
  assert.equal(u.searchParams.get("titles"), "World War 2|UK|king|end|zzqx");
  assert.ok(out instanceof Map);
  assert.deepEqual(out.get("World War 2"), { title: "World War II", redirectedFrom: "World War 2", disambiguation: false });
  assert.deepEqual(out.get("UK"), { title: "United Kingdom", redirectedFrom: "UK", disambiguation: false });
  assert.deepEqual(out.get("king"), { title: "King", redirectedFrom: null, disambiguation: false });
  assert.deepEqual(out.get("end"), { title: "End", redirectedFrom: null, disambiguation: true });
  assert.equal(out.get("zzqx"), null);
});

test("a candidate the API normalised and then redirected still maps back to the candidate as given (no case rule of ours: MediaWiki's)", async () => {
  const out = await resolveTitlesWikipedia(["uk"], { fetchImpl: fakeApi() });
  assert.deepEqual(out.get("uk"), { title: "United Kingdom", redirectedFrom: "Uk", disambiguation: false });
});

test("more than 50 candidates are chunked (<= 50 per request), every candidate answered, duplicates asked once", async () => {
  assert.equal(DECLARED.chunk, 50);
  const names = Array.from({ length: 120 }, (_, i) => "Thing " + i);
  const log = [];
  const world = { redirects: {}, pages: Object.fromEntries(names.map((n) => [n, {}])) };
  const out = await resolveTitlesWikipedia([...names, ...names.slice(0, 5)], { fetchImpl: fakeApi(world, log) });
  assert.equal(log.length, 3);
  for (const u of log) assert.ok(u.searchParams.get("titles").split("|").length <= 50);
  assert.equal(out.size, 120);
  assert.ok(names.every((n) => out.get(n)?.title === n));
});

test("no candidates: an empty map and NO request", async () => {
  const log = [];
  const out = await resolveTitlesWikipedia([], { fetchImpl: fakeApi(WORLD, log) });
  assert.equal(out.size, 0); assert.equal(log.length, 0);
});

test("a candidate a wiki title cannot be (a '|', a bracket, empty) is null without being sent", async () => {
  const log = [];
  const out = await resolveTitlesWikipedia(["a|b", "x[y]", "  ", "king"], { fetchImpl: fakeApi(WORLD, log) });
  assert.equal(out.get("a|b"), null); assert.equal(out.get("x[y]"), null); assert.equal(out.get("  "), null);
  assert.equal(log.length, 1);
  assert.equal(log[0].searchParams.get("titles"), "king");
});

test("the edition picks the host", async () => {
  const log = [];
  await resolveTitlesWikipedia(["x"], { fetchImpl: fakeApi(WORLD, log), edition: "fr" });
  assert.equal(log[0].hostname, "fr.wikipedia.org");
  await assert.rejects(() => resolveTitlesWikipedia(["x"], { fetchImpl: fakeApi(), edition: "evil.example/" }), (e) => e instanceof TitlesError);
});

test("FALSIFIER: a network failure REJECTS with a typed error (the frame turns it into a gap) — never an empty map that reads as 'nothing resolves'", async () => {
  const cases = [
    async () => { throw new TypeError("fetch failed"); },
    async () => ({ ok: false, status: 503, json: async () => ({}) }),
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } }),
    async () => ({ ok: true, status: 200, json: async () => ({ error: { code: "ratelimited" } }) }),
    async () => ({ ok: true, status: 200, json: async () => ({}) }),
  ];
  for (const f of cases) {
    await assert.rejects(() => resolveTitlesWikipedia(["king"], { fetchImpl: f }), (e) => e instanceof TitlesError && e.kind === "titles_unavailable");
  }
});

test("FALSIFIER: one chunk failing fails the whole call (a half-answered batch is not 'unresolved')", async () => {
  let n = 0;
  const f = async (url) => { n++; if (n === 2) throw new Error("down"); return fakeApi({ redirects: {}, pages: {} })(url); };
  const names = Array.from({ length: 70 }, (_, i) => "T" + i);
  await assert.rejects(() => resolveTitlesWikipedia(names, { fetchImpl: f }), (e) => e instanceof TitlesError);
});
