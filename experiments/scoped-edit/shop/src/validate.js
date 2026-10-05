export function validateName(n) {
  if (typeof n !== "string" || !n.trim()) return { ok: false, error: "name required" };
  if (n.length > 60) return { ok: false, error: "name too long" };
  return { ok: true };
}

export function validateQty(q) {
  if (!Number.isInteger(q)) return { ok: false, error: "qty must be an integer" };
  if (q < 1 || q > 99) return { ok: false, error: "qty out of range" };
  return { ok: true };
}
