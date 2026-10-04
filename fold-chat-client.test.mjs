// fold-chat-client.test.mjs — the chat's half of the heimdall wire: model
// metadata, the sealed gate, SSE streaming, and the meter. Fake fetch; no
// network.
import test from "node:test";
import assert from "node:assert/strict";
import { listModels, chat, meter, ledger, isSealed } from "./fold-chat-client.js";

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

test("meter and ledger return the heimdall accounting", async () => {
  const { fetchImpl } = fakeBridge({ meterBody: { counts: { "deterministic/local": 5, "open remote": 2, frontier: 0 }, externalTokens: 42, estimated: { frontierEverything: 42, conventionalRawContext: 953, note: "estimates" } } });
  const m = await meter({ base: "http://x:8790", fetchImpl });
  assert.equal(m.externalTokens, 42);
  assert.equal(m.counts["open remote"], 2);
  const l = await ledger({ base: "http://x:8790", fetchImpl });
  assert.deepEqual(l.entries, []);
});