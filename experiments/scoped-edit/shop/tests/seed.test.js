import test from "node:test";
import assert from "node:assert/strict";
import { SEED } from "../src/seed.js";

test("seed items", () => { assert.equal(SEED.length, 4); assert.equal(SEED[0].priceCents, 1299); assert.equal(SEED[1].tags.length, 0); });
