// fold-chat-pageengine.test.mjs — the Fold with NO standalone bridge: the same-origin embedded heimdall is found first, the model
// runs IN THE TAB, and the app boots, lists in-tab models and answers with the bridge down.
//
// What this proves, against fakes (no GPU, no network, no model inference, ports only via port 0):
//   1. bridgeBase / detectBridge prefer `<origin>/heimdall`, fall back to the legacy local port, never strip or double the prefix;
//   2. listAllModels lists the tab's own models with the bridge down (and with no WebGPU says why), downloading nothing;
//   3. autoPick: loaded in-tab > downloaded in-tab > a bridge model that is up > the default in-tab model (selected, not fetched);
//   4. client.chat serves a `webllm:` model from the page engine with the bridge's own return/stream/abort/error contract, never
//      touches fetch, never claims sealed-external, never downloads without an approved question;
//   5. the footer/hint words (fold-chat-loaded.js) for a first load, a no-WebGPU device and a bridge-less boot;
//   6. no app code hard-codes the old standalone port outside the two named legacy allowances.
// What would prove it wrong: a same-origin server that is probed AFTER localhost:8790; a doubled `/heimdall/heimdall`; a page model
// absent from the list when the bridge is down; a chat to a page model that issues a fetch or carries heimdall_privacy; a model
// downloaded without a yes; a Stop that leaves the promise hanging; a new file in the app that names the old port.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as client from "./fold-chat-client.js";
import { createPageEngine, PageEngineError, MODEL_CHOICES, DEFAULT_MODEL, FALLBACK_MODEL, f32Variant } from "./fold-chat-webllm.js";
import { fetchLoaded, describeLoaded, noModelWhy, placeOf } from "./fold-chat-loaded.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = "http://127.0.0.1:8814";
const OWN = ORIGIN + "/heimdall";
const LOC = { protocol: "http:", origin: ORIGIN };
const GEMMA = "gemma-2-2b-it-q4f16_1-MLC";
const GPU_OK = { available: true, f16: true, reason: "ok" };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const json = (o, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => o });
const down = async () => { throw new Error("ECONNREFUSED"); };
const MSGS = [{ role: "user", content: "hi" }];

// ───────────────────────── 1. the bridge base ─────────────────────────

test("sameOriginBridge: <origin>/heimdall over http(s); null for an extension page, a file, or no location", () => {
  assert.equal(client.sameOriginBridge(LOC), OWN);
  assert.equal(client.sameOriginBridge({ protocol: "https:", origin: "https://fold.example" }), "https://fold.example/heimdall");
  assert.equal(client.sameOriginBridge({ protocol: "chrome-extension:", origin: "chrome-extension://abc" }), null);
  assert.equal(client.sameOriginBridge({ protocol: "file:", origin: "null" }), null);
  assert.equal(client.sameOriginBridge(undefined), null);
});

test("bridgeCandidates: the embedded same-origin heimdall FIRST, the legacy local port after; the extension has only the legacy ones", () => {
  assert.deepEqual(client.bridgeCandidates({ loc: LOC }), [OWN, "http://localhost:8790", "http://127.0.0.1:8790"]);
  // the extension (no same-origin heimdall): the Fold server's own local port BEFORE the legacy bridge ports
  assert.deepEqual(client.bridgeCandidates({ loc: { protocol: "chrome-extension:", origin: "chrome-extension://abc" } }), ["http://127.0.0.1:8814/heimdall", "http://localhost:8814/heimdall", "http://localhost:8790", "http://127.0.0.1:8790"]);
  assert.deepEqual(client.bridgeCandidates({ loc: { protocol: "https:", origin: "https://fold.example" } }), ["https://fold.example/heimdall", "http://localhost:8790", "http://127.0.0.1:8790"], "a served page does not guess 8814");
  assert.deepEqual([...client.BRIDGE_CANDIDATES], ["http://localhost:8790", "http://127.0.0.1:8790"]);
});

test("bridgeBase carries the /heimdall prefix: trailing slashes go, the prefix is neither stripped nor doubled", () => {
  assert.equal(client.bridgeBase(OWN), OWN);
  assert.equal(client.bridgeBase(OWN + "/"), OWN);
  assert.equal(client.bridgeBase(OWN + "///"), OWN);
  assert.equal(client.bridgeBase("http://localhost:8790/"), "http://localhost:8790");
  assert.ok(!/heimdall\/heimdall/.test(client.bridgeBase(OWN)));
});

