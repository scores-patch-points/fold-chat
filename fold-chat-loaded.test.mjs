// Which models are loaded right now (fold-chat-loaded.js) — injectable fetch, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { fetchLoaded, describeLoaded, noModelWhy, createLoadedPoller, placeOf } from "./fold-chat-loaded.js";

const json = (o, status = 200) => ({ ok: status < 200 || status >= 300 ? false : true, status, json: async () => o });
const fakeFetch = (routes) => async (url) => {
  for (const [re, v] of routes) if (re.test(String(url))) { if (v instanceof Error) throw v; return typeof v === "function" ? v() : json(v); }
  throw new Error("unrouted " + url);
};
const OLLAMA_PS = { models: [{ name: "gemma2:2b", model: "gemma2:2b", size: 2355678412, size_vram: 2355678412, expires_at: "2026-10-05T15:10:04-05:00" }, { name: "qwen2.5-coder:1.5b", size: 986062089, size_vram: 500000000 }] };
const TAGS = { models: [{ name: "gemma2:2b" }, { name: "qwen2.5-coder:1.5b" }, { name: "nomic-embed-text:latest" }] };
const B = "http://127.0.0.1:8790";

test("local Ollama only: fleet empty, two resident models on this machine", async () => {
  const f = fakeFetch([[/8790\/api\/ps/, { models: [] }], [/8790\/api\/tags/, TAGS], [/11434\/api\/ps/, OLLAMA_PS]]);
  const st = await fetchLoaded({ base: B, fetchImpl: f });
  assert.equal(st.bridge, "up"); assert.equal(st.servable, 3);
  assert.deepEqual(st.entries.map((e) => [e.id, e.place]), [["gemma2:2b", "this machine"], ["qwen2.5-coder:1.5b", "this machine"]]);
  const d = describeLoaded(st);
  assert.equal(d.kind, "loaded"); assert.equal(d.dot, "●");
  assert.equal(d.text, "gemma2:2b · qwen2.5-coder:1.5b loaded");
  assert.match(d.title, /gemma2:2b — this machine · 2\.4 GB · all in GPU memory/);
  assert.match(d.title, /qwen2.5-coder:1.5b — this machine · 986 MB · 500 MB in GPU memory/);
});

test("fleet + local merge, with a WebLLM browser tab labelled as such; ':latest' is stripped; more than 3 is '+N'", async () => {
  const ps = { models: [{ name: "Llama-3.2-1B-Instruct-q4f16_1-MLC", heimdall: { webllm: true } }, { name: "phone-model:latest", heimdall: { workers: 1 } }] };
  const local = { models: [{ name: "gemma2:2b", size: 1, size_vram: 1 }, { name: "a:latest" }] };
  const st = await fetchLoaded({ base: B + "/", fetchImpl: fakeFetch([[/8790\/api\/ps/, ps], [/8790\/api\/tags/, TAGS], [/11434\/api\/ps/, local]]) });
  assert.equal(st.entries.length, 4);
  assert.deepEqual(st.entries.map((e) => e.place).sort(), ["browser tab (WebLLM)", "fleet", "this machine", "this machine"]);
  const d = describeLoaded(st, { max: 3 });
  assert.equal(d.text, "gemma2:2b · a · Llama-3.2-1B-Instruct-q4f16_1-MLC (tab) +1 loaded");
  assert.match(d.title, /phone-model — fleet/);
  assert.match(d.title, /MLC — browser tab \(WebLLM\)/);
});

test("the same model on this machine and in the fleet is two real copies; the same one twice in one place is one", async () => {
  const st = await fetchLoaded({ base: B, fetchImpl: fakeFetch([[/8790\/api\/ps/, { models: [{ name: "gemma2:2b", heimdall: { workers: 1 } }, { name: "gemma2:2b", heimdall: { workers: 1 } }] }], [/8790\/api\/tags/, TAGS], [/11434\/api\/ps/, { models: [{ name: "gemma2:2b" }] }]]) });
  assert.equal(st.entries.length, 2);
});

test("bridge down: nothing answers, so it says so (and never throws)", async () => {
  const f = fakeFetch([[/./, new Error("Failed to fetch")]]);
  const st = await fetchLoaded({ base: B, fetchImpl: f });
  assert.equal(st.bridge, "down"); assert.ok(st.errors.length >= 2);
  const d = describeLoaded(st);
  assert.equal(d.kind, "down"); assert.equal(d.dot, "○"); assert.equal(d.text, "no model reachable — Sources only still works");
});

test("Ollama down but the bridge up: the bridge is not 'down'; the fleet still shows", async () => {
  const f = fakeFetch([[/8790\/api\/ps/, { models: [{ name: "phone:1b", heimdall: { workers: 2 } }] }], [/8790\/api\/tags/, TAGS], [/11434/, new Error("ECONNREFUSED")]]);
  const st = await fetchLoaded({ base: B, fetchImpl: f });
  assert.equal(st.bridge, "up");
  assert.equal(describeLoaded(st).text, "phone:1b (fleet) loaded");
  assert.ok(st.errors.some((e) => /Ollama/.test(e)));
});

