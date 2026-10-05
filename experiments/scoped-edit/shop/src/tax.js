export const TAX_RATE = 0.0825;

export function taxFor(cents) {
  return Math.floor(cents * TAX_RATE);
}