test("every client call keeps its path and resolves UNDER the /heimdall prefix", async () => {
  const seen = [];
  const fetchImpl = async (url, opts = {}) => {
    seen.push(String(url));
    const u = new URL(url);
    if (u.pathname.endsWith("/v1/chat/completions")) return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n\n')); c.close(); } }) };
    return json({ models: [], entries: [], counts: {}, ok: true });
  };
  const base = OWN + "/";
  await client.listModels({ base, fetchImpl });
  await client.chat("gemma2:2b", MSGS, { base, fetchImpl });
  await client.meter({ base, fetchImpl });
  await client.ledger({ base, fetchImpl });
  await client.frontier({ base, fetchImpl });
  await client.listProviderKeys({ base, fetchImpl });
  await client.codeStatus({ base, fetchImpl });
  await client.code("x", { base, fetchImpl });
  await client.generate("x", { base, fetchImpl });
  await client.read("x", { base, fetchImpl });
  await client.reason({ claims: [] }, { base, fetchImpl });
  await client.agent("x", { base, fetchImpl });
  const paths = seen.map((u) => u.slice(ORIGIN.length));
  assert.deepEqual(paths, ["/heimdall/api/tags", "/heimdall/v1/chat/completions", "/heimdall/api/meter", "/heimdall/api/ledger", "/heimdall/api/frontier", "/heimdall/api/providers/keys", "/heimdall/api/code/status", "/heimdall/api/code", "/heimdall/api/weave", "/heimdall/api/read", "/heimdall/api/reason", "/heimdall/api/agent"]);
});

test("detectBridge prefers the same-origin embedded heimdall even when the old port also answers", async () => {
  const seen = [];
  const fetchImpl = async (url) => { seen.push(String(url)); return json({ bridge: true }); };
  const found = await client.detectBridge({ fetchImpl, loc: LOC });
  assert.equal(found.ok, true);
  assert.equal(found.base, OWN);
  assert.equal(seen[0], OWN + "/bridge/hello", "the same-origin heimdall is probed first");
  assert.ok(!seen.some((u) => u.includes("8790")), "the legacy port is never even asked once the embedded one answers");
});

test("detectBridge: same-origin /api/tags and then /status (an embedded heimdall whose floor is down still answers /status)", async () => {
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u === OWN + "/status") return json({ schema: "HeimdallEmbed@1", name: "the-fold", token: false });
    return json({}, 503);
  };
  const found = await client.detectBridge({ fetchImpl, loc: LOC });
  assert.deepEqual([found.ok, found.base, found.embedded], [true, OWN, true]);
  // a /status that is not heimdall's is not heimdall
  const notHeimdall = async (url) => (String(url).endsWith("/status") ? json({ schema: "something-else" }) : json({}, 404));
  assert.equal((await client.detectBridge({ fetchImpl: notHeimdall, loc: LOC })).ok, false);
});

test("detectBridge falls back to the legacy 8790 bridge when the same-origin path is not heimdall (GitHub Pages: 404)", async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    const u = String(url); seen.push(u);
    if (u.startsWith("http://127.0.0.1:8790/api/tags")) return json({ models: [] });
    return json({}, 404);
  };
  const found = await client.detectBridge({ fetchImpl, loc: { protocol: "https:", origin: "https://fold.example" } });
  assert.deepEqual([found.ok, found.base], [true, "http://127.0.0.1:8790"]);
  assert.equal(seen[0], "https://fold.example/heimdall/bridge/hello", "same-origin first");
  assert.ok(seen.findIndex((u) => u.startsWith("http://localhost:8790")) > 0, "the legacy ports come after");
});

test("detectBridge: nothing answers → not found, never a throw; the extension (no origin) tries the Fold server's local port, then the legacy ports", async () => {
  assert.deepEqual(await client.detectBridge({ fetchImpl: down, loc: LOC }), { ok: false, base: null, hello: null });
  const seen = [];
  await client.detectBridge({ fetchImpl: async (u) => { seen.push(String(u)); throw new Error("x"); }, loc: { protocol: "chrome-extension:", origin: "chrome-extension://abc" } });
  assert.ok(seen.length > 0 && seen.every((u) => u.includes(":8790") || u.includes(":8814/heimdall")));
  assert.ok(seen[0].startsWith("http://127.0.0.1:8814/heimdall/") && seen.findIndex((u) => u.includes(":8790")) > seen.findLastIndex((u) => u.includes(":8814")), "8814 first, legacy after");
});

test("a stored legacy-port override does not shadow the embedded heimdall; a custom override still wins", async () => {
  assert.equal(client.pickBridge("http://localhost:8790", { loc: LOC }), OWN);
  assert.equal(client.pickBridge("http://127.0.0.1:8790/", { loc: LOC }), OWN);
  assert.equal(client.pickBridge("http://my-box:9000/x", { loc: LOC }), "http://my-box:9000/x");
  assert.equal(client.pickBridge(null, { loc: LOC }), OWN);
  assert.equal(client.pickBridge("http://localhost:8790", { loc: { protocol: "https:", origin: "null" } }), "http://localhost:8790", "no same-origin heimdall: the legacy override is all there is");
  const seen = [];
  const fetchImpl = async (url) => { seen.push(String(url)); return json({ bridge: true }); };
  assert.equal((await client.detectBridge({ override: "http://localhost:8790", fetchImpl, loc: LOC })).base, OWN);
  seen.length = 0;
  assert.equal((await client.detectBridge({ override: "http://my-box:9000", fetchImpl, loc: LOC })).base, "http://my-box:9000");
});

