import { createItem } from "./catalog.js";

export function addToCart(cart, item, qty = 1) {
  const line = cart.find((l) => l.item.id === item.id);
  if (line) line.qty += qty;
  else cart.push({ item, qty });
  return cart;
}

export function subtotal(cart) {
  return cart.reduce((sum, l) => sum + l.item.priceCents * l.qty, 0);
}

export function bulkItem(name, priceCents, qty) {
  return { item: createItem(name, priceCents, ["bulk"]), qty };
}

export function qualifiesForFreeShipping(cart) {
  return subtotal(cart) >= 5000;
}
