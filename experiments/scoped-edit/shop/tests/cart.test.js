import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { addToCart, subtotal, bulkItem, qualifiesForFreeShipping } from "../src/cart.js";

test("cart basics", () => {
  const cart = [];
  const a = createItem("A", 1000);
  addToCart(cart, a, 2); addToCart(cart, a);
  assert.equal(cart.length, 1); assert.equal(cart[0].qty, 3); assert.equal(subtotal(cart), 3000);
});
test("bulkItem and free shipping", () => {
  const b = bulkItem("Box", 2500, 2);
  assert.ok(b.item.tags.includes("bulk"));
  assert.equal(qualifiesForFreeShipping([b]), true);
  assert.equal(qualifiesForFreeShipping([{ item: createItem("C", 4999), qty: 1 }]), false);
});