// ───────────────────────── a fake web-llm module + a fake engine ─────────────────────────

function fakeWebLLM({ cachedIds = [], deltas = ["Hel", "lo", " wor", "ld"], gate = null, failIds = [] } = {}) {
  const calls = { create: [], interrupt: 0, requests: [], module: 0 };
  const makeEngine = (id) => {
    let interrupted = false;
    return {
      interruptGenerate() { interrupted = true; calls.interrupt++; },
      async unload() {},
      chat: { completions: { async create(req) {
        interrupted = false; calls.requests.push(req);
        return (async function* () {
          for (let i = 0; i < deltas.length; i++) {
            if (gate) await gate(i, () => interrupted);
            if (interrupted) { yield { choices: [{ delta: {}, finish_reason: "abort" }] }; return; }
            yield { choices: [{ delta: { content: deltas[i] }, finish_reason: null }] };
          }
          yield { choices: [{ delta: {}, finish_reason: "stop" }] };
        })();
      } } },
    };
  };
  const mod = {
    async CreateMLCEngine(id, cfg) {
      calls.create.push(id);
      cfg.initProgressCallback?.({ progress: 0.5, text: "Fetching param cache[2/4]" });
      await new Promise((r) => setImmediate(r));
      if (failIds.includes(id)) throw new Error("fake load failure");
      return makeEngine(id);
    },
    async CreateWebWorkerMLCEngine(_w, id, cfg) { return mod.CreateMLCEngine(id, cfg); },
    prebuiltAppConfig: { model_list: MODEL_CHOICES.flatMap((m) => [{ model_id: m.id }, { model_id: f32Variant(m.id) }]) },
    hasModelInCache: async (id) => cachedIds.includes(id),
  };
  return { mod, calls, loader: async () => { calls.module++; return mod; } };
}
const realEngine = (fake, extra = {}) => createPageEngine({ loader: fake.loader, makeWorker: null, gpu: GPU_OK, ...extra });

/** A hand-rolled engine with the same surface as createPageEngine, for the dispatch contract. */
function stubEngine({ loadedId = null, cached = false, deltas = ["A", "B", "C"], loadError = null, streamError = null, gate = null } = {}) {
  const st = { loadedId, loads: [], streams: [], aborted: false };
  return {
    st,
    isLoaded: () => st.loadedId != null,
    loadedId: () => st.loadedId,
    async cached() { return cached; },
    async load(id) { st.loads.push(id); if (loadError) throw loadError; st.loadedId = id; return { id }; },
    async *chatStream(messages, o = {}) {
      st.streams.push({ messages, o });
      if (streamError) throw streamError;
      for (let i = 0; i < deltas.length; i++) {
        if (gate) await gate(i);
        if (o.signal?.aborted) { st.aborted = true; return; }
        yield deltas[i];
      }
    },
  };
}
const noNetwork = async () => { throw new Error("a page model must never touch fetch"); };
const withEngine = async (engine, hooks, fn) => { client.setPageEngine(engine, hooks); try { return await fn(); } finally { client.setPageEngine(null); client.setPromptDoor(null); client.setAuditHook(null); } };

// ───────────────────────── 2. the tab's models are listed with the bridge DOWN ─────────────────────────

test("listAllModels: the bridge is down, the in-tab models are listed anyway — and nothing was downloaded to list them", async () => {
  const fake = fakeWebLLM();
  const eng = realEngine(fake, { storage: memStorage() });
  const all = await client.listAllModels({ base: OWN, fetchImpl: down, engine: eng });
  assert.equal(all.bridgeUp, false);
  assert.match(all.bridgeError, /ECONNREFUSED/);
  assert.equal(all.page.available, true);
  assert.equal(all.models.length, MODEL_CHOICES.length);
  const m = all.models.find((x) => x.id === "webllm:" + GEMMA);
  assert.deepEqual([m.kind, m.tier, m.location, m.sealed, m.default, m.cached, m.loaded, m.contextWindow], ["webllm-page", "local", "tab", false, true, false, false, 4096]);
  assert.match(m.sizeLabel, /^~1\.9 GB$/);
  assert.equal(fake.calls.module, 0, "listing never loads the library");
  assert.equal(fake.calls.create.length, 0, "listing never loads a model");
  assert.ok(all.models.every((x) => client.isChatModel(x) && client.isPageModel(x)), "each is a chat model the app may pick");
});

test("listAllModels: the tab's models come first, then the bridge's; an engine-less page (the extension) lists only the bridge", async () => {
  const fetchImpl = async () => json({ models: [{ name: "gemma2:2b", heimdall: {} }] });
  const eng = realEngine(fakeWebLLM());
  const all = await client.listAllModels({ base: OWN, fetchImpl, engine: eng });
  assert.equal(all.bridgeUp, true);
  assert.equal(all.models[0].kind, "webllm-page");
  assert.equal(all.models.at(-1).id, "gemma2:2b");
  const none = await client.listAllModels({ base: OWN, fetchImpl, engine: null });
  assert.deepEqual(none.models.map((m) => m.id), ["gemma2:2b"]);
  assert.deepEqual([none.page.available, none.page.reason], [false, "no-engine"]);
  const pageOnly = await client.listAllModels({ base: OWN, fetchImpl: noNetwork, engine: eng, bridge: false });
  assert.equal(pageOnly.models.length, MODEL_CHOICES.length, "the boot's first paint asks the bridge nothing");
});

