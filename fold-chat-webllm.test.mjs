// fold-chat-webllm.test.mjs — the in-page WebLLM provider against a FAKE loader/engine (no GPU, no network).
// Run: node --test fold-chat-webllm.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import {
  WEBLLM_VERSION, WEBLLM_ESM_URL, MODEL_CHOICES, DEFAULT_MODEL, FALLBACK_MODEL, OLLAMA_TAG, f32Variant, ollamaTagOf,
  canonicalModelId, gpuStatus, createPageEngine, pageModels, PageEngineError,
} from "./fold-chat-webllm.js";

const GEMMA = "gemma-2-2b-it-q4f16_1-MLC";
const GPU_OK = { available: true, f16: true, reason: "ok" };
const GPU_F32 = { available: true, f16: false, reason: "ok" };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

// A fake web-llm module. Records every call so the tests can see what the engine did.
function fakeWebLLM({ failIds = [], deltas = ["Hel", "lo", " wor", "ld"], gate = null, cachedIds = [], withCache = true } = {}) {
  const calls = { create: [], worker: [], unload: [], interrupt: 0, requests: [] };
  const makeEngine = (id, cfg) => {
    let interrupted = false;
    const eng = {
      id,
      interruptGenerate() { interrupted = true; calls.interrupt++; },
      async unload() { calls.unload.push(id); },
      chat: {
        completions: {
          async create(req) {
            interrupted = false; // like web-llm: a new generation clears the previous interrupt
            calls.requests.push(req);
            return (async function* () {
              for (let i = 0; i < deltas.length; i++) {
                if (gate) await gate(i, () => interrupted);
                if (interrupted) { yield { choices: [{ delta: {}, finish_reason: "abort" }] }; return; }
                yield { choices: [{ delta: { content: deltas[i] }, finish_reason: null }] };
              }
              yield { choices: [{ delta: {}, finish_reason: "stop" }] };
              yield { choices: [], usage: { completion_tokens: deltas.length } };
            })();
          },
        },
      },
    };
    return eng;
  };
  const build = async (id, cfg) => {
    calls.create.push(id);
    cfg.initProgressCallback?.({ progress: 0.25, text: "Fetching param cache[1/4]: 10MB fetched." });
    cfg.initProgressCallback?.({ progress: 0.9, text: "Loading GPU shader modules[3/4]: 90% completed." });
    await new Promise((r) => setImmediate(r));
    if (failIds.includes(id)) throw new Error("fake load failure " + id);
    return makeEngine(id, cfg);
  };
  const mod = {
    async CreateMLCEngine(id, cfg) { return build(id, cfg); },
    async CreateWebWorkerMLCEngine(worker, id, cfg) { calls.worker.push(worker); return build(id, cfg); },
    prebuiltAppConfig: { model_list: MODEL_CHOICES.flatMap((m) => [{ model_id: m.id }, { model_id: f32Variant(m.id) }]) },
  };
  if (withCache) mod.hasModelInCache = async (id) => cachedIds.includes(id);
  return { mod, calls };
}
const engineWith = (fake, extra = {}) => createPageEngine({ loader: async () => fake.mod, makeWorker: null, gpu: GPU_OK, ...extra });
const collect = async (iter) => { const out = []; for await (const d of iter) out.push(d); return out; };
const MSGS = [{ role: "user", content: "hi" }];

