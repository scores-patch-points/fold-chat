// fold-chat-hosted.test.mjs — the Fold's side of the small hosted open-model tier:
// key rows for OpenRouter / Together / Fireworks / DeepInfra, their tier, and the parallel race over the real wire.
// FAKE keys and a STUB provider only; nothing here reaches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { race, tierOf, providerLabel, HOSTED_PROVIDERS, TIERS, remoteCandidates, remoteCode, resetModelHealth, describeTokens, meter } from "./fold-chat-client.js";

const here = dirname(fileURLToPath(import.meta.url));
const msgs = [{ role: "user", content: "hi" }];
const HOSTED = ["openrouter", "together", "fireworks", "deepinfra"];

test("settings: one key row per hosted provider, wired in the page and in the settings code", () => {
  const html = readFileSync(join(here, "index.html"), "utf8");
  const js = readFileSync(join(here, "fold-chat.js"), "utf8");
  for (const p of HOSTED) {
    const id = "key" + p[0].toUpperCase() + p.slice(1);
    assert.match(html, new RegExp(`id="${id}"[^>]*type="password"|type="password"[^>]*id="${id}"`), `${id} is a password field`);
    assert.match(html, new RegExp(`data-provider="${p}"`), `${p} has a Save button`);
    assert.ok(js.includes(`"${p}"`), `${p} is in the settings wiring`);
    assert.notEqual(providerLabel(p), p, `${p} has a proper name`);
  }
  assert.deepEqual([...HOSTED_PROVIDERS].sort(), [...HOSTED].sort(), "the client's hosted list matches heimdall's");
});

test("settings: every key row has a 'Get a key' link that opens the provider's own page safely in a new tab", () => {
  const html = readFileSync(join(here, "index.html"), "utf8");
  const rows = [...html.matchAll(/<div class="keyrow">(.*?)<\/div>/gs)].map((m) => m[1]);
  assert.equal(rows.length, 6);
  const hosts = { anthropic: "platform.claude.com", openai: "platform.openai.com", openrouter: "openrouter.ai", together: "api.together.ai", fireworks: "app.fireworks.ai", deepinfra: "deepinfra.com" };
  for (const row of rows) {
    const provider = /data-provider="(\w+)"/.exec(row)[1];
    const a = /<a class="keyget" href="([^"]+)" target="_blank" rel="([^"]+)"/.exec(row);
    assert.ok(a, `${provider} has a link`);
    assert.equal(new URL(a[1]).protocol, "https:");
    assert.equal(new URL(a[1]).host, hosts[provider], `${provider} links to its own site`);
    assert.match(a[2], /noopener/);
    assert.match(a[2], /noreferrer/);
  }
});

test("tierOf: a sealed hosted small model is the cheap remote tier; other sealed models stay frontier", () => {
  assert.equal(tierOf({ id: "deepinfra:google/gemma-2-9b-it", sealed: true, provider: "deepinfra" }), "remote");
  assert.equal(tierOf({ id: "claude-haiku-4-5", sealed: true, provider: "anthropic" }), "frontier");
  assert.equal(tierOf({ id: "gemma2:2b", sealed: false, provider: "pollinations" }), "remote", "unchanged: an unsealed outside provider is remote");
  assert.equal(TIERS.remote.label, "Open remote");
});

test("race: nothing is sent without a privacy mode (seal first)", async () => {
  let sent = 0;
  await assert.rejects(() => race(msgs, { fetchImpl: async () => { sent++; return { ok: true, json: async () => ({}) }; } }), /privacy mode/);
  await assert.rejects(() => race(msgs, { privacy: "local-raw", fetchImpl: async () => { sent++; } }), /privacy mode/);
  assert.equal(sent, 0);
});

test("race: posts to heimdall's /api/race with the mode, lane list and privacy; failures keep status and the lanes' reasons", async () => {
  let got = null;
  const ok = async (url, opts) => { got = { url, body: JSON.parse(opts.body) }; return { ok: true, status: 200, json: async () => ({ mode: "first", winner: { model: "x", text: "hi" }, results: [], asked: 2 }) }; };
  const out = await race(msgs, { privacy: "sealed-external", models: ["deepinfra:a", "openrouter:b"], mode: "all", n: 2, base: "http://x:8790", fetchImpl: ok });
  assert.match(got.url, /\/api\/race$/);
  assert.deepEqual(got.body.models, ["deepinfra:a", "openrouter:b"]);
  assert.equal(got.body.mode, "all");
  assert.equal(got.body.heimdall_privacy, "sealed-external");
  assert.equal(out.winner.text, "hi");
  const bad = async () => ({ ok: false, status: 502, json: async () => ({ winner: null, error: "every lane failed", results: [{ ok: false, provider: "together", error: "boom" }] }) });
  await assert.rejects(() => race(msgs, { privacy: "explicit", fetchImpl: bad }), (e) => e.status === 502 && e.results?.[0]?.provider === "together");
});