test("listAllModels: a device with no WebGPU lists no in-tab model and carries the typed reason", async () => {
  const eng = createPageEngine({ loader: async () => ({}), makeWorker: null, gpu: { available: false, f16: false, reason: "no-webgpu" } });
  const all = await client.listAllModels({ base: OWN, fetchImpl: down, engine: eng });
  assert.deepEqual(all.models, []);
  assert.deepEqual([all.page.available, all.page.reason], [false, "no-webgpu"]);
});

test("a downloaded model is listed as cached; a loaded one as loaded", async () => {
  const storage = memStorage();
  const fake = fakeWebLLM({ cachedIds: [GEMMA] });   // the browser's cache holds it once the load has finished
  const eng = realEngine(fake, { storage });
  await eng.load(GEMMA);
  const all = await client.listAllModels({ base: OWN, fetchImpl: down, engine: eng });
  const g = all.models.find((m) => m.id === "webllm:" + GEMMA);
  assert.deepEqual([g.loaded, g.cached], [true, true]);
  assert.match(g.note, /loaded in this tab/);
});

// ───────────────────────── 3. autoPick order ─────────────────────────

const pg = (id, extra = {}) => ({ id: "webllm:" + id, kind: "webllm-page", tier: "local", sealed: false, loaded: false, cached: false, default: false, ...extra });
const GEMMA_PAGE = pg(GEMMA, { default: true });
const bridgeLocal = { id: "gemma2:2b", kind: "local", tier: "local", sealed: false };
const bridgeFrontier = { id: "gpt-x", kind: "frontier", tier: "frontier", sealed: true };

test("autoPick: loaded in-tab > downloaded in-tab > a bridge model that is up > the default in-tab model", () => {
  const loaded = pg("Qwen2.5-0.5B-Instruct-q4f16_1-MLC", { loaded: true, cached: true });
  const cached = pg("Llama-3.2-1B-Instruct-q4f16_1-MLC", { cached: true });
  assert.equal(client.autoPick([bridgeLocal, GEMMA_PAGE, cached, loaded]).id, loaded.id, "1: already loaded in this tab");
  assert.equal(client.autoPick([bridgeLocal, GEMMA_PAGE, cached]).id, cached.id, "2: already downloaded");
  assert.equal(client.autoPick([GEMMA_PAGE, pg("SmolLM2-360M-Instruct-q4f16_1-MLC"), bridgeLocal]).id, "gemma2:2b", "3: a bridge model that is up beats an in-tab model that must be fetched");
  assert.equal(client.autoPick([GEMMA_PAGE, pg("SmolLM2-360M-Instruct-q4f16_1-MLC")]).id, GEMMA_PAGE.id, "4: the default in-tab model — picked, not fetched");
  assert.equal(client.autoPick([pg("SmolLM2-360M-Instruct-q4f16_1-MLC"), GEMMA_PAGE]).id, GEMMA_PAGE.id, "the default wins whatever the list order");
});

test("autoPick: a sealed bridge model never beats a free in-tab default; with only sealed models it is still the old tail", () => {
  assert.equal(client.autoPick([bridgeFrontier, GEMMA_PAGE]).id, GEMMA_PAGE.id);
  assert.equal(client.autoPick([bridgeFrontier]).id, "gpt-x");
  assert.equal(client.autoPick([]), null);
  assert.equal(client.autoPick([{ id: "nomic-embed-text", kind: "local", tier: "local" }, GEMMA_PAGE]).id, GEMMA_PAGE.id, "an embedder never answers");
});

test("autoPick over a real listing picks the default in-tab model when nothing is downloaded and the bridge is down", async () => {
  const all = await client.listAllModels({ base: OWN, fetchImpl: down, engine: realEngine(fakeWebLLM(), { storage: memStorage() }) });
  const pick = client.autoPick(all.models);
  assert.equal(pick.id, "webllm:" + DEFAULT_MODEL);
  assert.equal(pick.cached, false);
  assert.equal(pick.sealed, false);
  assert.equal(client.tierOf(pick), "local");
  assert.equal(client.isFreeModel(pick), true);
});

// ───────────────────────── 4. chat dispatch to the page engine ─────────────────────────

