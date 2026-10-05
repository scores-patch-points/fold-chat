import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { receipt } from "../src/report.js";

test("receipt shape", () => {
  const out = receipt([{ item: createItem("Pen", 1000), qty: 2 }]);
  assert.match(out, /2 x Pen \$20\.00/); assert.match(out, /Subtotal: \$20\.00/); assert.match(out, /Tax: \$1\.65/); assert.match(out, /Shipping: \$4\.99/); assert.match(out, /Free shipping on orders over \$50\.00/);
});
test("receipt in spanish", () => { assert.match(receipt([{ item: createItem("Pen", 1000), qty: 1 }], "es"), /Impuesto/); });
