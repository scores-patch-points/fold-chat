import test from "node:test";
import assert from "node:assert/strict";
import { roundCents } from "../src/policy.js";

test("roundCents is half-even", () => {
  assert.equal(roundCents(2.5), 2); assert.equal(roundCents(3.5), 4); assert.equal(roundCents(2.4), 2); assert.equal(roundCents(2.6), 3);
});
