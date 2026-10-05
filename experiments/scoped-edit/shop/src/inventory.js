export function stockLevel(inv, id) {
  return inv[id] || 0;
}

export function reserve(inv, id, qty) {
  if (stockLevel(inv, id) < qty) return false;
  inv[id] -= qty;
  return true;
}
