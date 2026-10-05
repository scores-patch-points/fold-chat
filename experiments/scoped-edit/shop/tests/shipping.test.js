import test from "node:test";
import assert from "node:assert/strict";
import { shippingFor, FLAT_RATE_CENTS } from "../src/shipping.js";

test("shipping", () => { assert.equal(shippingFor(100), FLAT_RATE_CENTS); assert.equal(shippingFor(5000), 0); assert.equal(shippingFor(4999), 499); });