test("constants: pinned version and URL, default and fallback ids, tags", () => {
  assert.equal(WEBLLM_VERSION, "0.2.85");
  assert.ok(WEBLLM_ESM_URL.includes(`web-llm@${WEBLLM_VERSION}`) && WEBLLM_ESM_URL.endsWith("/+esm"));
  assert.equal(DEFAULT_MODEL, GEMMA);
  assert.equal(FALLBACK_MODEL, "Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
  assert.ok(MODEL_CHOICES.some((m) => m.id === FALLBACK_MODEL));
  assert.equal(MODEL_CHOICES.find((m) => m.id === GEMMA).tag, "gemma2:2b");
  assert.ok(MODEL_CHOICES.every((m) => m.tag && /^~/.test(m.sizeLabel) && m.sizeMB > 0));
  assert.equal(f32Variant(GEMMA), "gemma-2-2b-it-q4f32_1-MLC");
  assert.equal(ollamaTagOf("gemma-2-2b-it-q4f32_1-MLC"), "gemma2:2b");
  assert.equal(canonicalModelId("webllm:" + GEMMA), GEMMA);
  assert.equal(canonicalModelId("gemma-2-2b-it-q4f32_1-MLC"), GEMMA);
});

test("the worker imports the same pinned URL the page uses", () => {
  const src = fs.readFileSync(new URL("./fold-webllm-worker.js", import.meta.url), "utf8");
  assert.ok(src.includes(`from "${WEBLLM_ESM_URL}"`), "worker import must equal WEBLLM_ESM_URL");
  assert.ok(src.includes("WebWorkerMLCEngineHandler"));
});

test("tables agree with heimdall's models.js / llm.js when that checkout is on disk (drift guard)", async (t) => {
  const dir = new URL("../heimdall/src/", import.meta.url);
  if (!fs.existsSync(new URL("models.js", dir))) return t.skip("heimdall checkout not present");
  const hm = await import(new URL("models.js", dir).href);
  for (const m of MODEL_CHOICES) {
    assert.equal(m.tag, hm.ollamaTagOf(m.id), m.id);
    assert.equal(f32Variant(m.id), hm.f32Variant(m.id), m.id);
    assert.equal(ollamaTagOf(f32Variant(m.id)), hm.ollamaTagOf(f32Variant(m.id)), m.id);
  }
  const src = fs.readFileSync(new URL("llm.js", dir), "utf8");
  for (const m of MODEL_CHOICES) assert.ok(src.includes(`"${m.id}"`), `heimdall llm.js lacks ${m.id}`);
  assert.ok(src.includes(`FALLBACK_MODEL = "${FALLBACK_MODEL}"`));
  assert.ok(Object.keys(OLLAMA_TAG).length === MODEL_CHOICES.length);
});

// ---- gpuStatus ---------------------------------------------------------------------------------------------------------------

test("gpuStatus: no-webgpu / no-adapter / f16 true / f16 false, and it never throws", async () => {
  assert.deepEqual(await gpuStatus({ nav: {} }), { available: false, f16: false, reason: "no-webgpu" });
  assert.deepEqual(await gpuStatus({ nav: null }), { available: false, f16: false, reason: "no-webgpu" });
  assert.deepEqual(await gpuStatus({ nav: { gpu: { requestAdapter: async () => null } } }), { available: false, f16: false, reason: "no-adapter" });
  assert.deepEqual(await gpuStatus({ nav: { gpu: { requestAdapter: async () => { throw new Error("boom"); } } } }), { available: false, f16: false, reason: "no-adapter" });
  const adapter = (feats) => ({ gpu: { requestAdapter: async () => ({ features: new Set(feats) }) } });
  assert.deepEqual(await gpuStatus({ nav: adapter(["shader-f16"]) }), { available: true, f16: true, reason: "ok" });
  assert.deepEqual(await gpuStatus({ nav: adapter([]) }), { available: true, f16: false, reason: "ok" });
});

test("f32 variant is what gets built when the adapter lacks shader-f16; the app still sees the canonical id", async () => {
  const fake = fakeWebLLM();
  const eng = engineWith(fake, { gpu: GPU_F32 });
  const r = await eng.load(GEMMA);
  assert.deepEqual(fake.calls.create, ["gemma-2-2b-it-q4f32_1-MLC"]);
  assert.equal(r.id, GEMMA);
  assert.equal(r.runnableId, "gemma-2-2b-it-q4f32_1-MLC");
  assert.equal(eng.loadedId(), GEMMA);
  const f16 = fakeWebLLM();
  await engineWith(f16).load(GEMMA);
  assert.deepEqual(f16.calls.create, [GEMMA]);
});

test("load without WebGPU is a typed no-gpu error and builds nothing", async () => {
  const fake = fakeWebLLM();
  const eng = engineWith(fake, { gpu: { available: false, f16: false, reason: "no-webgpu" } });
  await assert.rejects(eng.load(GEMMA), (e) => e instanceof PageEngineError && e.kind === "no-gpu" && e.reason === "no-webgpu");
  assert.equal(fake.calls.create.length, 0);
});

// ---- load --------------------------------------------------------------------------------------------------------------------

test("progress callback sequence: module, download, init, ready; resolves once", async () => {
  const fake = fakeWebLLM();
  const seen = [];
  const eng = engineWith(fake, { onProgress: (p) => seen.push(p) });
  const r = await eng.load(GEMMA);
  assert.equal(r.fellBackFrom, null);
  assert.deepEqual(seen.map((p) => p.phase), ["module", "download", "init", "ready"]);
  assert.deepEqual(seen.map((p) => p.progress), [0, 0.25, 0.9, 1]);
  assert.ok(seen.every((p) => typeof p.text === "string"));
  assert.ok(eng.isLoaded());
});

test("importing/creating does not touch the library; nothing loads until load()", async () => {
  let loaderCalls = 0;
  const fake = fakeWebLLM();
  const eng = createPageEngine({ loader: async () => { loaderCalls++; return fake.mod; }, makeWorker: null, gpu: GPU_OK });
  await eng.status(); eng.models(); await eng.cached(GEMMA);
  assert.equal(loaderCalls, 0);
  await eng.load(GEMMA);
  assert.equal(loaderCalls, 1);
});

test("concurrent load() for the same model shares one promise and one download", async () => {
  const fake = fakeWebLLM();
  const eng = engineWith(fake);
  const a = eng.load(GEMMA);
  const b = eng.load("webllm:" + GEMMA);
  assert.equal(a, b);
  const [ra, rb] = await Promise.all([a, b]);
  assert.deepEqual(ra, rb);
  assert.equal(fake.calls.create.length, 1);
  // already loaded: resolves without touching the library again
  await eng.load(GEMMA);
  assert.equal(fake.calls.create.length, 1);
});

test("a second model unloads the first", async () => {
  const fake = fakeWebLLM();
  const eng = engineWith(fake);
  await eng.load(GEMMA);
  await eng.load(FALLBACK_MODEL);
  assert.deepEqual(fake.calls.unload, [GEMMA]);
  assert.equal(eng.loadedId(), FALLBACK_MODEL);
  assert.deepEqual(fake.calls.create, [GEMMA, FALLBACK_MODEL]);
  // switching while the first is still loading queues in order and still ends with only the last loaded
  const fake2 = fakeWebLLM();
  const e2 = engineWith(fake2);
  const p1 = e2.load(GEMMA); const p2 = e2.load(FALLBACK_MODEL);
  await Promise.all([p1, p2]);
  assert.deepEqual(fake2.calls.unload, [GEMMA]);
  assert.equal(e2.loadedId(), FALLBACK_MODEL);
});

test("a model that fails to load falls back ONCE (the fallback is already on the device) and the result says so", async () => {
  const fake = fakeWebLLM({ failIds: [GEMMA], cachedIds: [FALLBACK_MODEL] });
  const seen = [];
  const eng = engineWith(fake, { onProgress: (p) => seen.push(p.phase) });
  const r = await eng.load(GEMMA);
  assert.equal(r.id, FALLBACK_MODEL);
  assert.equal(r.fellBackFrom, GEMMA);
  assert.deepEqual(fake.calls.create, [GEMMA, FALLBACK_MODEL]);
  assert.ok(seen.includes("fallback"));
  assert.equal(eng.loadedId(), FALLBACK_MODEL);
  assert.equal((await eng.status()).fellBackFrom, GEMMA);
  const out = await eng.chat(MSGS);
  assert.equal(out.text, "Hello world");
});

test("fallback happens once: when the fallback fails too, a typed load-failed error and a usable engine", async () => {
  const fake = fakeWebLLM({ failIds: [GEMMA, FALLBACK_MODEL], cachedIds: [FALLBACK_MODEL] });
  const eng = engineWith(fake);
  await assert.rejects(eng.load(GEMMA), (e) => e.kind === "load-failed" && e.modelId === GEMMA && !!e.fallbackCause);
  assert.equal(fake.calls.create.length, 2);
  assert.equal(eng.isLoaded(), false);
  await assert.rejects(eng.chat(MSGS), (e) => e.kind === "not-loaded");
  // asking for the fallback model itself that fails does not retry itself
  const f2 = fakeWebLLM({ failIds: [FALLBACK_MODEL] });
  await assert.rejects(engineWith(f2).load(FALLBACK_MODEL), (e) => e.kind === "load-failed");
  assert.equal(f2.calls.create.length, 1);
});

test("a loader that throws is a typed error and leaves the engine usable (not wedged)", async () => {
  let n = 0;
  const fake = fakeWebLLM();
  const eng = createPageEngine({ loader: async () => { if (n++ === 0) throw new Error("cdn down"); return fake.mod; }, makeWorker: null, gpu: GPU_OK });
  await assert.rejects(eng.load(GEMMA), (e) => e instanceof PageEngineError && e.kind === "loader");
  assert.equal(eng.isLoaded(), false);
  await assert.rejects(eng.chat(MSGS), (e) => e.kind === "not-loaded");
  const r = await eng.load(GEMMA); // retried, not cached as a failure
  assert.equal(r.id, GEMMA);
  assert.equal(n, 2);
  assert.equal((await eng.chat(MSGS)).text, "Hello world");
});

test("a failed model load does not wedge the load queue", async () => {
  const fake = fakeWebLLM({ failIds: [GEMMA, FALLBACK_MODEL] });
  const eng = engineWith(fake);
  await assert.rejects(eng.load(GEMMA));
  fake.mod.CreateMLCEngine = async (id, cfg) => { fake.calls.create.push(id); return { id, interruptGenerate() {}, async unload() {}, chat: { completions: { async create() { return (async function* () { yield { choices: [{ delta: { content: "ok" } }] }; })(); } } } }; };
  const r = await eng.load("Qwen3-1.7B-q4f16_1-MLC");
  assert.equal(r.id, "Qwen3-1.7B-q4f16_1-MLC");
});

// ---- chat --------------------------------------------------------------------------------------------------------------------

test("chat before load is a typed not-loaded error, from chat() and from chatStream()", async () => {
  const eng = engineWith(fakeWebLLM());
  await assert.rejects(eng.chat(MSGS), (e) => e instanceof PageEngineError && e.kind === "not-loaded");
  await assert.rejects(collect(eng.chatStream(MSGS)), (e) => e.kind === "not-loaded");
});

test("streaming deltas arrive in order; chat() joins them with tokens and finish; options are passed through", async () => {
  const fake = fakeWebLLM();
  const eng = engineWith(fake);
  await eng.load(GEMMA);
  assert.deepEqual(await collect(eng.chatStream(MSGS, { maxTokens: 64, temperature: 0.2, top_p: 0.9 })), ["Hel", "lo", " wor", "ld"]);
  const req = fake.calls.requests[0];
  assert.equal(req.stream, true); assert.equal(req.max_tokens, 64); assert.equal(req.temperature, 0.2); assert.equal(req.top_p, 0.9);
  assert.deepEqual(req.messages, MSGS);
  const r = await eng.chat(MSGS);
  assert.deepEqual(r, { text: "Hello world", tokens: 4, finish: "stop" });
});

test("chat rejects an empty messages array as bad-request", async () => {
  const eng = engineWith(fakeWebLLM());
  await eng.load(GEMMA);
  await assert.rejects(eng.chat([]), (e) => e.kind === "bad-request");
});

test("abort mid-stream calls interruptGenerate, ends cleanly with finish abort, and the engine stays usable", async () => {
  const ac = new AbortController();
  const fake = fakeWebLLM({ gate: async (i) => { if (i === 2) { ac.abort(); await new Promise((r) => setImmediate(r)); } } });
  const eng = engineWith(fake);
  await eng.load(GEMMA);
  const text = await eng.chat(MSGS, { signal: ac.signal });
  assert.equal(text.finish, "abort");
  assert.equal(text.text, "Hello"); // "Hel", "lo" delivered; nothing after the abort
  assert.equal(fake.calls.interrupt, 1);
  // the next generation (no signal) completes normally
  const again = await eng.chat(MSGS);
  assert.equal(again.finish, "stop");
});

test("abort before the stream starts yields nothing and never calls the engine", async () => {
  const fake = fakeWebLLM();
  const eng = engineWith(fake);
  await eng.load(GEMMA);
  const ac = new AbortController(); ac.abort();
  assert.deepEqual(await collect(eng.chatStream(MSGS, { signal: ac.signal })), []);
  assert.equal(fake.calls.requests.length, 0);
  assert.equal((await eng.chat(MSGS, { signal: ac.signal })).finish, "abort");
});

test("abort ends the stream even when the engine never acknowledges the interrupt", async () => {
  const ac = new AbortController();
  const hang = new Promise(() => {});
  const fake = fakeWebLLM({ gate: async (i) => { if (i === 1) { setImmediate(() => ac.abort()); await hang; } } });
  const eng = engineWith(fake, { drainMs: 5 });
  await eng.load(GEMMA);
  const r = await eng.chat(MSGS, { signal: ac.signal });
  assert.equal(r.finish, "abort");
  assert.equal(r.text, "Hel");
});

test("a consumer that stops reading interrupts the generation and frees the engine for the next one", async () => {
  const fake = fakeWebLLM();
  const eng = engineWith(fake);
  await eng.load(GEMMA);
  for await (const d of eng.chatStream(MSGS)) { assert.equal(d, "Hel"); break; }
  assert.equal(fake.calls.interrupt, 1);
  assert.equal((await eng.chat(MSGS)).text, "Hello world");
});

test("generations are serialized on one engine", async () => {
  let release;
  const gateOpen = new Promise((r) => { release = r; });
  const order = [];
  const fake = fakeWebLLM({ deltas: ["a", "b"], gate: async (i) => { if (i === 0) await gateOpen; } });
  const eng = engineWith(fake);
  await eng.load(GEMMA);
  const p1 = eng.chat(MSGS).then((r) => order.push("1:" + r.text));
  const p2 = eng.chat(MSGS).then((r) => order.push("2:" + r.text));
  await new Promise((r) => setImmediate(r));
  assert.equal(fake.calls.requests.length, 1, "the second waits for the first");
  release();
  await Promise.all([p1, p2]);
  assert.deepEqual(order, ["1:ab", "2:ab"]);
});

test("a stream that throws mid-answer is a typed generate-failed and releases the engine", async () => {
  // the first create() returns a stream that throws after one delta; the next one is fine
  let first = true;
  const loaderMod = fakeWebLLM();
  const e2 = createPageEngine({ loader: async () => ({ ...loaderMod.mod, CreateMLCEngine: async (id) => ({
    interruptGenerate() {}, async unload() {},
    chat: { completions: { async create() {
      const boom = first; first = false;
      return (async function* () { yield { choices: [{ delta: { content: "x" } }] }; if (boom) throw new Error("gpu lost"); })();
    } } },
  }) }), makeWorker: null, gpu: GPU_OK });
  await e2.load(GEMMA);
  await assert.rejects(e2.chat(MSGS), (e) => e.kind === "generate-failed");
  assert.equal((await e2.chat(MSGS)).text, "x");
});

// ---- worker, unload, cache, models ------------------------------------------------------------------------------------------

test("a Worker is used through CreateWebWorkerMLCEngine when makeWorker provides one; terminated on unload", async () => {
  const fake = fakeWebLLM();
  let terminated = 0;
  const worker = { terminate() { terminated++; } };
  const eng = createPageEngine({ loader: async () => fake.mod, makeWorker: () => worker, gpu: GPU_OK });
  await eng.load(GEMMA);
  assert.deepEqual(fake.calls.worker, [worker]);
  assert.equal((await eng.status()).worker, true);
  await eng.unload();
  assert.equal(terminated, 1);
  assert.deepEqual(fake.calls.unload, [GEMMA]);
  assert.equal(eng.isLoaded(), false);
  assert.equal(eng.loadedId(), null);
  await assert.rejects(eng.chat(MSGS), (e) => e.kind === "not-loaded");
});

test("makeWorker null runs on the main thread; a makeWorker that throws falls back to it", async () => {
  const a = fakeWebLLM();
  await engineWith(a).load(GEMMA);
  assert.equal(a.calls.worker.length, 0);
  const b = fakeWebLLM();
  const eng = createPageEngine({ loader: async () => b.mod, makeWorker: () => { throw new Error("no module workers"); }, gpu: GPU_OK });
  await eng.load(GEMMA);
  assert.equal(b.calls.worker.length, 0);
  assert.equal((await eng.status()).worker, false);
});

test("cached(): hint from storage before the library is loaded; hasModelInCache when it is; probe asks the library", async () => {
  const storage = memStorage();
  const fake = fakeWebLLM({ cachedIds: ["Qwen3-1.7B-q4f16_1-MLC"] });
  let loads = 0;
  const mk = () => createPageEngine({ loader: async () => { loads++; return fake.mod; }, makeWorker: null, gpu: GPU_OK, storage });
  const eng = mk();
  assert.equal(await eng.cached(GEMMA), false);
  assert.equal(loads, 0, "cached() does not load the library by itself");
  await eng.load(GEMMA);
  assert.equal(await eng.cached(GEMMA), false, "the library is asked once it is loaded: the fake cache does not hold gemma");
  assert.equal(await eng.cached("Qwen3-1.7B-q4f16_1-MLC"), true);
  // a fresh page: no library yet, but the storage hint remembers the download
  const fresh = createPageEngine({ loader: async () => fake.mod, makeWorker: null, gpu: GPU_OK, storage });
  assert.equal(await fresh.cached(GEMMA), true);
  assert.equal(await fresh.cached("Qwen3-1.7B-q4f16_1-MLC"), false);
  assert.equal(await fresh.cached("Qwen3-1.7B-q4f16_1-MLC", { probe: true }), true);
  // storage that throws never breaks anything
  const bad = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const e3 = createPageEngine({ loader: async () => fake.mod, makeWorker: null, gpu: GPU_OK, storage: bad });
  await e3.load(GEMMA);
  assert.equal(await e3.cached(FALLBACK_MODEL), false);
});

test("pageModels: bridge-shaped entries, loaded/cached flags, sizes; empty with a typed reason when there is no GPU", async () => {
  const fake = fakeWebLLM({ cachedIds: [FALLBACK_MODEL] });
  const eng = engineWith(fake);
  await eng.load(GEMMA);
  await eng.cached(GEMMA);
  const list = await pageModels(eng, { gpu: GPU_OK });
  assert.equal(list.length, MODEL_CHOICES.length);
  const g = list.find((m) => m.id === "webllm:" + GEMMA);
  assert.equal(g.kind, "webllm-page"); assert.equal(g.provider, "webllm");
  assert.equal(g.local, true); assert.equal(g.sealed, false);
  assert.equal(g.loaded, true); assert.equal(g.sizeLabel, "~1.9 GB"); assert.equal(g.name, "Gemma 2 2B");
  assert.match(g.note, /loaded/);
  const q = list.find((m) => m.id === "webllm:" + FALLBACK_MODEL);
  assert.equal(q.loaded, false); assert.equal(q.cached, true); assert.match(q.note, /already downloaded/);
  const other = list.find((m) => m.id === "webllm:Qwen3-1.7B-q4f16_1-MLC");
  assert.equal(other.cached, false); assert.match(other.note, /downloads ~2 GB once/);
  const f32 = await pageModels(eng, { gpu: GPU_F32 });
  assert.match(f32[0].note, /f32/);

  for (const reason of ["no-webgpu", "no-adapter"]) {
    const none = await pageModels(eng, { gpu: { available: false, f16: false, reason } });
    assert.deepEqual([...none], []);
    assert.equal(none.reason, reason);
  }
  // with no gpu passed, the engine's own measurement is used
  const noGpuEng = createPageEngine({ loader: async () => fake.mod, makeWorker: null, gpu: { available: false, f16: false, reason: "no-webgpu" } });
  const viaEngine = await pageModels(noGpuEng);
  assert.equal(viaEngine.length, 0); assert.equal(viaEngine.reason, "no-webgpu");
});

test("models() lists the choices with a loaded flag", async () => {
  const eng = engineWith(fakeWebLLM());
  assert.ok(eng.models().every((m) => m.loaded === false));
  await eng.load(GEMMA);
  assert.deepEqual(eng.models().filter((m) => m.loaded).map((m) => m.id), [GEMMA]);
});


// ---- review fixes (2026-10-05): fallback honesty, load vs a running generation, a worker that cannot start --------------------------

test("FALLBACK NOT ON DEVICE: a failed load is a typed load-failed error and the fallback is NEVER created (no silent download)", async () => {
  const fake = fakeWebLLM({ failIds: [GEMMA], cachedIds: [] });
  const eng = engineWith(fake);
  await assert.rejects(eng.load(GEMMA), (e) => e instanceof PageEngineError && e.kind === "load-failed" && e.modelId === GEMMA && e.fallbackAvailable === false && e.fallbackModel === FALLBACK_MODEL);
  assert.deepEqual(fake.calls.create, [GEMMA], "only the chosen model was attempted; the fallback was not fetched");
  assert.equal(eng.isLoaded(), false);
  // and with NO cache API in the library, the storage hint is the only knowledge: nothing remembered -> still no fallback
  const noApi = fakeWebLLM({ failIds: [GEMMA], withCache: false });
  await assert.rejects(engineWith(noApi).load(GEMMA), (e) => e.kind === "load-failed");
  assert.deepEqual(noApi.calls.create, [GEMMA]);
});

test("FALLBACK ON DEVICE: falls back once, says so, and the next load of the same model neither re-asks nor reloads", async () => {
  const fake = fakeWebLLM({ failIds: [GEMMA], cachedIds: [FALLBACK_MODEL] });
  const eng = engineWith(fake);
  const r1 = await eng.load(GEMMA);
  assert.equal(r1.id, FALLBACK_MODEL); assert.equal(r1.fellBackFrom, GEMMA);
  assert.deepEqual(fake.calls.create, [GEMMA, FALLBACK_MODEL]);
  assert.equal(eng.servesFor(GEMMA), true);
  assert.equal(eng.servesFor("webllm:" + GEMMA), true);
  const r2 = await eng.load(GEMMA); // the second turn asks for the same requested model
  assert.equal(r2.id, FALLBACK_MODEL); assert.equal(r2.fellBackFrom, GEMMA);
  assert.deepEqual(fake.calls.create, [GEMMA, FALLBACK_MODEL], "no reload of the failed model");
  assert.deepEqual(fake.calls.unload, [], "the loaded fallback was not dropped");
  assert.equal(eng.loadedId(), FALLBACK_MODEL);
  // choosing a different model leaves the settled state; unload forgets it
  await eng.load("Qwen3-1.7B-q4f16_1-MLC");
  assert.equal(eng.servesFor(GEMMA), false);
});

test("a model switch waits (bounded) for a running generation; the stream then ends with finish abort, never as complete", async () => {
  let open;
  const hold = new Promise((r) => { open = r; });
  const fake = fakeWebLLM({ deltas: ["a", "b", "c", "d"], gate: async (i, intr) => { if (i === 1) await Promise.race([hold, new Promise((r) => { const t = setInterval(() => { if (intr()) { clearInterval(t); r(); } }, 2); })]); } });
  const eng = engineWith(fake, { drainMs: 300 });
  await eng.load(GEMMA);
  const meta = {};
  const got = [];
  const running = (async () => { for await (const d of eng.chatStream(MSGS, { meta })) got.push(d); })();
  await new Promise((r) => setTimeout(r, 10)); // the stream is mid-answer, held at delta 1
  const loading = eng.load(FALLBACK_MODEL);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(fake.calls.unload, [], "the engine was NOT dropped under a running generation (still inside the wait)");
  await Promise.all([running, loading]);
  assert.deepEqual(fake.calls.unload, [GEMMA], "dropped after the bounded wait");
  assert.equal(meta.finish, "abort", "the caller can see the answer was cut");
  assert.deepEqual(got, ["a"]);
  assert.equal(eng.loadedId(), FALLBACK_MODEL);
  open();
});

test("a model switch while a generation finishes inside the wait lets it complete (finish stop)", async () => {
  const fake = fakeWebLLM({ deltas: ["a", "b"], gate: async (i) => { await new Promise((r) => setTimeout(r, 5)); } });
  const eng = engineWith(fake, { drainMs: 300 });
  await eng.load(GEMMA);
  const meta = {};
  const running = (async () => { let t = ""; for await (const d of eng.chatStream(MSGS, { meta })) t += d; return t; })();
  await new Promise((r) => setTimeout(r, 1));
  const loading = eng.load(FALLBACK_MODEL);
  assert.equal(await running, "ab");
  await loading;
  assert.equal(meta.finish, "stop");
  assert.deepEqual(fake.calls.unload, [GEMMA]);
});

// A fake Worker: an EventTarget-ish object the test can fire events on.
function fakeWorker() {
  const w = new EventEmitter();
  w.terminated = 0;
  w.terminate = () => { w.terminated++; };
  w.addEventListener = (t, f) => w.on(t, f);
  w.removeEventListener = (t, f) => w.off(t, f);
  return w;
}

test("a worker that emits 'error' rejects, retries ONCE on the main thread, and a later load still works", async () => {
  const fake = fakeWebLLM();
  const w = fakeWorker();
  // the worker never answers, then reports it could not start
  fake.mod.CreateWebWorkerMLCEngine = async () => { setImmediate(() => w.emit("error", { message: "Failed to fetch module" })); return new Promise(() => {}); };
  const seen = [];
  const eng = createPageEngine({ loader: async () => fake.mod, makeWorker: () => w, gpu: GPU_OK, watchdogMs: 5000, onProgress: (p) => seen.push(p.text) });
  const r = await eng.load(GEMMA);
  assert.equal(r.id, GEMMA);
  assert.equal(w.terminated >= 1, true, "the dead worker was terminated");
  assert.deepEqual(fake.calls.create, [GEMMA], "created on the main thread after the worker failed");
  assert.equal((await eng.status()).worker, false);
  assert.ok(seen.some((t) => /main thread/.test(t)));
  assert.equal((await eng.chat(MSGS)).text, "Hello world");
  // and when the main thread cannot either, the typed error comes out and the queue is not wedged
  const bad = fakeWebLLM({ failIds: [GEMMA] });
  const w2 = fakeWorker();
  bad.mod.CreateWebWorkerMLCEngine = async () => { setImmediate(() => w2.emit("messageerror", { message: "clone failed" })); return new Promise(() => {}); };
  const e2 = createPageEngine({ loader: async () => bad.mod, makeWorker: () => w2, gpu: GPU_OK, watchdogMs: 5000 });
  await assert.rejects(e2.load(GEMMA), (e) => e instanceof PageEngineError && e.kind === "load-failed");
  bad.mod.CreateMLCEngine = async (id) => { bad.calls.create.push(id); return { id, interruptGenerate() {}, async unload() {}, chat: { completions: { async create() { return (async function* () { yield { choices: [{ delta: { content: "ok" } }] }; })(); } } } }; };
  assert.equal((await e2.load(GEMMA)).id, GEMMA, "the queue is clear: a later load runs");
});

test("a worker error with no main-thread rescue is a typed load-failed error", async () => {
  const fake = fakeWebLLM();
  const w = fakeWorker();
  fake.mod.CreateWebWorkerMLCEngine = async () => { setImmediate(() => w.emit("error", { message: "boom" })); return new Promise(() => {}); };
  fake.mod.CreateMLCEngine = async () => { throw new Error("main thread has no WebGPU either"); };
  const eng = createPageEngine({ loader: async () => fake.mod, makeWorker: () => w, gpu: GPU_OK, watchdogMs: 5000 });
  await assert.rejects(eng.load(GEMMA), (e) => e instanceof PageEngineError && e.kind === "load-failed" && /main thread has no WebGPU/.test(e.message));
  assert.ok(w.terminated >= 1);
});

test("a worker that never reports progress is stopped by the watchdog; the queue is clear and the main thread is tried", async () => {
  const fake = fakeWebLLM();
  const w = fakeWorker();
  fake.mod.CreateWebWorkerMLCEngine = () => new Promise(() => {}); // silence, forever
  const eng = createPageEngine({ loader: async () => fake.mod, makeWorker: () => w, gpu: GPU_OK, watchdogMs: 20 });
  const t0 = Date.now();
  const r = await eng.load(GEMMA); // watchdog fires, worker start failure -> main thread
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(r.id, GEMMA);
  assert.ok(w.terminated >= 1);
  assert.equal((await eng.status()).loading.length, 0);
  // silence on the main thread too: the load rejects (typed) instead of hanging, and a later load works
  const hung = fakeWebLLM();
  hung.mod.CreateMLCEngine = (id) => (id === GEMMA ? new Promise(() => {}) : fakeWebLLM().mod.CreateMLCEngine(id, {}));
  const e2 = createPageEngine({ loader: async () => hung.mod, makeWorker: null, gpu: GPU_OK, watchdogMs: 20 });
  await assert.rejects(e2.load(GEMMA), (e) => e.kind === "load-failed" && /no progress/.test(e.message));
  assert.equal((await e2.status()).loading.length, 0);
  hung.mod.CreateMLCEngine = async (id) => fakeWebLLM().mod.CreateMLCEngine(id, { initProgressCallback() {} });
  assert.equal((await e2.load(GEMMA)).id, GEMMA);
});

test("FALSIFIER (recheck 2026-10-05): after the first tick a slow-but-healthy download is NOT stopped by the short pre-first-tick bound — web-llm ticks once per finished shard", async () => {
  const fake = fakeWebLLM();
  fake.mod.CreateMLCEngine = async (id, cfg) => {
    cfg.initProgressCallback({ progress: 0, text: "Start to fetch params" });
    await new Promise((r) => setTimeout(r, 120));            // one big shard: silent for 6x the pre-first-tick bound...
    cfg.initProgressCallback({ progress: 0.5, text: "Fetching param cache[1/2]" });
    await new Promise((r) => setTimeout(r, 120));
    fake.calls.create.push(id);
    return { id, interruptGenerate() {}, async unload() {}, chat: { completions: { async create() { return (async function* () {})(); } } } };
  };
  const eng = engineWith(fake, { watchdogMs: 20, downloadWatchdogMs: 2000 });
  assert.equal((await eng.load(GEMMA)).id, GEMMA, "silent for 120 ms between ticks with a 20 ms pre-first-tick bound still loads");
});

test("a download that goes silent LONGER than downloadWatchdogMs after its first tick IS stopped (typed, queue clear)", async () => {
  const fake = fakeWebLLM();
  fake.mod.CreateMLCEngine = async (id, cfg) => { cfg.initProgressCallback({ progress: 0, text: "Start to fetch params" }); return new Promise(() => {}); };
  const eng = createPageEngine({ loader: async () => fake.mod, makeWorker: null, gpu: GPU_OK, watchdogMs: 5000, downloadWatchdogMs: 40 });
  await assert.rejects(eng.load(GEMMA), (e) => e.kind === "load-failed" && /no progress/.test(e.message));
  assert.equal((await eng.status()).loading.length, 0);
});

test("the pre-first-tick bound and the download bound are separate options with the documented defaults", () => {
  const src = fs.readFileSync(new URL("./fold-chat-webllm.js", import.meta.url), "utf8");
  assert.match(src, /watchdogMs = 90000, downloadWatchdogMs = 900000/);
});


test("FALSIFIER (recheck 2026-10-05): a stale localStorage 'downloaded' hint is NOT proof the fallback is on this device — no hasModelInCache, or a cache that says no, means no silent fallback download", async () => {
  const hintStore = (() => { const m = new Map([["fold.webllm.downloaded", JSON.stringify([FALLBACK_MODEL])]]); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; })();
  // (a) the library has no cache API: only the hint says 'cached' -> not authoritative
  const noApi = fakeWebLLM({ failIds: [GEMMA], withCache: false });
  const e1 = createPageEngine({ loader: async () => noApi.mod, makeWorker: null, gpu: GPU_OK, storage: hintStore });
  await assert.rejects(e1.load(GEMMA), (e) => e instanceof PageEngineError && e.kind === "load-failed" && e.fallbackAvailable === false);
  assert.deepEqual(noApi.calls.create, [GEMMA], "the fallback was never created");
  // (b) the library's own cache check says the fallback is NOT there (the browser evicted it) although the hint says it is
  const evicted = fakeWebLLM({ failIds: [GEMMA], cachedIds: [] });
  const e2 = createPageEngine({ loader: async () => evicted.mod, makeWorker: null, gpu: GPU_OK, storage: hintStore });
  await assert.rejects(e2.load(GEMMA), (e) => e.kind === "load-failed" && e.fallbackAvailable === false);
  assert.deepEqual(evicted.calls.create, [GEMMA]);
});