// The real wire: the Fold's client against the sibling heimdall bridge, providers stubbed, keys fake.
const bridgeSrc = join(here, "..", "heimdall", "src", "bridge-server.mjs");
test("race over the real heimdall bridge: parallel across providers, each lane on its own key, no doubled /v1", { skip: !existsSync(bridgeSrc) && "sibling heimdall not checked out" }, async () => {
  const { createBridge } = await import(bridgeSrc);
  const seen = [], starts = [], ends = [];
  const frontierFetch = async (url, opts) => {
    seen.push({ url, auth: opts.headers?.authorization });
    starts.push(Date.now());
    await new Promise((r) => setTimeout(r, 100));
    ends.push(Date.now());
    const data = `data: ${JSON.stringify({ choices: [{ delta: { content: "ok:" + new URL(url).host } }] })}\n\ndata: [DONE]\n\n`;
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(data)); c.close(); } }) };
  };
  const exec = (provider, endpoint, model) => ({ executor: `${provider}:${model}`, endpoint, model, provider, location: "external", authClass: "api_key", privacyClass: "sealed-only", live: { reachable: true }, auth: { kind: "api_key", apiKey: provider + "-FAKE" } });
  const bridge = createBridge({
    port: 0, host: "127.0.0.1", dist: tmpdir(), upstream: "http://127.0.0.1:1", frontierFetch,
    frontierExecutors: [exec("openrouter", "https://openrouter.ai/api/v1", "google/gemma-2-9b-it"), exec("fireworks", "https://api.fireworks.ai/inference/v1", "accounts/fireworks/models/llama-v3p1-8b-instruct"), exec("deepinfra", "https://api.deepinfra.com/v1/openai", "google/gemma-2-9b-it")],
    linksFile: join(tmpdir(), "fold-hosted-hosts-" + Date.now() + ".json"), auditFile: join(mkdtempSync(join(tmpdir(), "fold-hosted-audit-")), "ledger.ndjson"),
  });
  const addr = await bridge.listen();
  try {
    const j = await race(msgs, { privacy: "sealed-external", mode: "all", base: `http://127.0.0.1:${addr.port}` });
    assert.equal(j.results.length, 3);
    assert.deepEqual(j.results.map((r) => r.provider).sort(), ["deepinfra", "fireworks", "openrouter"]);
    assert.ok(Math.max(...starts) < Math.min(...ends), "all three calls were in flight at the same moment (parallel, however loaded the machine is)");
    for (const s of seen) assert.ok(!s.url.includes("/v1/v1/"), s.url);
    assert.deepEqual(Object.fromEntries(seen.map((s) => [new URL(s.url).host, s.auth])), { "openrouter.ai": "Bearer openrouter-FAKE", "api.fireworks.ai": "Bearer fireworks-FAKE", "api.deepinfra.com": "Bearer deepinfra-FAKE" });
  } finally { await bridge.close(); }
});

/* ---------------- remoteCode races its candidates ---------------- */

const sseBody = (text) => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("data: " + JSON.stringify({ choices: [{ delta: { content: text } }] }) + "\n\ndata: [DONE]\n\n")); c.close(); } });
/** A stand-in bridge: each model answers after its own delay, honours the abort signal, and says what happened to it. */
function slowBridge(spec) {
  const log = [];
  const fn = async (url, opts) => {
    const model = JSON.parse(opts.body).model;
    const s = spec[model] || { ms: 5, say: "ok " + model };
    const rec = { model, startedAt: Date.now(), aborted: false, finished: false };
    log.push(rec);
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, s.ms);
      opts.signal?.addEventListener("abort", () => { clearTimeout(t); rec.aborted = true; reject(Object.assign(new Error("aborted"), { name: "AbortError" })); }, { once: true });
    });
    rec.finished = true;
    if (s.fail) return { ok: false, status: 500, json: async () => ({ error: { message: "boom" } }), text: async () => "boom" };
    return { ok: true, status: 200, body: sseBody(s.say ?? "ok " + model) };
  };
  fn.log = log;
  return fn;
}

