// fold-chat-client.test.mjs — the chat's half of the heimdall wire: model
// metadata, the sealed gate, SSE streaming, and the meter. Fake fetch; no
// network.
import test from "node:test";
import assert from "node:assert/strict";
import { listModels, chat, meter, ledger, isSealed, tierOf, TIERS, code, codeStatus, detectBridge, setProviderKey, listProviderKeys } from "./fold-chat-client.js";

/** A fake heimdall bridge over the OpenAI/extra routes. */
function fakeBridge({ models = [], meterBody = null, chatChunks = null, chatStatus = 200, chatError = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    const u = new URL(url);
    if (u.pathname === "/api/tags") {
      return json({ models });
    }
    if (u.pathname === "/api/meter") {
      return json(meterBody ?? { counts: { "deterministic/local": 1, "open remote": 0, frontier: 0 }, externalTokens: 0, estimated: { frontierEverything: 0, conventionalRawContext: 0, note: "estimates" } });
    }
    if (u.pathname === "/api/ledger") {
      return json({ entries: [] });
    }
    if (u.pathname === "/v1/chat/completions") {
      const body = JSON.parse(opts.body);
      if (chatStatus === 400) {
        return { ok: false, status: 400, json: async () => ({ error: { message: "frontier model X is sealed-only — send heimdall_privacy:\"sealed-external\" (or \"explicit\") in the body; the Fold selects its privacy mode and seals first" } }) };
      }
      if (chatError) return { ok: false, status: 502, json: async () => ({}) };
      const data = (chatChunks ?? ["Hel", "lo"]).map((c) => "data: " + JSON.stringify({ choices: [{ delta: { content: c } }] }) + "\n\n").join("") + "data: [DONE]\n\n";
      return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(data)); c.close(); } }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}

const json = (obj) => ({ ok: true, status: 200, json: async () => obj });

test("listModels reads heimdall metadata and marks frontier models sealed", async () => {
  const { fetchImpl } = fakeBridge({
    models: [
      { name: "gemma2:2b", heimdall: { webllm: "gemma-2-2b-it-q4f16_1-MLC", workers: 1, context_window: 4096 } },
      { name: "gpt-oss-120b", heimdall: { frontier: "groq", privacy: "sealed-external", location: "external" } },
      { name: "gemma2:9b", heimdall: {} },
    ],
  });
  const models = await listModels({ base: "http://x:8790", fetchImpl });
  assert.equal(models.length, 3);
  const local = models.find((m) => m.id === "gemma2:2b");
  const frontierModel = models.find((m) => m.id === "gpt-oss-120b");
  assert.equal(local.sealed, false);
  assert.equal(frontierModel.sealed, true);
  assert.equal(frontierModel.provider, "groq");
  assert.equal(frontierModel.location, "external");
  assert.equal(isSealed({ frontier: "groq", privacy: "sealed-external" }), true);
  assert.equal(isSealed({ webllm: "x" }), false);
});

test("every model lands on a tier: on-device, fleet, remote, or frontier", async () => {
  const { fetchImpl } = fakeBridge({
    models: [
      { name: "gemma2:2b", heimdall: { webllm: "gemma-2-2b-it-q4f16_1-MLC", workers: 1 } },
      { name: "qwen2.5:3b", heimdall: {} },
      { name: "llama-on-phone", heimdall: { workers: 2 } },
      { name: "box-gpu:7b", heimdall: { native: "mac-mini" } },
      { name: "gpt-oss-120b", heimdall: { frontier: "groq", privacy: "sealed-external", location: "external" } },
    ],
  });
  const models = await listModels({ base: "http://x:8790", fetchImpl });
  const tier = (id) => models.find((m) => m.id === id).tier;
  assert.equal(tier("gemma2:2b"), "local");
  assert.equal(tier("qwen2.5:3b"), "local");
  assert.equal(tier("llama-on-phone"), "fleet");
  assert.equal(tier("box-gpu:7b"), "fleet");
  assert.equal(tier("gpt-oss-120b"), "frontier");
  assert.deepEqual(Object.keys(TIERS), ["local", "fleet", "remote", "frontier"]);
  assert.equal(tierOf({ sealed: true, provider: "local" }), "frontier", "sealed always wins");
});