test("chat to a page model: streams text from the engine, never touches fetch, and is 'in-tab', never sealed-external", async () => {
  const eng = stubEngine({ loadedId: GEMMA });
  const audits = [];
  await withEngine(eng, {}, async () => {
    client.setAuditHook({ before: (info) => { audits.push(info); return null; } });
    const got = [];
    const out = await client.chat("webllm:" + GEMMA, MSGS, { base: OWN, fetchImpl: noNetwork, privacy: "sealed-external", onToken: (t) => got.push(t), temperature: 0.2, maxTokens: 77 });
    assert.deepEqual(got, ["A", "B", "C"]);
    assert.equal(out.text, "ABC");
    assert.equal(out.tokens, 3);
    assert.deepEqual([out.place, out.privacy, out.model, out.fellBackFrom], ["tab", "in-tab", "webllm:" + GEMMA, null]);
    assert.ok(out.auditId);
    assert.equal(out.usage.completion_tokens, 3);
    assert.equal(eng.st.streams[0].o.temperature, 0.2);
    assert.equal(eng.st.streams[0].o.maxTokens, 77);
    assert.deepEqual(eng.st.streams[0].messages, MSGS);
    assert.equal(eng.st.loads.length, 0, "already loaded: no load, no question");
  });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].privacy, "in-tab", "the audit says where it ran");
  assert.ok(!JSON.stringify(audits[0]).includes("sealed-external"), "an in-tab turn is never labelled sealed-external");
});

test("chat to a page model: the prompt door still reads the messages first, and a refused call touches nothing", async () => {
  const eng = stubEngine({ loadedId: GEMMA });
  await withEngine(eng, {}, async () => {
    client.setPromptDoor((messages) => ({ messages: [...messages, { role: "system", content: "door-added" }] }));
    await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork });
    assert.equal(eng.st.streams[0].messages.at(-1).content, "door-added");
    client.setPromptDoor(() => ({ refused: [{ rule: "no-json" }] }));
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.status === 422 && /prompt door refused/.test(e.message));
    assert.equal(eng.st.streams.length, 1);
  });
});

test("a model that is not on this device is NEVER downloaded without a yes: no question hook means no download", async () => {
  const eng = stubEngine({ loadedId: null, cached: false });
  await withEngine(eng, {}, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.status === 428 && e.kind === "declined" && e.place === "tab" && /not downloaded/.test(e.message));
    assert.equal(eng.st.loads.length, 0);
  });
  // a "no" is a no
  const eng2 = stubEngine({ loadedId: null, cached: false });
  let asked = null;
  await withEngine(eng2, { confirmDownload: async (q) => { asked = q; return false; } }, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.kind === "declined");
    assert.equal(asked.id, GEMMA);
    assert.equal(eng2.st.loads.length, 0);
  });
});

test("the first send ASKS ONCE; a yes loads, then it answers, and the next send asks nothing", async () => {
  const eng = stubEngine({ loadedId: null, cached: false });
  let asks = 0;
  await withEngine(eng, { confirmDownload: async () => { asks++; return true; } }, async () => {
    const a = await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork });
    assert.equal(a.text, "ABC");
    assert.deepEqual(eng.st.loads, [GEMMA]);
    await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork });
    assert.equal(asks, 1);
    assert.equal(eng.st.loads.length, 1, "loaded once");
  });
});

test("a model already downloaded loads without a question; allowDownload:true is the caller's own yes", async () => {
  const cachedEng = stubEngine({ loadedId: null, cached: true });
  await withEngine(cachedEng, { confirmDownload: async () => { throw new Error("must not ask for a cached model"); } }, async () => {
    assert.equal((await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork })).text, "ABC");
    assert.deepEqual(cachedEng.st.loads, [GEMMA]);
  });
  const fresh = stubEngine({ loadedId: null, cached: false });
  await withEngine(fresh, {}, async () => {
    assert.equal((await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, allowDownload: true })).text, "ABC");
  });
});

test("Stop mid-stream: the promise rejects with AbortError, the engine is told, and no text is returned", async () => {
  const ctl = new AbortController();
  const eng = stubEngine({ loadedId: GEMMA, deltas: ["1", "2", "3", "4"], gate: async (i) => { if (i === 2) ctl.abort(); } });
  await withEngine(eng, {}, async () => {
    const got = [];
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, signal: ctl.signal, onToken: (t) => got.push(t) }), (e) => e.name === "AbortError");
    assert.deepEqual(got, ["1", "2"]);
    assert.equal(eng.st.aborted, true);
  });
  // already aborted before the call
  const pre = new AbortController(); pre.abort();
  await withEngine(stubEngine({ loadedId: GEMMA }), {}, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, signal: pre.signal }), (e) => e.name === "AbortError");
  });
});

test("Stop while the download question is open (or the load is running) releases the turn", async () => {
  const ctl = new AbortController();
  const eng = stubEngine({ loadedId: null, cached: false });
  await withEngine(eng, { confirmDownload: () => new Promise(() => {}) }, async () => {   // the person never answers
    const p = client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, signal: ctl.signal });
    setTimeout(() => ctl.abort(), 10);
    await assert.rejects(p, (e) => e.name === "AbortError");
    assert.equal(eng.st.loads.length, 0);
  });
  const ctl2 = new AbortController();
  const slow = stubEngine({ loadedId: null, cached: true });
  slow.load = () => new Promise(() => {});   // a load that never ends
  await withEngine(slow, {}, async () => {
    const p = client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, signal: ctl2.signal });
    setTimeout(() => ctl2.abort(), 10);
    await assert.rejects(p, (e) => e.name === "AbortError");
  });
});

