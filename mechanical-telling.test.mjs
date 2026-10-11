// mechanical-telling.test.mjs — how far the UNCONSCIOUS gets to coherent speech,
// measured and locked. No model is ever called; every sentence is either a
// traceable situation or a verbatim source sentence at its byte; the residual
// distance to coherent speech is reference-continuity (shared content words
// between adjacent sentences).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { measure } from "../mechanical-telling.mjs";

const SOURCE = "/Users/mlacy/Documents/3.0/pg2600.txt";

test("mechanical coverage: the unconscious speaks entirely from the record, zero model calls", { skip: fs.existsSync(SOURCE) ? false : `corpus absent (${SOURCE})` }, async () => {
  const r = await measure({ source: SOURCE });
  assert.equal(r.modelCalls, 0, "no model was called");
  assert.equal(r.lint.unjustified.length, 0, `every situation traces to a bound edge: ${JSON.stringify(r.lint.unjustified)}`);
  assert.ok(r.lint.accepted + r.wandered >= 20, `needs a real mechanical body (got ${r.lint.accepted}+${r.wandered})`);
  assert.ok(r.continuity >= 55, `reference-continuity toward coherent speech (got ${r.continuity}%)`);
  assert.ok(r.markers > 0, "every sentence carries its source span");
});