test("remoteCandidates: the same small model on two providers is two lanes, and hosted lanes come first", () => {
  resetModelHealth();
  const models = [
    { id: "pollinations:openai-fast", sealed: true, provider: "pollinations" },
    { id: "google/gemma-2-9b-it", sealed: true, provider: "openrouter" },
    { id: "openrouter:google/gemma-2-9b-it", sealed: true, provider: "openrouter" },
    { id: "google/gemma-2-9b-it", sealed: true, provider: "deepinfra" },
    { id: "deepinfra:google/gemma-2-9b-it", sealed: true, provider: "deepinfra" },
  ];
  const c = remoteCandidates(models);
  assert.ok(c.includes("openrouter:google/gemma-2-9b-it") && c.includes("deepinfra:google/gemma-2-9b-it"), JSON.stringify(c));
  assert.ok(!c.includes("google/gemma-2-9b-it"), "the ambiguous bare name is not a lane: " + JSON.stringify(c));
  assert.deepEqual(c.slice(0, 2).sort(), ["deepinfra:google/gemma-2-9b-it", "openrouter:google/gemma-2-9b-it"], "hosted before the keyless lane");
});

test("remoteCode races: the candidates go out together, the first answer wins, and the slow ones are CANCELLED (not failed)", async () => {
  resetModelHealth();
  const fx = slowBridge({ "a:slow": { ms: 600, say: "slow" }, "b:fast": { ms: 30, say: "fast" }, "c:mid": { ms: 300, say: "mid" } });
  const tries = [];
  const out = await remoteCode("make a timer", { candidates: ["a:slow", "b:fast", "c:mid"], fetchImpl: fx, onTry: (m) => tries.push(m), mask: false });
  assert.equal(out.model, "b:fast");
  assert.equal(out.text, "fast");
  assert.deepEqual(tries.sort(), ["a:slow", "b:fast", "c:mid"], "all three were sent");
  assert.ok(Math.max(...fx.log.map((r) => r.startedAt)) - Math.min(...fx.log.map((r) => r.startedAt)) < 50, "started together, not one after another");
  assert.deepEqual(fx.log.filter((r) => r.aborted).map((r) => r.model).sort(), ["a:slow", "c:mid"], "the losers were cancelled");
  assert.equal(fx.log.find((r) => r.model === "a:slow").finished, false);
  assert.deepEqual(out.tried, [], "a cancelled lane is not a failed lane");
  assert.equal(out.sent.length, 3, "every request that left is on the audit list");
});

test("remoteCode race: a lane that fails does not win, and a batch with no answer moves on to the next batch", async () => {
  resetModelHealth();
  const fx = slowBridge({ "a:dead": { ms: 10, fail: true }, "b:dead": { ms: 10, fail: true }, "c:ok": { ms: 20, say: "third" } });
  const out = await remoteCode("x", { candidates: ["a:dead", "b:dead", "c:ok"], race: 2, fetchImpl: fx, mask: false });
  assert.equal(out.model, "c:ok");
  assert.deepEqual(out.tried.map((t) => t.model).sort(), ["a:dead", "b:dead"], "both failures are on the record");
  const all = slowBridge({ "a:dead": { ms: 5, fail: true }, "b:dead": { ms: 5, fail: true } });
  await assert.rejects(remoteCode("x", { candidates: ["a:dead", "b:dead"], fetchImpl: all, mask: false }), (e) => e.status === 502 && e.tried.length === 2);
});

test("remoteCode race: the caller's own stop cancels every lane", async () => {
  resetModelHealth();
  const fx = slowBridge({ "a:x": { ms: 800 }, "b:x": { ms: 800 } });
  const ac = new AbortController();
  const p = remoteCode("x", { candidates: ["a:x", "b:x"], fetchImpl: fx, signal: ac.signal, mask: false });
  setTimeout(() => ac.abort(), 40);
  await assert.rejects(p, (e) => e.name === "AbortError");
  assert.ok(fx.log.every((r) => r.aborted && !r.finished));
});

