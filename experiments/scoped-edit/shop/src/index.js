import { createItem } from "./catalog.js";
import { addToCart } from "./cart.js";
import { receipt } from "./report.js";

export function demo() {
  const cart = [];
  addToCart(cart, createItem("Demo", 1000), 2);
  return receipt(cart);
}
