import test from "node:test";
import assert from "node:assert/strict";
import { createItem, findItem } from "../src/catalog.js";

test("createItem and findItem", () => {
  const a = createItem("Red Pen", 199, ["office"]);
  assert.deepEqual(a, { id: "red-pen", name: "Red Pen", priceCents: 199, tags: ["office"] });
  assert.equal(findItem([a], "red-pen"), a);
  assert.equal(findItem([a], "x"), null);
});