test("describeTokens: used, saved and cancelled in plain numbers; null for a heimdall without the token ledger", () => {
  assert.equal(describeTokens({ counts: {} }), null);
  const d = describeTokens({ tokens: { used: { input: 4500, output: 700, usd: 0.000234, byModel: [{ model: "deepinfra:google/gemma-2-9b-it", lane: "hosted", calls: 2, input: 4000, output: 600, usd: 0.000234 }] }, local: { input: 800, output: 300, calls: 1 }, saved: { tokens: 5700, usd: 0.0702, calls: 3, versus: "claude-sonnet-5 at $3/$15 per million tokens (in/out)" }, cancelled: 2, exact: 0.5 } });
  assert.equal(d.used, "4,500 in · 700 out");
  assert.equal(d.cost, "$0.0002");
  assert.equal(d.saved, "5,700 tokens");
  assert.equal(d.savedUsd, "$0.07");
  assert.equal(d.cancelled, 2);
  assert.match(d.exact, /50% of counts reported/);
  assert.match(d.local, /1,100 tokens on this machine/);
  assert.deepEqual(d.rows[0], { model: "deepinfra:google/gemma-2-9b-it", lane: "hosted", calls: 2, tokens: "4,600", usd: "$0.0002" });
});

test("end to end: the Fold's remoteCode races two hosted lanes through the real bridge, and the meter then shows what was used, saved and cancelled", { skip: !existsSync(bridgeSrc) && "sibling heimdall not checked out" }, async () => {
  resetModelHealth();
  const { createBridge } = await import(bridgeSrc);
  const calls = [];
  const frontierFetch = async (url, opts) => {
    const body = JSON.parse(opts.body), host = new URL(url).host;
    const rec = { host, aborted: false, finished: false, usage: !!body.stream_options?.include_usage };
    calls.push(rec);
    const ms = host === "api.deepinfra.com" ? 25 : 700;
    await new Promise((resolve, reject) => { const t = setTimeout(resolve, ms); opts.signal?.addEventListener("abort", () => { clearTimeout(t); rec.aborted = true; reject(Object.assign(new Error("aborted"), { name: "AbortError" })); }, { once: true }); });
    rec.finished = true;
    const chunks = [{ choices: [{ delta: { content: "```html\n<p>from " + host + "</p>\n```" } }] }, { choices: [], usage: { prompt_tokens: 200, completion_tokens: 40 } }];
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { for (const j of chunks) c.enqueue(new TextEncoder().encode("data: " + JSON.stringify(j) + "\n\n")); c.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); c.close(); } }) };
  };
  const exec = (provider, endpoint, model) => ({ executor: `${provider}:${model}`, endpoint, model, provider, location: "external", authClass: "api_key", privacyClass: "sealed-only", live: { reachable: true }, auth: { kind: "api_key", apiKey: provider + "-FAKE" } });
  const dir = mkdtempSync(join(tmpdir(), "fold-tokens-"));
  const bridge = createBridge({ port: 0, host: "127.0.0.1", dist: tmpdir(), upstream: "http://127.0.0.1:1", frontierFetch, frontierExecutors: [exec("deepinfra", "https://api.deepinfra.com/v1/openai", "google/gemma-2-9b-it"), exec("openrouter", "https://openrouter.ai/api/v1", "google/gemma-2-9b-it")], linksFile: join(dir, "h.json"), stateFile: join(dir, "s.json"), auditFile: join(dir, "l.ndjson") });
  const addr = await bridge.listen();
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    const models = (await (await fetch(base + "/api/tags")).json()).models.map((m) => ({ id: m.name, sealed: !!m.heimdall?.frontier, provider: m.heimdall?.frontier }));
    const candidates = remoteCandidates(models);
    assert.equal(candidates.length, 2, JSON.stringify(candidates));
    const out = await remoteCode("make a timer", { candidates, base, mask: false });
    assert.match(out.text, /from api\.deepinfra\.com/, "the fast provider won");
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(calls.find((c) => c.host === "openrouter.ai").aborted, true, "the slow provider call was cancelled at the provider");
    const m = await meter({ base });
    const d = describeTokens(m);
    assert.equal(d.used, "200 in · 40 out", "only the winner's tokens, as the provider reported them");
    assert.equal(d.cancelled, 1);
    assert.equal(d.saved, "240 tokens");
    assert.equal(d.exact, "all counts reported by the providers");
    assert.equal(d.rows[0].model, "deepinfra:google/gemma-2-9b-it");
  } finally { await bridge.close(); }
});
