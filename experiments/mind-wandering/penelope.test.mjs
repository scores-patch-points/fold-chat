// penelope.test.mjs — the pathos pass: Penelope's creativity, no model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weavePathos, routeArchon, REGISTERS } from "./penelope.mjs";
import { loadManifest } from "../../../penelope/organs/pythia.mjs";

const CAST_OK = (() => { try { return loadManifest().size > 0; } catch { return false; } })();

test("routing is deterministic and returns a speakable archon or null", (t) => {
  if (!CAST_OK) return t.skip("eo-teachings cast absent");
  const cast = loadManifest();
  const a = routeArchon(cast, { topic: "castle", spine: "castle wall night blood" });
  const b = routeArchon(cast, { topic: "castle", spine: "castle wall night blood" });
  assert.ok(a && a.rec && a.voice.length > 0);
  assert.equal(a.rec.handle, b.rec.handle, "same query routes to the same archon");
});

test("the pathos passage calls no model and every quoted line is verified", (t) => {
  if (!CAST_OK) return t.skip("eo-teachings cast absent");
  const p = weavePathos({ topic: "castle", logicalTranscript: "castle wall night blood dracula helsing", register: "elegiac" });
  assert.equal(p.drew, true);
  assert.equal(p.modelCalls, 0);
  assert.ok(p.quotes.offered >= 1);
  assert.equal(p.quotes.fabricated, 0, "nothing quoted is fabricated — rejectfab holds");
  assert.equal(p.quotes.located, p.quotes.offered);
});

test("the veil: the passage carries no routed archon's name", (t) => {
  if (!CAST_OK) return t.skip("eo-teachings cast absent");
  const p = weavePathos({ topic: "castle", logicalTranscript: "castle wall night", register: "dread" });
  assert.equal(p.drew, true);
  assert.ok(!p.passage.includes(p.archon.giver), "the giver's name is not in the passage");
  assert.ok(!p.passage.includes(p.archon.handle), "the handle is not in the passage");
});

test("an unknown register falls back, never throws", (t) => {
  if (!CAST_OK) return t.skip("eo-teachings cast absent");
  const p = weavePathos({ topic: "night", logicalTranscript: "night lucy sleep", register: "not-a-register" });
  assert.ok(REGISTERS.includes(p.register));
});
