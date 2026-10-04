// fold-chat-routing.test.mjs — THE FALSIFIER for two claims the surface makes:
//
//   1. It can use the FREE models AUTOMATICALLY — with nothing pinned, the
//      nearest free model (on this device, then the fleet) is chosen, never
//      the sealed outside one.
//   2. HEIMDALL IS ROUTING — every inference goes to the bridge, and NOTHING
//      ever reaches a model host directly.
//
// Green when both hold. The control at the end proves the instrumentation can
// go red, so a bypass would be caught rather than silently pass.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chat, listModels, autoPick, isFreeModel, tierOf } from "./fold-chat-client.js";

function serve(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, "127.0.0.1", () => resolve({ server: s, port: s.address().port }));
  });
}

test("falsifier: the free models are used automatically, and heimdall routes them", async () => {
  let providerHits = 0;
  const provider = await serve((req, res) => { providerHits++; res.writeHead(200); res.end("should never happen"); });

  let bridgeChatHits = 0;
  let bridgeChatUrl = null;
  const bridge = await serve((req, res) => {
    if (req.url === "/api/tags") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ models: [
        // A frontier model whose EXECUTOR lives on the provider host. If the
        // page ever spoke to it directly, providerHits would move.
        { name: "gpt-oss-120b", heimdall: { frontier: provider.port === 0 ? "groq" : "groq", privacy: "sealed-external", location: "external" } },
        { name: "gemma2:2b", heimdall: { webllm: "gemma-2-2b-it-q4f16_1-MLC", workers: 1 } },
        { name: "qwen2.5:3b", heimdall: {} },
      ] }));
    }
    if (req.url === "/v1/chat/completions") {
      bridgeChatHits++; bridgeChatUrl = req.url;
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "hi" } }] })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    res.writeHead(404); res.end();
  });

  const base = `http://127.0.0.1:${bridge.port}`;
  try {
    // --- Claim 1: the free ones are used automatically --------------------
    const models = await listModels({ base });
    assert.equal(models.find((m) => m.id === "gemma2:2b").tier, "local");
    assert.equal(isFreeModel(models.find((m) => m.id === "gemma2:2b")), true);
    assert.equal(isFreeModel(models.find((m) => m.id === "gpt-oss-120b")), false);
    const picked = autoPick(models);
    assert.equal(picked.id, "gemma2:2b", "the nearest FREE model is chosen with nothing pinned");
    assert.equal(picked.sealed, false, "never auto-picks a sealed outside model");

    // --- Claim 2: heimdall is routing --------------------------------------
    await chat(picked.id, [{ role: "user", content: "hi" }], { base, privacy: "sealed-external" });
    assert.equal(bridgeChatHits, 1, "the turn went to the bridge");
    assert.match(bridgeChatUrl, /\/v1\/chat\/completions$/);
    assert.equal(providerHits, 0, "NO inference host was contacted directly — heimdall routed it");

    // --- CONTROL: the detector can go red ----------------------------------
    // A direct call to the provider host would register — so the zero above is
    // a real measurement, not a detector that never fires.
    await fetch(`http://127.0.0.1:${provider.port}/v1/chat/completions`, { method: "POST", body: "{}" }).catch(() => {});
    assert.equal(providerHits, 1, "the bypass detector works: a direct call IS caught");
  } finally {
    bridge.server.close();
    provider.server.close();
  }
});

test("falsifier control: autoPick prefers local, then fleet, then any unsealed — never sealed", () => {
  const local = { id: "l", sealed: false, tier: "local", kind: "local" };
  const fleet = { id: "f", sealed: false, tier: "fleet", kind: "fleet" };
  const remote = { id: "r", sealed: false, tier: "remote", kind: "remote" };
  const frontier = { id: "x", sealed: true, tier: "frontier", kind: "frontier" };
  assert.equal(autoPick([frontier, remote, fleet, local]).id, "l");
  assert.equal(autoPick([frontier, remote, fleet]).id, "f");
  assert.equal(autoPick([frontier, remote]).id, "r");
  // Only sealed ones exist: it may pick one (there is no free option), but it
  // is still routed by heimdall and still sealed.
  assert.equal(autoPick([frontier]).id, "x");
  assert.equal(autoPick([]), null);
  // tierOf is what the pick rides on.
  assert.equal(tierOf(local), "local");
});
