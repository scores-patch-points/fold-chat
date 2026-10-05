import test from "node:test";
import assert from "node:assert/strict";
import { applyDiscount, CODES } from "../src/discounts.js";

test("discount codes", () => {
  assert.equal(CODES.SAVE10, 10);
  assert.equal(applyDiscount(1000, "save10"), 900);
  assert.equal(applyDiscount(1000, "nope"), 1000);
  assert.equal(applyDiscount(1000, "HALF"), 500);
});