test("chat streams tokens and lands the sealed-external gate on the body", async () => {
  const { fetchImpl, calls } = fakeBridge();
  const seen = [];
  const out = await chat("gpt-oss-120b", [{ role: "user", content: "seal me" }], { base: "http://x:8790", fetchImpl, onToken: (t) => seen.push(t) });
  assert.equal(out.text, "Hello");
  assert.equal(seen.join(""), "Hello");
  const sent = calls.find((c) => c.url.endsWith("/v1/chat/completions"));
  const body = JSON.parse(sent.opts.body);
  assert.equal(body.model, "gpt-oss-120b");
  assert.equal(body.heimdall_privacy, "sealed-external", "the chat seals by default");
  assert.equal(body.stream, true);
});

test("a refused sealed request surfaces the bridge's gate message", async () => {
  const { fetchImpl } = fakeBridge({ chatStatus: 400 });
  await assert.rejects(
    () => chat("gpt-oss-120b", [{ role: "user", content: "hi" }], { base: "http://x:8790", fetchImpl }),
    (e) => e.status === 400 && /sealed-only/.test(e.message),
  );
});

test("code goes THROUGH the bridge (never opencode directly)", async () => {
  const calls = [];
  let codeBody = null;
  let firstCode = null;
  const fetchImpl = async (url, opts = {}) => {
    calls.push(url);
    if (url.endsWith("/api/code/status")) return { ok: true, status: 200, json: async () => ({ configured: true, url: "http://127.0.0.1:4096" }) };
    if (url.endsWith("/api/code")) {
      codeBody = JSON.parse(opts.body);
      if (!firstCode) { firstCode = codeBody; assert.deepEqual(firstCode, { prompt: "fix the test", title: null, model: null, agent: null, sessionId: null, cwd: null }); }
      return { ok: true, status: 200, json: async () => ({ sessionId: "ses_1", text: "done", activity: [{ tool: "edit", status: "completed", title: "src/util.js" }], ms: 12, lane: "opencode" }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const st = await codeStatus({ base: "http://x:8790", fetchImpl });
  assert.equal(st.configured, true);
  const out = await code("fix the test", { base: "http://x:8790", fetchImpl });
  assert.equal(out.sessionId, "ses_1");
  assert.equal(out.text, "done");
  assert.equal(out.lane, "opencode");
  assert.ok(calls.every((u) => u.startsWith("http://x:8790/")), "the chat only ever called the heimdall bridge");

  // The project's folder rides the wire so the door stands where the project
  // stands — a code turn and a chat turn share the same place.
  await code("edit it", { base: "http://x:8790", fetchImpl, cwd: "/Users/me/proj" });
  assert.equal(codeBody.cwd, "/Users/me/proj");
});

test("a code job with no machine attached surfaces the bridge's message", async () => {
  const fetchImpl = async () => ({ ok: false, status: 501, json: async () => ({ error: "no coding machine attached" }) });
  await assert.rejects(() => code("x", { base: "http://x:8790", fetchImpl }), (e) => e.status === 501 && /coding machine/.test(e.message));
});

test("meter and ledger return the heimdall accounting", async () => {
  const { fetchImpl } = fakeBridge({ meterBody: { counts: { "deterministic/local": 5, "open remote": 2, frontier: 0 }, externalTokens: 42, estimated: { frontierEverything: 42, conventionalRawContext: 953, note: "estimates" } } });
  const m = await meter({ base: "http://x:8790", fetchImpl });
  assert.equal(m.externalTokens, 42);
  assert.equal(m.counts["open remote"], 2);
  const l = await ledger({ base: "http://x:8790", fetchImpl });
  assert.deepEqual(l.entries, []);
});

test("detectBridge finds the first answering local port", async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.startsWith("http://127.0.0.1:8790")) return { ok: true, status: 200, json: async () => ({ bridge: true, port: 8790 }) };
    return { ok: false, status: 0, json: async () => ({}) };
  };
  const found = await detectBridge({ fetchImpl });
  assert.equal(found.ok, true);
  assert.equal(found.base, "http://127.0.0.1:8790");
  assert.equal(found.hello.port, 8790);
  assert.ok(seen[0].startsWith("http://localhost:8790"), "the standard port is probed first");
});

test("detectBridge reports not-found without throwing", async () => {
  const fetchImpl = async () => { throw new Error("refused"); };
  const found = await detectBridge({ fetchImpl });
  assert.equal(found.ok, false);
  assert.equal(found.base, null);
});

test("setProviderKey POSTs to the bridge's server-side key route", async () => {
  let captured = null;
  const fetchImpl = async (url, opts = {}) => {
    captured = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ ok: true, provider: "anthropic", stored: true, configured: ["anthropic"], frontierModels: 2 }) };
  };
  const out = await setProviderKey("anthropic", "sk-ant-xyz", { base: "http://x:8790", fetchImpl });
  assert.match(captured.url, /\/api\/providers\/keys$/);
  assert.deepEqual(captured.body, { provider: "anthropic", key: "sk-ant-xyz" });
  assert.equal(out.stored, true);
  assert.equal(out.frontierModels, 2);
});