test("typed errors: no WebGPU, a loader that cannot fetch, a model that will not load, a generation that fails — each with words and a status the notices read", async () => {
  const cases = [
    [new PageEngineError("no-gpu", "no WebGPU", { reason: "no-webgpu" }), 501, /no WebGPU \(no-webgpu\).*npm run serve/],
    [new PageEngineError("loader", "net down"), 502, /runtime could not be fetched.*network once/],
    [new PageEngineError("load-failed", "boom"), 500, /boom/],
  ];
  for (const [err, status, re] of cases) {
    const eng = stubEngine({ loadedId: null, cached: true, loadError: err });
    await withEngine(eng, {}, async () => {
      await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.status === status && e.kind === err.kind && re.test(e.message) && e.status !== 0 && e.status !== 403);
    });
  }
  const gen = stubEngine({ loadedId: GEMMA, streamError: new PageEngineError("generate-failed", "gpu lost") });
  await withEngine(gen, {}, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.status === 500 && e.kind === "generate-failed" && /gpu lost/.test(e.message));
  });
  // no engine registered at all (the extension): a typed, worded failure — not a TypeError
  await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.status === 501 && /WebGPU/.test(e.message));
});

test("a stalled generation hits the hard total timeout (504), like the bridge's", async () => {
  const eng = stubEngine({ loadedId: GEMMA, deltas: ["1", "2", "3"], gate: (i) => new Promise((r) => setTimeout(r, 40)) });
  eng.chatStream = async function* (_m, o) { await new Promise((r) => { o.signal.addEventListener("abort", r, { once: true }); }); };
  await withEngine(eng, {}, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, totalTimeoutMs: 30 }), (e) => e.status === 504 && /timed out/.test(e.message));
  });
});

test("through the REAL page engine (fake web-llm): load on a yes, stream, Stop, fall back to the small model and say so", async () => {
  const fake = fakeWebLLM({ gate: async (i, interrupted) => { await new Promise((r) => setImmediate(r)); } });
  const progress = [];
  const eng2 = realEngine(fake, { storage: memStorage(), onProgress: (p) => progress.push(p), drainMs: 20 });
  await withEngine(eng2, { confirmDownload: async () => true }, async () => {
    const out = await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork });
    assert.equal(out.text, "Hello world");
    assert.deepEqual(fake.calls.create, [GEMMA], "one load");
    assert.ok(progress.some((p) => p.phase === "download") && progress.at(-1).phase === "ready", "the engine's own progress reaches the app");
    assert.equal(fake.calls.requests[0].messages[0].content, "hi");
    // Stop through the real engine
    const ctl = new AbortController();
    const got = [];
    const p = client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, signal: ctl.signal, onToken: (t) => { got.push(t); if (got.length === 2) ctl.abort(); } });
    await assert.rejects(p, (e) => e.name === "AbortError");
    assert.ok(fake.calls.interrupt >= 1, "the generation was interrupted");
    // and the engine is usable again
    assert.equal((await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork })).text, "Hello world");
  });
  // the chosen model will not load: the fallback answers, and the result names what it fell back from
  const failing = fakeWebLLM({ failIds: [GEMMA], cachedIds: [FALLBACK_MODEL] });
  const eng3 = realEngine(failing, { storage: memStorage() });
  await withEngine(eng3, {}, async () => {
    const out = await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, allowDownload: true });
    assert.equal(out.model, "webllm:" + FALLBACK_MODEL);
    assert.equal(out.fellBackFrom, "webllm:" + GEMMA);
    assert.equal(out.text, "Hello world");
    // the NEXT turn with the same requested model: no re-ask, no reload of the failed model, still answered by the fallback
    const again = await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, confirmDownload: async () => { throw new Error("must not ask again"); } });
    assert.equal(again.model, "webllm:" + FALLBACK_MODEL);
    assert.equal(again.fellBackFrom, "webllm:" + GEMMA);
    assert.deepEqual(failing.calls.create, [GEMMA, FALLBACK_MODEL], "the failed model was not retried and the fallback not reloaded");
  });
});

test("a failed load whose fallback is NOT on the device is a typed error to the app, and the fallback is never fetched", async () => {
  const failing = fakeWebLLM({ failIds: [GEMMA], cachedIds: [] });
  const eng = realEngine(failing, { storage: memStorage() });
  await withEngine(eng, {}, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, allowDownload: true }), (e) => e.kind === "load-failed" && e.status === 500 && e.place === "tab" && /fallback/.test(e.message));
    assert.deepEqual(failing.calls.create, [GEMMA]);
  });
});

