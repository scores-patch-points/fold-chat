// holograph.test.mjs — the read-grounded muller, model-free.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readHolograph, holographBank, castOf, renderEdge, makeHoloMuller, DEFAULT_HOLOGRAPH } from "./holograph.mjs";

const PRESENT = fs.existsSync(DEFAULT_HOLOGRAPH);

test("the holograph reads: names resolved, acts glossed or disclosed", (t) => {
  if (!PRESENT) return t.skip("holograph absent");
  const h = readHolograph();
  assert.ok(h.eot.referents.length > 100);
  assert.ok(h.eot.edges.length > 1000);
});

test("the sentence bank holds only bound edges (a glossed act + a named being)", (t) => {
  if (!PRESENT) return t.skip("holograph absent");
  const bank = holographBank();
  assert.ok(bank.length > 50);
  assert.ok(bank.every((b) => b.edge.verb && (b.edge.s || b.edge.o)));
});

test("renderEdge never invents an English verb: unglossed acts keep the read's own surface", () => {
  assert.equal(renderEdge({ s: "Telemachus", verb: "bade", o: null, raw: "ἐκέλευσεν" }), "Telemachus bade.");
  assert.equal(renderEdge({ s: "Telemachus", verb: null, o: null, raw: "βαῖν'" }), "Telemachus “βαῖν'”.");
});

test("the muller follows the thought's cast and calls no model", async (t) => {
  if (!PRESENT) return t.skip("holograph absent");
  const m = await makeHoloMuller({ think: "Telemachus and Athena", seed: 1 });
  for (let i = 0; i < 12; i += 1) m.step();
  const rec = m.record();
  assert.ok(rec.stepCount >= 1);
  assert.ok(/Telemachus/.test(rec.passage));
  assert.equal(rec.gloss.unglossed + rec.gloss.glossed, rec.stepCount);
  assert.ok(/no model called/.test(rec.basis));
});

test("cast lists named beings by degree", (t) => {
  if (!PRESENT) return t.skip("holograph absent");
  const cast = castOf(undefined, { limit: 5 });
  assert.equal(cast.length, 5);
  assert.ok(cast[0].edges >= cast[4].edges);
});
