import test from "node:test";
import assert from "node:assert/strict";
import { fmtMoney, toCents } from "../src/money.js";

test("fmtMoney formats cents", () => {
  assert.equal(fmtMoney(250), "$2.50");
  assert.equal(fmtMoney(5), "$0.05");
  assert.equal(fmtMoney(100000), "$1000.00");
});
test("toCents", () => { assert.equal(toCents(2.5), 250); assert.equal(toCents("19.99"), 1999); });