test("NO GPU is decided FIRST: before the cache probe (a 6 MB library fetch) and before the download question", async () => {
  const eng = stubEngine({ loadedId: null, cached: false });
  eng.gpu = async () => ({ available: false, f16: false, reason: "no-webgpu" });
  eng.cached = async () => { throw new Error("cached() must not be probed on a device with no GPU"); };
  eng.load = async () => { throw new Error("load() must not be called"); };
  await withEngine(eng, { confirmDownload: async () => { throw new Error("no download toast on a device with no GPU"); } }, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.status === 501 && e.kind === "no-gpu" && e.reason === "no-webgpu" && /WebGPU/.test(e.message));
  });
  // a device with a GPU goes on to the usual path (the question is asked)
  const ok = stubEngine({ loadedId: null, cached: false });
  ok.gpu = async () => ({ available: true, f16: true, reason: "ok" });
  let asked = 0;
  await withEngine(ok, { confirmDownload: async () => { asked++; return true; } }, async () => {
    assert.equal((await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork })).text, "ABC");
    assert.equal(asked, 1);
  });
});

test("a stream the engine ended with finish 'abort' (nobody asked) is an error, not a complete answer; 'length' is returned like the bridge path", async () => {
  const mk = (finish) => {
    const eng = stubEngine({ loadedId: GEMMA });
    eng.chatStream = async function* (_m, o = {}) { yield "par"; yield "tial"; if (o.meta) o.meta.finish = finish; };
    return eng;
  };
  await withEngine(mk("abort"), {}, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork }), (e) => e.status === 500 && e.kind === "generate-failed" && /replaced mid-answer/.test(e.message));
  });
  await withEngine(mk("length"), {}, async () => {
    const out = await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork });
    assert.equal(out.text, "partial");
  });
  await withEngine(mk("stop"), {}, async () => { assert.equal((await client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork })).text, "partial"); });
  // the person's Stop is still an AbortError (not the replaced-mid-answer error)
  const stop = mk("abort");
  const ctl = new AbortController();
  stop.chatStream = async function* (_m, o = {}) { yield "x"; ctl.abort(); if (o.meta) o.meta.finish = "abort"; };
  await withEngine(stop, {}, async () => {
    await assert.rejects(client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, signal: ctl.signal }), (e) => e.name === "AbortError");
  });
});

test("through the REAL engine: a model switch under a running answer ends the turn with the replaced-mid-answer error, never a truncated 'complete' answer", async () => {
  const fake = fakeWebLLM({ deltas: ["a", "b", "c", "d"], gate: async (i, interrupted) => { if (i === 1) { for (let k = 0; k < 200 && !interrupted(); k++) await new Promise((r) => setTimeout(r, 2)); } } });
  const eng = realEngine(fake, { storage: memStorage(), drainMs: 30 });
  await withEngine(eng, {}, async () => {
    await eng.load(GEMMA);
    let switched = null;
    const turn = client.chat("webllm:" + GEMMA, MSGS, { fetchImpl: noNetwork, onToken: () => { if (!switched) switched = eng.load(FALLBACK_MODEL); } });
    await assert.rejects(turn, (e) => e.kind === "generate-failed" && e.status === 500 && /replaced mid-answer/.test(e.message));
    await switched;
    assert.equal(eng.loadedId(), FALLBACK_MODEL);
  });
});

test("a bridge model still goes over the wire exactly as before (sealed-external gate and all)", async () => {
  const bodies = [];
  const fetchImpl = async (url, opts) => {
    bodies.push({ url: String(url), body: JSON.parse(opts.body) });
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n')); c.close(); } }) };
  };
  await withEngine(stubEngine({ loadedId: GEMMA }), {}, async () => {
    const out = await client.chat("gpt-oss-120b", MSGS, { base: OWN, fetchImpl, privacy: "sealed-external" });
    assert.equal(out.text, "ok");
  });
  assert.equal(bodies[0].url, OWN + "/v1/chat/completions");
  assert.equal(bodies[0].body.heimdall_privacy, "sealed-external");
  assert.ok(client.isPageModel("webllm:x") && !client.isPageModel("gemma2:2b") && client.isPageModel({ kind: "webllm-page", id: "q" }));
});

// ───────────────────────── 5. the footer and the hint ─────────────────────────

test("footer: a first load shows percent, text and where it lives; the loaded model is 'this tab (WebLLM)'", async () => {
  const loading = describeLoaded({ bridge: "down", entries: [], page: { available: true, reason: "ok", entries: [], loading: { id: GEMMA, name: "Gemma 2 2B", progress: 0.43, text: "Fetching param cache[3/24]", phase: "download" } } });
  assert.equal(loading.kind, "loading");
  assert.match(loading.text, /downloading Gemma 2 2B · 43% · in this tab \(WebLLM\)/);
  assert.match(loading.title, /Fetching param cache\[3\/24\]/);
  assert.match(loading.title, /Nothing leaves the tab/);
  // loaded, with the bridge down: shown as loaded in this tab, not "no model reachable"
  const st = await fetchLoaded({ base: OWN, fetchImpl: down, page: { available: true, reason: "ok", entries: [{ id: "gemma2:2b", ctx: 4096 }], loading: null } });
  assert.equal(st.bridge, "down");
  assert.deepEqual(st.entries.map((e) => [e.id, e.place, e.ctx]), [["gemma2:2b", "this tab (WebLLM)", 4096]]);
  const d = describeLoaded(st);
  assert.equal(d.kind, "loaded");
  assert.equal(d.text, "gemma2:2b (this tab) loaded");
  assert.match(d.title, /this tab \(WebLLM\)/);
  assert.equal(placeOf({ name: "x", heimdall: { webllm: true } }, "bridge"), "browser tab (WebLLM)", "the heimdall-tab label is kept");
  assert.equal(placeOf({ id: "x" }, "page"), "this tab (WebLLM)");
});

