import test from "node:test";
import assert from "node:assert/strict";
import { validateName, validateQty } from "../src/validate.js";

test("validators", () => {
  assert.equal(validateName("Pen").ok, true); assert.equal(validateName("  ").ok, false); assert.equal(validateName("x".repeat(61)).ok, false);
  assert.equal(validateQty(3).ok, true); assert.equal(validateQty(0).ok, false); assert.equal(validateQty(1.5).ok, false);
});
