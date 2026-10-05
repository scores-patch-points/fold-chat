import { roundCents } from "./policy.js";

export const CODES = { SAVE10: 10, SAVE20: 20, HALF: 50 };

export function applyDiscount(totalCents, code) {
  const pct = CODES[String(code).toUpperCase()];
  if (!pct) return totalCents;
  return totalCents - roundCents((totalCents * pct) / 100);
}
