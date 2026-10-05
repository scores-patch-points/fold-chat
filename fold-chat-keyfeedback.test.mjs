// fold-chat-keyfeedback.test.mjs — what the settings panel tells a person when a provider key is added.
// FAKE keys and STUB bridges only: nothing here reaches a real heimdall or provider.
import test from "node:test";
import assert from "node:assert/strict";
import { setProviderKey, testProviderKey, reloadProviderKeys, keyLoadState, describeKeyResult, listModels, remoteCandidates } from "./fold-chat-client.js";

const FAKE = "sk-ant-api03-FAKEFAKEFAKE-wxyz";
const jres = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const sealed = (id, provider = "anthropic") => ({ id, sealed: true, provider });

const worksReport = { ok: true, tone: "ok", headline: "Anthropic key works (••••wxyz)", lines: ["Received and stored: your Anthropic key ••••wxyz, kept on this computer only. It is never shown again.", "Live check: works. Anthropic accepted the key.", "Unlocked: claude-haiku-4-5."] };
const rejectedReport = { ok: false, tone: "bad", headline: "Anthropic rejected this key (••••wxyz). It was NOT saved.", lines: ["Live check: rejected (wrong or expired key).", "Next: Get a fresh key at console.anthropic.com/settings/keys, copy the WHOLE thing, and press Save again."] };

test("keyLoadState: stored + a sealed model from that provider = loaded; stored with none = saved_not_loaded; nothing = not_saved", () => {
  const stored = [{ provider: "anthropic", set: true, masked: "••••wxyz" }];
  assert.deepEqual(keyLoadState("anthropic", { stored, models: [sealed("claude-haiku-4-5")] }), { state: "loaded", models: ["claude-haiku-4-5"], masked: "••••wxyz" });
  assert.equal(keyLoadState("anthropic", { stored, models: [{ id: "gemma2:2b", sealed: false, provider: "local" }] }).state, "saved_not_loaded", "the key is saved but the bridge has not loaded it");
  assert.equal(keyLoadState("anthropic", { stored: [], models: [] }).state, "not_saved");
  assert.equal(keyLoadState("anthropic", { stored, models: [sealed("gpt-x", "openai")] }).state, "saved_not_loaded", "another provider's model does not count");
});

test("describeKeyResult: a working key shows heimdall's own words and, with the model list refreshed, stays 'ok'", () => {
  const d = describeKeyResult("anthropic", { report: worksReport }, { models: [sealed("claude-haiku-4-5")] });
  assert.equal(d.ok, true);
  assert.equal(d.tone, "ok");
  assert.match(d.headline, /Anthropic key works/);
  assert.match(d.lines.join("\n"), /Unlocked: claude-haiku-4-5/);
});

test("describeKeyResult: heimdall says works but this page's list shows no such model -> a warning with the fix, not a silent 'ok'", () => {
  const d = describeKeyResult("anthropic", { report: worksReport }, { models: [{ id: "gemma2:2b", sealed: false, provider: "local" }] });
  assert.equal(d.ok, false);
  assert.equal(d.tone, "warn");
  assert.match(d.lines.at(-1), /does not show any Anthropic model yet/);
  assert.match(d.lines.at(-1), /Detect/);
});

test("describeKeyResult: a rejected key is 'bad', says NOT saved, and carries the next step", () => {
  const d = describeKeyResult("anthropic", { report: rejectedReport }, { models: [] });
  assert.equal(d.ok, false);
  assert.equal(d.tone, "bad");
  assert.match(d.headline, /rejected/);
  assert.match(d.headline, /NOT saved/);
  assert.match(d.lines.join("\n"), /Get a fresh key/);
});

test("describeKeyResult: an OLDER heimdall (no report) is 'saved, not tested' with the restart advice — never 'works'", () => {
  const d = describeKeyResult("anthropic", { ok: true, stored: true, frontierModels: 0 });
  assert.equal(d.ok, false);
  assert.equal(d.tone, "warn");
  assert.match(d.headline, /saved, but it was not tested/);
  assert.match(d.lines.join("\n"), /older version/);
  assert.match(d.lines.join("\n"), /heimdall up/);
  assert.match(d.lines.join("\n"), /nothing is lost/);
});

test("describeKeyResult: never contains the key even if a hostile response echoed nothing but the report", () => {
  const d = describeKeyResult("anthropic", { report: worksReport });
  assert.ok(!JSON.stringify(d).includes(FAKE));
});

test("setProviderKey passes heimdall's report through, and testProviderKey/reloadProviderKeys send no key", async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => { calls.push({ url, body: opts.body }); return jres(200, { ok: true, stored: true, report: worksReport, models: ["claude-haiku-4-5"] }); };
  const j = await setProviderKey("anthropic", FAKE, { base: "http://x:8790", fetchImpl });
  assert.equal(j.report.ok, true);
  await testProviderKey("anthropic", { base: "http://x:8790", fetchImpl });
  await reloadProviderKeys({ base: "http://x:8790", fetchImpl });
  assert.match(calls[1].url, /\/api\/providers\/check$/);
  assert.equal(calls[1].body, JSON.stringify({ provider: "anthropic" }));
  assert.match(calls[2].url, /\/api\/providers\/refresh$/);
  assert.equal(calls[2].body, undefined);
  assert.ok(!calls[1].url.includes(FAKE) && !calls[2].url.includes(FAKE));
});

test("an older heimdall's 404 on the new routes surfaces as status 404 (the UI turns it into 'restart heimdall')", async () => {
  const fetchImpl = async () => jres(404, { error: "not found" });
  await assert.rejects(() => testProviderKey("anthropic", { base: "http://x:8790", fetchImpl }), (e) => e.status === 404);
  await assert.rejects(() => reloadProviderKeys({ base: "http://x:8790", fetchImpl }), (e) => e.status === 404);
});

test("the online-escalation candidates pick up a newly added provider on the next model refresh (no reload)", async () => {
  let keyAdded = false;
  const fetchImpl = async () => jres(200, { models: [
    { name: "gemma2:2b", heimdall: { webllm: "gemma", workers: 1 } },
    ...(keyAdded ? [{ name: "claude-haiku-4-5", heimdall: { frontier: "anthropic", privacy: "sealed-external", location: "external" } }] : []),
  ] });
  assert.deepEqual(remoteCandidates(await listModels({ base: "http://x", fetchImpl })), [], "before the key: nothing to escalate to");
  keyAdded = true;
  const models = await listModels({ base: "http://x", fetchImpl });
  assert.deepEqual(remoteCandidates(models), ["claude-haiku-4-5"], "after the refresh the Fold can escalate to it");
  assert.equal(keyLoadState("anthropic", { stored: [{ provider: "anthropic", set: true }], models }).state, "loaded");
});
