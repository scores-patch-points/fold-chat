import test from "node:test";
import assert from "node:assert/strict";
import { taxFor, TAX_RATE } from "../src/tax.js";

test("tax on round amounts", () => { assert.equal(TAX_RATE, 0.0825); assert.equal(taxFor(10000), 825); assert.equal(taxFor(0), 0); });