test("a refused key surfaces the bridge's message", async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ error: "provider keys can only be set from this machine" }) });
  await assert.rejects(() => setProviderKey("openai", "sk-x", { base: "http://x:8790", fetchImpl }), (e) => e.status === 403 && /this machine/.test(e.message));
});

test("listProviderKeys returns names only, never key values", async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /\/api\/providers\/keys$/);
    return { ok: true, status: 200, json: async () => ({ providers: [{ provider: "anthropic", set: true }], keySource: "server-side (never a browser)" }) };
  };
  const out = await listProviderKeys({ base: "http://x:8790", fetchImpl });
  assert.deepEqual(out.providers, [{ provider: "anthropic", set: true }]);
  assert.equal(JSON.stringify(out).includes("sk-"), false);
});
// ── regression: a code specialist / an embedder is never auto-picked to write,
//    and a tool-call returned as text is split out of the answer. Measured live:
//    auto-pick chose qwen2.5-coder:1.5b for "write an essay", which hedged into
//    a 265-char teaser under the fold persona; and the machine door returned
//    `{"name":"write","arguments":{…}}` as the answer text.
test("autoPick prefers a general chat model over a coder and an embedder", async () => {
  const { autoPick, isCodeModel, isEmbedModel, isChatModel } = await import("./fold-chat-client.js");
  const models = [
    { id: "qwen2.5-coder:1.5b", tier: "local" },
    { id: "nomic-embed-text:latest", tier: "local" },
    { id: "gemma2:2b", tier: "local" },
  ];
  assert.equal(isCodeModel({ id: "qwen2.5-coder:1.5b" }), true);
  assert.equal(isEmbedModel({ id: "nomic-embed-text:latest" }), true);
  assert.equal(isChatModel({ id: "gemma2:2b" }), true);
  assert.equal(autoPick(models)?.id, "gemma2:2b");
  // The control: with only a coder + embedder left, it still returns something
  // (the coder) rather than nothing — but never the embedder.
  assert.equal(autoPick([{ id: "nomic-embed-text:latest", tier: "local" }, { id: "qwen2.5-coder:1.5b", tier: "local" }])?.id, "qwen2.5-coder:1.5b");
});

test("splitToolCalls lifts a tool call out of the prose, keeps code fences whole", async () => {
  const { splitToolCalls } = await import("./fold-chat-client.js");
  const only = splitToolCalls('{"name": "write", "arguments": {"content": "x", "filePath": "a.txt"}}');
  assert.deepEqual(only.calls, [{ name: "write", arguments: { content: "x", filePath: "a.txt" } }]);
  assert.equal(only.text, "");
  const mixed = splitToolCalls('Writing it now.\n{"name": "edit", "arguments": {"filePath": "s.js"}}\nDone.');
  assert.deepEqual(mixed.calls.map((c) => c.name), ["edit"]);
  assert.equal(mixed.text, "Writing it now.\n\nDone.");
  const fenced = splitToolCalls("Here:\n```html\n<div>{a}</div>\n```");
  assert.equal(fenced.calls.length, 0);
  assert.match(fenced.text, /```html/);
  const braces = splitToolCalls("plain prose with a {brace} in it");
  assert.equal(braces.calls.length, 0);
  assert.equal(braces.text, "plain prose with a {brace} in it");
});
