import test from "node:test";
import assert from "node:assert/strict";
import { kindFor, admit, frame, createPageMouth, HOUSE, FOLD_MOUTH_SCHEMA } from "./fold-mouth-webllm.mjs";

test("kindFor routes a task to its artifact form and GFP grain", () => {
  assert.equal(kindFor("write a markdown brief on Pierre").kind, "markdown");
  assert.equal(kindFor("a module with two functions parseDate and fmtDuration").kind, "code");
  assert.equal(kindFor("the JSON record of this read").kind, "data");
  assert.equal(kindFor("say one turn answering the ask").kind, "talk");
  assert.equal(kindFor("an essay about the sea").kind, "text");
  // the GFP grain faces:
  assert.equal(kindFor("the raw source and its bytes").grain, "Ground");
  assert.equal(kindFor("the main character Pierre").grain, "Figure");
  assert.equal(kindFor("the page layout and its template").grain, "Pattern");
});

test("admit mirrors Penelope's mouth ration (same house numbers)", () => {
  assert.equal(admit("tab", { log: [], now: 1000 }).ok, true);
  assert.equal(admit("tab", { log: [{ ts: 900, kind: "chat" }], now: 1000 }).place, 1);
  const full = Array.from({ length: HOUSE.ration }, (_, i) => ({ ts: 1000 - i * 1000, kind: "build" }));
  const r = admit("tab", { log: full, now: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
  // hop draws skip the tab ration (the doorway already admitted)
  assert.equal(admit("tab", { log: full, now: 1000, hop: 1 }).ok, true);
});

test("frame only lets the mouth phrase the given ground (khora FOLD II.9, mouth-last)", () => {
  const p = frame("Write the lede.", { topic: "War and Peace", cast: ["pierre"], deeds: ["spoke"], hunt: ["⟦t:src@14⟧"] });
  assert.match(p, /Speak ONLY what the ground holds/);
  assert.match(p, /pierre/);
  assert.match(p, /⟦t:src@14⟧/);
  assert.match(p, /never write one of your own/);
  assert.ok(!/you may reason|derive|deduc|conclu|invent/.test(p)); // never invites reasoning to a conclusion
});

test("draw speaks through the engine and answers the server door's exec shape", async () => {
  const calls = [];
  const engine = {
    loadedId: () => "webllm:test",
    async load(m) { calls.push(["load", m]); },
    async chat(messages, opts) { calls.push(["chat", messages[0].content, opts?.maxTokens]); return { text: "the mouth answered.", tokens: 5, finish: "stop" }; },
    async status() { return { gpu: { available: true }, loaded: true }; },
  };
  const mouth = createPageMouth({ engine });
  const r = await mouth.draw("speak", { maxTokens: 90, temperature: 0.2 });
  assert.equal(r.ok, true);
  assert.equal(r.text, "the mouth answered.");
  assert.equal(r.model, "webllm:test");
  assert.deepEqual(mouth.kindFor("a page on it").grain === "Pattern", true);
  assert.equal(r.place, "tab");
});

test("a device with no engine is a typed refusal, never a crash", async () => {
  const mouth = createPageMouth({ engine: null, storage: null });
  const r = await mouth.draw("speak");
  assert.equal(r.ok, false);
  assert.match(r.error, /no in-page engine/);
});

test("status reports the folder without a gpu assumption", async () => {
  const mouth = createPageMouth({ engine: { async status() { return { gpu: { available: true }, loaded: true }; } } });
  const s = await mouth.status();
  assert.equal(s.schema, FOLD_MOUTH_SCHEMA);
  assert.equal(s.engine, true);
});