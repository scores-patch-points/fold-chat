export const toCents = (dollars) => Math.round(Number(dollars) * 100);

export function fmtMoney(cents) {
  const d = Math.floor(cents / 100);
  const c = String(Math.abs(cents % 100)).padStart(2, "0");
  return "$" + d + "." + c;
}
