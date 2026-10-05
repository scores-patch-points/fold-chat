import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseBrave, searchDirect, ENGINES } from "./fold-chat-engines.js";

const sample = fs.readFileSync(new URL("./test-support/brave-serp-sample.html", import.meta.url), "utf8");

test("parseBrave: a real server-rendered Brave page parses to titled, addressed, snippeted results", () => {
  const p = parseBrave(sample);
  assert.ok(p.results.length >= 3, "got " + p.results.length);
  for (const r of p.results) { assert.match(r.url, /^https?:\/\//); assert.ok(r.title.length > 5); assert.ok(!/[<>]/.test(r.title + r.snippet), "no markup left"); }
  assert.ok(p.results.some((r) => r.snippet.length > 40), "snippets come through");
});

test("parseBrave: a big page that parses to nothing says the markup changed — never 'the web had nothing'", () => {
  const p = parseBrave("<html>" + "x".repeat(30000) + "</html>");
  assert.deepEqual(p.results, []);
  assert.match(p.shape, /markup may have changed/);
});

const page = (n) => "<html><body>" + Array.from({ length: n }, (_, i) => `<div class="snippet svelte-x" data-pos="${i}" data-type="web"><a href="https://site${i}.test/p">x</a><div class="title t">Result ${i} title</div><div class="content c">snippet ${i} about the thing asked</div></div>`).join("") + "</body></html>";
const ddgChallenge = "<html>duckduckgo anomaly.js cc=botnet</html>";

test("searchDirect: engines are asked at once, the first with results wins, and a refusal costs only its own answer", async () => {
  const started = [];
  const f = async (u) => { started.push(new URL(u).hostname); if (/duckduckgo/.test(u)) return { ok: true, status: 200, text: async () => ddgChallenge }; await new Promise((r) => setTimeout(r, 40)); return { ok: true, status: 200, text: async () => page(8) }; };
  const out = await searchDirect("q", { fetchImpl: f });
  assert.equal(started.length, 2, "both asked");
  assert.equal(out.engine, "brave");
  assert.equal(out.results.length, 8);
  assert.deepEqual(out.blocked, ["ddg"]);
});

test("searchDirect: when every engine fails the turn gets no results and a typed reason per engine", async () => {
  const f = async (u) => ({ ok: true, status: 200, text: async () => (/duckduckgo/.test(u) ? ddgChallenge : "<html>nothing</html>") });
  const out = await searchDirect("q", { fetchImpl: f });
  assert.equal(out.engine, null);
  assert.deepEqual(out.results, []);
  assert.ok(out.tried.every((t) => t.why));
});

test("searchDirect: an engine that hangs is cut at its timeout and the other still answers", async () => {
  const f = async (u, o) => (/duckduckgo/.test(u) ? new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" })))) : { ok: true, status: 200, text: async () => page(6) });
  const out = await searchDirect("q", { fetchImpl: f, timeoutMs: 60 });
  assert.equal(out.engine, "brave");
});

test("ENGINES: ids are unique and each builds an https URL", () => {
  assert.equal(new Set(ENGINES.map((e) => e.id)).size, ENGINES.length);
  for (const e of ENGINES) assert.match(e.url("a b"), /^https:\/\/.*a%20b/);
});

// ── searchWeb in the extension's DIRECT transport ───────────────────────────────────────────────
import { searchWeb, readText, makeMemo } from "./fold-chat-web.js";
const resp = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

test("direct transport: searches Brave+DuckDuckGo directly, never touches the relay or a public proxy, reads pages directly", async () => {
  const hosts = [];
  const f = async (u) => {
    const h = new URL(u).hostname; hosts.push(h);
    if (/search\.brave\.com/.test(h)) return resp(page(8));
    if (/duckduckgo/.test(h)) return resp(ddgChallenge);
    return resp("<title>T</title><p>" + "A sourdough starter takes about seven days to ferment fully. ".repeat(20) + "</p>");
  };
  const out = await searchWeb("how long does a sourdough starter take to ferment", { fetchImpl: f, direct: true, route: true });
  assert.ok(out.passages.length >= 1);
  const bad = hosts.filter((h) => /holodeck-proxy|allorigins|codetabs|corsproxy|cors\.eu|thingproxy|jina|microlink/.test(h));
  assert.deepEqual(bad, [], "no relay, no public proxy, no text reader — no third party learns an address");
  assert.ok(out.trace.some((t) => t.scope === "web" && t.engine === "Brave Search"));
});

test("direct transport: a page the site refuses is reported unread — not retried through anyone else", async () => {
  const calls = [];
  const f = async (u) => { calls.push(new URL(u).hostname); return resp("", false, 403); };
  const rd = await readText("https://blocked.test/a", { fetchImpl: f, direct: true });
  assert.equal(rd.ok, false);
  assert.deepEqual([...new Set(calls)], ["blocked.test"]);
});

test("direct transport: every engine failing is a typed failure naming each engine, and the turn says so", async () => {
  const f = async (u) => resp(/duckduckgo/.test(u) ? ddgChallenge : "<html>nothing</html>");
  const out = await searchWeb("x", { fetchImpl: f, direct: true });
  const w = out.trace.find((t) => t.scope === "web");
  assert.equal(w.ok, false);
  assert.match(w.why, /brave: .*; ddg: challenge/);
});

test("direct defaults ON as the extension (chrome.runtime.id) and OFF on a plain page — nothing has to pass it", async () => {
  const hostsOf = async () => {
    const hosts = [];
    const f = async (u) => { hosts.push(new URL(u).hostname); return resp(/search\.brave\.com/.test(u) ? page(8) : /duckduckgo/.test(u) ? ddgChallenge : /holodeck-proxy/.test(u) ? { engine: "x", results: [] } : "<title>T</title><p>" + "A sourdough starter takes about seven days to ferment fully. ".repeat(20) + "</p>"); };
    await searchWeb("how long does a sourdough starter take to ferment", { fetchImpl: f });
    return hosts;
  };
  const saved = globalThis.chrome;
  try {
    // a default is evaluated per call, so stubbing the extension environment before the call is enough
    globalThis.chrome = { runtime: { id: "abcdefghijklmnop" } };
    const ext = await hostsOf();
    assert.ok(ext.includes("search.brave.com"), "as the extension it searched Brave directly");
    assert.ok(!ext.some((h) => /holodeck-proxy/.test(h)), "…and never touched the relay");
    delete globalThis.chrome;
    const plain = await hostsOf();
    assert.ok(plain.some((h) => /holodeck-proxy/.test(h)), "on a plain page it still goes through the relay");
    assert.ok(!plain.includes("search.brave.com"));
  } finally { if (saved === undefined) delete globalThis.chrome; else globalThis.chrome = saved; }
});
