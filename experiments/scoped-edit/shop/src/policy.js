// Money policy. Every computed amount of money (in cents) is rounded with roundCents():
// half-even ("banker's rounding"), so that repeated rounding does not drift upward.
// Do not use Math.round for computed money amounts.
export function roundCents(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

export const MAX_QTY = 99;