test("footer: bridge down and an idle in-tab engine is calm; a device with no WebGPU says so and offers a WebGPU browser or the Fold's own server", () => {
  const idle = describeLoaded({ bridge: "down", entries: [], errors: ["x"], page: { available: true, reason: "ok", entries: [], loading: null } });
  assert.equal(idle.kind, "idle");
  assert.match(idle.text, /no model loaded in this tab/);
  const noGpu = describeLoaded({ bridge: "down", entries: [], errors: [], page: { available: false, reason: "no-webgpu", entries: [], loading: null } });
  assert.equal(noGpu.kind, "down");
  assert.match(noGpu.text, /no WebGPU here/);
  assert.match(noGpu.title, /WebGPU browser or the Fold's own server/); assert.doesNotMatch(noGpu.title, /extension/);
  // the bridge is UP but serves nothing, and the tab can run a model: that is not "no chat model" — the first ask loads one here
  const empty = describeLoaded({ bridge: "up", entries: [], servable: 0, page: { available: true, reason: "ok", entries: [], loading: null } });
  assert.equal(empty.kind, "idle");
  assert.match(empty.text, /no model loaded in this tab/);
  assert.equal(describeLoaded({ bridge: "up", entries: [], servable: 0, page: { available: false, reason: "no-webgpu", entries: [], loading: null } }).kind, "empty");
  // the old behaviour is untouched when the page says nothing
  assert.equal(describeLoaded({ bridge: "down", entries: [] }).text, "no model reachable — Sources only still works");
});

test("noModelWhy: an in-tab model means the bridge being down is not why there is no model; no WebGPU and no bridge is", () => {
  const tab = [{ id: "webllm:" + GEMMA, kind: "webllm-page" }];
  assert.equal(noModelWhy({ bridgeUp: false, models: tab }).code, "ok");
  assert.equal(noModelWhy({ bridgeUp: false, models: tab, selectedId: "gemma2:2b" }).code, "selected-missing");
  const w = noModelWhy({ bridgeUp: false, models: [], page: { available: false, reason: "no-webgpu" } });
  assert.equal(w.code, "no-webgpu");
  assert.match(w.text, /no WebGPU \(no-webgpu\).*npm run serve/); assert.doesNotMatch(w.text, /extension/);
  assert.equal(noModelWhy({ bridgeUp: false, models: [], page: { available: false, reason: "no-engine" } }).code, "bridge-down", "the extension has no engine; that is not a WebGPU fault");
  assert.equal(noModelWhy({ bridgeUp: false }).code, "bridge-down");
  assert.match(noModelWhy({ bridgeUp: false }).text, /bridge isn't reachable/);
});

// ───────────────────────── 6. no hard-coded standalone port in app code ─────────────────────────

test("no app code names the old standalone port, except the two named legacy allowances", () => {
  const SKIP_DIRS = new Set(["node_modules", "eval", "docs", "dist", "experiments", "test-support", ".git", ".claude"]);
  const SKIP_FILE = (f) => /\.test\.mjs$/.test(f) || /^fold-e2e-.*\.mjs$/.test(f) || f === "fold-ext-e2e.mjs" || f === "ground-dbg.mjs" || f === "package-lock.json" || /\.md$/i.test(f);
  // The legacy bridge is a LATER fallback in the client (GitHub Pages / extension), and the exit gate trusts it for the extension.
  const ALLOWED = new Set(["fold-chat-client.js", "fold-chat-exit.js"]);
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(full); continue; }
      if (!/\.(m?js|html|css|json)$/.test(e.name) || SKIP_FILE(e.name)) continue;
      if (fs.readFileSync(full, "utf8").includes("8790") && !ALLOWED.has(path.relative(HERE, full))) hits.push(path.relative(HERE, full));
    }
  };
  walk(HERE);
  assert.deepEqual(hits, [], "these files hard-code the old bridge port: use client.bridgeBase()/detectBridge()");
  // and the allowances really are the legacy list, after the embedded one
  const src = fs.readFileSync(path.join(HERE, "fold-chat-client.js"), "utf8");
  assert.ok(src.indexOf("sameOriginBridge(loc)") < src.indexOf("...LEGACY_BRIDGES]"), "the same-origin candidate is built before the legacy ones");
});