test("both empty: 'no model loaded — the first ask will load one' (and a bridge with nothing to serve says that instead)", async () => {
  const f = fakeFetch([[/8790\/api\/ps/, { models: [] }], [/8790\/api\/tags/, TAGS], [/11434/, { models: [] }]]);
  const d = describeLoaded(await fetchLoaded({ base: B, fetchImpl: f }));
  assert.equal(d.kind, "idle"); assert.equal(d.dot, "○"); assert.equal(d.text, "no model loaded — the first ask will load one");
  const g = fakeFetch([[/8790\/api\/ps/, { models: [] }], [/8790\/api\/tags/, { models: [] }], [/11434/, { models: [] }]]);
  assert.equal(describeLoaded(await fetchLoaded({ base: B, fetchImpl: g })).kind, "empty");
});

test("a source that hangs is cut off by the timeout instead of holding the footer", async () => {
  const slow = (url, init) => new Promise((res, rej) => { init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))); });
  const t0 = Date.now();
  const st = await fetchLoaded({ base: B, fetchImpl: slow, timeoutMs: 40 });
  assert.ok(Date.now() - t0 < 1500); assert.equal(st.bridge, "down");
});

test("an upstream the bridge reported is asked instead of the default", async () => {
  const seen = [];
  const f = async (u) => { seen.push(String(u)); return json({ models: [] }); };
  await fetchLoaded({ base: B, upstream: "http://127.0.0.1:9999/", fetchImpl: f });
  assert.ok(seen.includes("http://127.0.0.1:9999/api/ps"));
});

test("placeOf", () => {
  assert.equal(placeOf({ name: "x", heimdall: { webllm: true } }, "bridge"), "browser tab (WebLLM)");
  assert.equal(placeOf({ name: "x" }, "bridge"), "fleet");
  assert.equal(placeOf({ name: "x" }, "ollama"), "this machine");
});

test("noModelWhy: the bridge, the list, the embedders, and the selected model each say their own reason", () => {
  assert.equal(noModelWhy({ bridgeUp: false }).code, "bridge-down");
  assert.match(noModelWhy({ bridgeUp: false }).text, /no model can run in this tab/);
  assert.equal(noModelWhy({ bridgeUp: true, models: [] }).code, "no-models");
  assert.equal(noModelWhy({ bridgeUp: true, models: [{ id: "nomic-embed-text:latest" }] }).code, "no-chat-model");
  const w = noModelWhy({ bridgeUp: true, models: [{ id: "gemma2:2b" }], selectedId: "llama3:latest" });
  assert.equal(w.code, "selected-missing"); assert.match(w.text, /selected model \(llama3\) isn't available here/);
  assert.equal(noModelWhy({ bridgeUp: true, models: [{ id: "gemma2:2b" }], selectedId: "gemma2:2b" }).code, "ok");
});

test("noModelWhy: no-webgpu advice names a WebGPU browser, never the extension", () => {
  const w = noModelWhy({ bridgeUp: false, models: [], page: { available: false, reason: "no-webgpu" } });
  assert.equal(w.code, "no-webgpu");
  assert.doesNotMatch(w.text, /extension/i);
  assert.match(w.text, /WebGPU browser/);
});

test("poller: ticks only while visible, pauses on hidden, refreshes on return, refresh() after a turn, never stacks", async () => {
  let visible = true, vis = null, calls = 0, ticks = null, cleared = 0;
  const states = [];
  const p = createLoadedPoller({
    get: async () => { calls++; return { n: calls }; }, onState: (s) => states.push(s.n), intervalMs: 15000,
    isVisible: () => visible, onVisibilityChange: (cb) => { vis = cb; return () => { vis = null; }; },
    setIntervalFn: (fn, ms) => { assert.equal(ms, 15000); ticks = fn; return 1; }, clearIntervalFn: () => { cleared++; ticks = null; },
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);                                  // an immediate first read
  ticks(); await new Promise((r) => setImmediate(r)); assert.equal(calls, 2);
  visible = false; vis(); assert.equal(cleared, 1); assert.equal(ticks, null);   // hidden: the timer is gone
  visible = true; vis(); await new Promise((r) => setImmediate(r)); assert.equal(calls, 3); assert.ok(ticks);   // back: refresh now, timer again
  await p.refresh(); assert.equal(calls, 4);               // after a turn
  p.stop(); await p.refresh(); assert.equal(calls, 4); assert.deepEqual(states, [1, 2, 3, 4]);
});

test("poller: a get() that throws never breaks it, and overlapping refreshes do not stack", async () => {
  let n = 0; let release;
  const p = createLoadedPoller({ get: () => { n++; if (n === 1) return Promise.reject(new Error("x")); return new Promise((r) => { release = r; }); }, onState: () => {}, setIntervalFn: () => 1, clearIntervalFn: () => {} });
  await new Promise((r) => setImmediate(r));
  const a = p.refresh(); const b = p.refresh();
  assert.equal(n, 2); release({}); await a; await b;
  p.stop();
});

test("an outside provider's sealed lane is not a loaded model: it is neither resident nor in the fleet", async () => {
  const hosted = { name: "deepinfra:google/gemma-2-9b-it", size: 0, heimdall: { frontier: "deepinfra", privacy: "sealed-external", location: "external" } };
  const local = { name: "gemma2:2b", size: 2355678412, size_vram: 2355678412 };
  const got = await fetchLoaded({ base: "http://b", fetchImpl: fakeFetch([[/\/api\/ps$/, { models: [hosted, local] }], [/\/api\/tags$/, { models: [] }]]) });
  const ids = (got.entries || []).map((e) => e.id);
  assert.ok(ids.includes("gemma2:2b"), "the resident model is listed");
  assert.ok(!ids.some((id) => /deepinfra/.test(id)), "the hosted lane is not: " + JSON.stringify(ids));
});
