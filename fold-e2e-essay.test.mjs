// fold-e2e-essay.test.mjs — the headless end-to-end as a test. The deterministic
// mouth runs everywhere (no model); the Ollama mouth runs only when asked
// (FOLD_E2E_OLLAMA=1) and a local model is reachable.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runEssay, DEFAULT_SOURCE } from "./fold-e2e-essay.mjs";

const corpus = fs.existsSync(DEFAULT_SOURCE);

test("e2e: an essay seals where every proposition is grounded or a cited terrain-voice", { skip: corpus ? false : `corpus not present (${DEFAULT_SOURCE})` }, async () => {
  const r = await runEssay({ mouth: "compose" });
  assert.equal(r.ok, true, `not sealed: ${JSON.stringify(r.lanes?.counts)}`);
  const L = r.lanes.counts;
  assert.ok(L.grounded > 0, "has grounded propositions");
  assert.ok(L.voice > 0, "has terrain-voice thoughts");
  assert.equal(L.fail, 0, "no proposition is left ungrounded");
  for (const s of r.lanes.sentences.filter((x) => x.lane === "voice")) assert.ok(s.cites > 0, "every voice thought cites a source span");
  assert.equal(r.sealed.sealScope, "grounded_and_voiced");
});

test("e2e: a bare assertion, or a voice with no terrain altitude, blocks the seal", async () => {
  // the same classifier the e2e uses, on a draft the mouth could have written
  const { classifyEssay, verifyDraftClaims } = await import("./essay-seam.mjs");
  const draft = "Pierre ruled France.\n[voice] A thought with no altitude ⟦fold:essay-source@10⟧";
  let o = 0;
  const sents = draft.split("\n").map((t, i) => { const s = { order: i, text: t, offset: o }; o += t.length + 1; return s; });
  const read = { sents, clauses: [], subjectRefOf: () => null, objectRefOf: () => null };
  const claims = verifyDraftClaims({ read, edges: [], text: draft });
  const lanes = classifyEssay({ draft, read, claims, sourceAt: new Set([10]) });
  assert.equal(lanes.counts.fail, 2);
});

test("e2e (ollama): a real model supplies the voice, the system cites it", { skip: process.env.FOLD_E2E_OLLAMA ? false : "set FOLD_E2E_OLLAMA=1 to run a local model" }, async () => {
  const r = await runEssay({ mouth: "ollama", model: process.env.FOLD_E2E_MODEL || "qwen2.5-coder:1.5b" });
  assert.equal(r.ok, true, `not sealed: ${JSON.stringify(r.lanes?.counts)}`);
  assert.equal(r.lanes.counts.fail, 0);
  assert.ok(r.lanes.counts.voice > 0);
});
