// tasks.mjs — edit tasks for the scoped-edit experiment, each built to try to BREAK
// the claim "a frontier model never needs the full code stack, only a scoped request".
//
// Each task carries:
//   task      the ask, as a person would write it (no file hints beyond what a person would say)
//   primary   the one obvious file (the FILE-ONLY condition); [] for a brand-new file
//   oracle    the files a careful engineer would open — the ORACLE scope. If the model fails
//             with the oracle scope but passes with the full stack, "a correct scope is
//             sufficient" is FALSE. If it passes with the oracle but fails with the Fold's
//             mechanical scope, "the scope is computable without a model" is FALSE.
//   overrides hidden tests (written over the visible ones before testing)
//   golden    a known-correct solution (full-file replacements) — used to prove the hidden
//             tests are satisfiable, and that they FAIL on the unedited code.
//   why       what the task is built to expose.

const T = (s) => s.trim() + "\n";

export const TASKS = [
  {
    id: "T1-local", label: "one function, one file",
    task: "fmtMoney is wrong for negative amounts: fmtMoney(-250) must give \"-$2.50\" (and fmtMoney(-5) \"-$0.05\"). Fix it.",
    primary: ["src/money.js"], oracle: ["src/money.js"],
    why: "control — the easy case; scoping should be free here",
    overrides: {
      "tests/money.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { fmtMoney, toCents } from "../src/money.js";
test("fmtMoney formats cents", () => { assert.equal(fmtMoney(250), "$2.50"); assert.equal(fmtMoney(5), "$0.05"); assert.equal(fmtMoney(100000), "$1000.00"); });
test("fmtMoney negatives", () => { assert.equal(fmtMoney(-250), "-$2.50"); assert.equal(fmtMoney(-5), "-$0.05"); assert.equal(fmtMoney(0), "$0.00"); });
test("toCents", () => { assert.equal(toCents(2.5), 250); assert.equal(toCents("19.99"), 1999); });
`),
    },
    golden: {
      "src/money.js": T(`
export const toCents = (dollars) => Math.round(Number(dollars) * 100);

export function fmtMoney(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const d = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  return sign + "$" + d + "." + c;
}
`),
    },
  },
  {
    id: "T2-pattern", label: "follow a pattern in the same file",
    task: "Add validatePrice(p) to the validators. A price is valid only if it is an integer number of cents of at least 1; otherwise return the same { ok: false, error } shape the other validators use.",
    primary: ["src/validate.js"], oracle: ["src/validate.js"],
    why: "control — the pattern to follow is in the file being edited",
    overrides: {
      "tests/validate.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { validateName, validateQty, validatePrice } from "../src/validate.js";
test("validators", () => {
  assert.equal(validateName("Pen").ok, true); assert.equal(validateName("  ").ok, false);
  assert.equal(validateQty(3).ok, true); assert.equal(validateQty(0).ok, false);
});
test("validatePrice", () => {
  assert.equal(validatePrice(100).ok, true); assert.equal(validatePrice(1).ok, true);
  for (const bad of [0, -5, 1.5, "5", NaN, null]) { const r = validatePrice(bad); assert.equal(r.ok, false, String(bad)); assert.equal(typeof r.error, "string"); }
});
`),
    },
    golden: {
      "src/validate.js": T(`
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

export function validatePrice(p) {
  if (!Number.isInteger(p)) return { ok: false, error: "price must be an integer" };
  if (p < 1) return { ok: false, error: "price must be at least 1" };
  return { ok: true };
}
`),
    },
  },
  {
    id: "T3-callers", label: "signature change that must reach every caller",
    task: "Change createItem to take a single options object — createItem({ name, priceCents, tags }) with tags optional — instead of positional arguments, and update everything that calls it.",
    primary: ["src/catalog.js"], oracle: ["src/catalog.js", "src/seed.js", "src/cart.js", "src/index.js"],
    why: "the edit's blast radius is other files — scoping must find every caller",
    overrides: {
      "tests/catalog.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { createItem, findItem } from "../src/catalog.js";
test("createItem and findItem", () => {
  const a = createItem({ name: "Red Pen", priceCents: 199, tags: ["office"] });
  assert.deepEqual(a, { id: "red-pen", name: "Red Pen", priceCents: 199, tags: ["office"] });
  assert.deepEqual(createItem({ name: "X", priceCents: 5 }).tags, []);
  assert.equal(findItem([a], "red-pen"), a); assert.equal(findItem([a], "x"), null);
});
`),
      "tests/cart.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { addToCart, subtotal, bulkItem, qualifiesForFreeShipping } from "../src/cart.js";
test("cart basics", () => {
  const cart = []; const a = createItem({ name: "A", priceCents: 1000 });
  addToCart(cart, a, 2); addToCart(cart, a);
  assert.equal(cart.length, 1); assert.equal(cart[0].qty, 3); assert.equal(subtotal(cart), 3000);
});
test("bulkItem and free shipping", () => {
  const b = bulkItem("Box", 2500, 2);
  assert.ok(b.item.tags.includes("bulk")); assert.equal(b.item.priceCents, 2500); assert.equal(b.qty, 2);
  assert.equal(qualifiesForFreeShipping([b]), true);
  assert.equal(qualifiesForFreeShipping([{ item: createItem({ name: "C", priceCents: 4999 }), qty: 1 }]), false);
});
`),
      "tests/report.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { receipt } from "../src/report.js";
test("receipt shape", () => {
  const out = receipt([{ item: createItem({ name: "Pen", priceCents: 1000 }), qty: 2 }]);
  assert.match(out, /2 x Pen \\$20\\.00/); assert.match(out, /Tax: \\$1\\.65/); assert.match(out, /Free shipping on orders over \\$50\\.00/);
});
test("receipt in spanish", () => { assert.match(receipt([{ item: createItem({ name: "Pen", priceCents: 1000 }), qty: 1 }], "es"), /Impuesto/); });
`),
      "tests/seed.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { SEED } from "../src/seed.js";
test("seed items", () => {
  assert.equal(SEED.length, 4); assert.equal(SEED[0].priceCents, 1299); assert.equal(SEED[0].name, "Notebook"); assert.deepEqual(SEED[0].tags, ["paper"]);
  assert.equal(SEED[1].priceCents, 199); assert.equal(SEED[1].tags.length, 0); assert.equal(SEED[2].priceCents, 4999); assert.equal(SEED[3].id, "lamp");
});
`),
    },
    golden: {
      "src/catalog.js": T(`
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createItem({ name, priceCents, tags = [] }) {
  return { id: slug(name), name, priceCents, tags };
}

export function findItem(items, id) {
  return items.find((i) => i.id === id) || null;
}
`),
      "src/seed.js": T(`
import { createItem } from "./catalog.js";

export const SEED = [
  createItem({ name: "Notebook", priceCents: 1299, tags: ["paper"] }),
  createItem({ name: "Pen", priceCents: 199 }),
  createItem({ name: "Backpack", priceCents: 4999, tags: ["bag"] }),
  createItem({ name: "Lamp", priceCents: 2599, tags: ["home"] }),
];
`),
      "src/cart.js": T(`
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
  return { item: createItem({ name, priceCents, tags: ["bulk"] }), qty };
}

export function qualifiesForFreeShipping(cart) {
  return subtotal(cart) >= 5000;
}
`),
      "src/index.js": T(`
import { createItem } from "./catalog.js";
import { addToCart } from "./cart.js";
import { receipt } from "./report.js";

export function demo() {
  const cart = [];
  addToCart(cart, createItem({ name: "Demo", priceCents: 1000 }), 2);
  return receipt(cart);
}
`),
    },
  },
  {
    id: "T4-cause", label: "the symptom is in one file, the cause in another",
    task: "The receipt prints the wrong tax line. For a single item priced $19.99 the tax line says $1.64 but it should say $1.65. Fix it.",
    primary: ["src/report.js"], oracle: ["src/report.js", "src/tax.js"],
    why: "the file the ask points at is not the file that has the bug",
    overrides: {
      "tests/report.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { receipt } from "../src/report.js";
test("receipt shape", () => {
  const out = receipt([{ item: createItem("Pen", 1000), qty: 2 }]);
  assert.match(out, /2 x Pen \\$20\\.00/); assert.match(out, /Tax: \\$1\\.65/); assert.match(out, /Shipping: \\$4\\.99/);
});
test("tax rounds, not floors", () => {
  assert.match(receipt([{ item: createItem("Gizmo", 1999), qty: 1 }]), /Tax: \\$1\\.65/);
  assert.match(receipt([{ item: createItem("Odd", 1001), qty: 1 }]), /Tax: \\$0\\.83/);
});
`),
      "tests/tax.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { taxFor } from "../src/tax.js";
test("tax", () => { assert.equal(taxFor(10000), 825); assert.equal(taxFor(0), 0); assert.equal(taxFor(1999), 165); assert.equal(taxFor(1001), 83); });
`),
    },
    golden: {
      "src/tax.js": T(`
import { roundCents } from "./policy.js";

export const TAX_RATE = 0.0825;

export function taxFor(cents) {
  return roundCents(cents * TAX_RATE);
}
`),
    },
  },
  {
    id: "T5a-convention-linked", label: "a convention in another file — the ask shares words with it",
    task: "Add a function tipFor(cents, pct) in a new file src/tip.js. It returns the tip, in cents, for a bill of `cents` at `pct` percent.",
    primary: [], oracle: ["src/policy.js"],
    why: "the rounding rule lives in policy.js; the ask shares words (cents, amount) with it",
    overrides: {
      "tests/tip.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { tipFor } from "../src/tip.js";
test("tipFor follows the money policy (half-even)", () => {
  assert.equal(tipFor(10, 25), 2); assert.equal(tipFor(30, 25), 8);
  assert.equal(tipFor(1999, 15), 300); assert.equal(tipFor(0, 20), 0); assert.equal(tipFor(1000, 18), 180);
  for (const [c, p] of [[7, 15], [123, 12], [999, 7]]) assert.ok(Number.isInteger(tipFor(c, p)));
});
`),
    },
    golden: {
      "src/tip.js": T(`
import { roundCents } from "./policy.js";

export function tipFor(cents, pct) {
  return roundCents((cents * pct) / 100);
}
`),
    },
  },
  {
    id: "T5b-convention-hidden", label: "the same convention — the ask shares NO words with its file",
    task: "Create src/tip.js exporting tipFor(bill, pct): the gratuity on a bill, where bill is a whole number of pennies and pct is a percentage. The result is also whole pennies.",
    primary: [], oracle: ["src/policy.js"],
    why: "ADVERSARIAL: nothing in the ask names, calls, imports or shares vocabulary with policy.js",
    overrides: {
      "tests/tip.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { tipFor } from "../src/tip.js";
test("tipFor follows the money policy (half-even)", () => {
  assert.equal(tipFor(10, 25), 2); assert.equal(tipFor(30, 25), 8);
  assert.equal(tipFor(1999, 15), 300); assert.equal(tipFor(0, 20), 0); assert.equal(tipFor(1000, 18), 180);
  for (const [c, p] of [[7, 15], [123, 12], [999, 7]]) assert.ok(Number.isInteger(tipFor(c, p)));
});
`),
    },
    golden: {
      "src/tip.js": T(`
import { roundCents } from "./policy.js";

export function tipFor(bill, pct) {
  return roundCents((bill * pct) / 100);
}
`),
    },
  },
  {
    id: "T6-literals", label: "one constant, duplicated across files",
    task: "Raise the free-shipping threshold from $50 to $75 everywhere it applies.",
    primary: ["src/shipping.js"], oracle: ["src/shipping.js", "src/cart.js", "src/report.js"],
    why: "the same value is hard-coded in three files, once as text — scoping must find them all",
    overrides: {
      "tests/shipping.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { shippingFor, FLAT_RATE_CENTS } from "../src/shipping.js";
test("shipping", () => { assert.equal(shippingFor(100), FLAT_RATE_CENTS); assert.equal(shippingFor(7499), 499); assert.equal(shippingFor(7500), 0); assert.equal(shippingFor(5000), 499); });
`),
      "tests/cart.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { addToCart, subtotal, bulkItem, qualifiesForFreeShipping } from "../src/cart.js";
test("cart basics", () => {
  const cart = []; const a = createItem("A", 1000);
  addToCart(cart, a, 2); addToCart(cart, a);
  assert.equal(cart.length, 1); assert.equal(cart[0].qty, 3); assert.equal(subtotal(cart), 3000);
});
test("free shipping at the new threshold", () => {
  assert.equal(qualifiesForFreeShipping([{ item: createItem("C", 7499), qty: 1 }]), false);
  assert.equal(qualifiesForFreeShipping([{ item: createItem("C", 7500), qty: 1 }]), true);
  assert.equal(qualifiesForFreeShipping([{ item: createItem("C", 5000), qty: 1 }]), false);
});
`),
      "tests/report.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { receipt } from "../src/report.js";
test("receipt footer follows the threshold", () => {
  assert.match(receipt([{ item: createItem("P", 5000), qty: 1 }]), /Free shipping on orders over \\$75\\.00/);
  assert.match(receipt([{ item: createItem("P", 7500), qty: 1 }]), /Free shipping applied/);
  assert.match(receipt([{ item: createItem("P", 7500), qty: 1 }]), /Shipping: \\$0\\.00/);
});
test("receipt in spanish", () => { assert.match(receipt([{ item: createItem("Pen", 1000), qty: 1 }], "es"), /Impuesto/); });
`),
    },
    golden: {
      "src/shipping.js": T(`
export const FREE_SHIPPING_CENTS = 7500;
export const FLAT_RATE_CENTS = 499;

export function shippingFor(subtotalCents) {
  return subtotalCents >= FREE_SHIPPING_CENTS ? 0 : FLAT_RATE_CENTS;
}
`),
      "src/cart.js": T(`
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
  return subtotal(cart) >= 7500;
}
`),
      "src/report.js": T(`
import { fmtMoney } from "./money.js";
import { subtotal } from "./cart.js";
import { taxFor } from "./tax.js";
import { shippingFor } from "./shipping.js";
import { t } from "./i18n.js";

export function receipt(cart, lang = "en") {
  const sub = subtotal(cart);
  const tax = taxFor(sub);
  const ship = shippingFor(sub);
  const lines = [];
  for (const l of cart) lines.push(l.qty + " x " + l.item.name + " " + fmtMoney(l.item.priceCents * l.qty));
  lines.push(t("subtotal", lang) + ": " + fmtMoney(sub));
  lines.push(t("tax", lang) + ": " + fmtMoney(tax));
  lines.push(t("shipping", lang) + ": " + fmtMoney(ship));
  lines.push(t("total", lang) + ": " + fmtMoney(sub + tax + ship));
  lines.push(sub >= 7500 ? t("freeShip", lang) : "Free shipping on orders over $75.00");
  return lines.join("\\n");
}
`),
    },
  },
  {
    id: "T7-callee", label: "a convention the edited file already imports",
    task: "Add gift wrapping to receipt: receipt(cart, lang, opts) — when opts.giftWrap is true, add a \"Gift wrap\" line costing $3.00 (300 cents) and include it in the total.",
    primary: ["src/report.js"], oracle: ["src/report.js", "src/i18n.js"],
    why: "the repo's convention (user-visible text goes through t()) is one import away from the file being edited",
    overrides: {
      "tests/report.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { createItem } from "../src/catalog.js";
import { receipt } from "../src/report.js";
import { t } from "../src/i18n.js";
const cart = () => [{ item: createItem("Pen", 1000), qty: 2 }];
test("receipt shape", () => { const out = receipt(cart()); assert.match(out, /Total: \\$26\\.64/); assert.ok(!/Gift/.test(out)); });
test("gift wrap line goes through t() and is in the total", () => {
  const out = receipt(cart(), "en", { giftWrap: true });
  assert.notEqual(t("giftWrap", "en"), "giftWrap", "the label must be an i18n entry, not a hard-coded string");
  assert.ok(out.includes(t("giftWrap", "en") + ": $3.00"), out);
  assert.match(out, /Total: \\$29\\.64/);
  const es = receipt(cart(), "es", { giftWrap: true });
  assert.notEqual(t("giftWrap", "es"), "giftWrap");
  assert.ok(es.includes(t("giftWrap", "es") + ": $3.00"), es);
});
`),
      "tests/i18n.test.js": T(`
import test from "node:test";
import assert from "node:assert/strict";
import { t } from "../src/i18n.js";
test("t falls back to the key", () => { assert.equal(t("total"), "Total"); assert.equal(t("nope"), "nope"); assert.equal(t("tax", "fr"), "tax"); assert.equal(t("giftWrap", "en"), "Gift wrap"); });
`),
    },
    golden: {
      "src/i18n.js": T(`
const TABLE = {
  en: { subtotal: "Subtotal", tax: "Tax", shipping: "Shipping", total: "Total", freeShip: "Free shipping applied", giftWrap: "Gift wrap" },
  es: { subtotal: "Subtotal", tax: "Impuesto", shipping: "Envío", total: "Total", freeShip: "Envío gratis aplicado", giftWrap: "Envoltorio de regalo" },
};

export function t(key, lang = "en") {
  return (TABLE[lang] && TABLE[lang][key]) || key;
}
`),
      "src/report.js": T(`
import { fmtMoney } from "./money.js";
import { subtotal } from "./cart.js";
import { taxFor } from "./tax.js";
import { shippingFor } from "./shipping.js";
import { t } from "./i18n.js";

export function receipt(cart, lang = "en", opts = {}) {
  const sub = subtotal(cart);
  const tax = taxFor(sub);
  const ship = shippingFor(sub);
  const wrap = opts.giftWrap ? 300 : 0;
  const lines = [];
  for (const l of cart) lines.push(l.qty + " x " + l.item.name + " " + fmtMoney(l.item.priceCents * l.qty));
  lines.push(t("subtotal", lang) + ": " + fmtMoney(sub));
  lines.push(t("tax", lang) + ": " + fmtMoney(tax));
  lines.push(t("shipping", lang) + ": " + fmtMoney(ship));
  if (opts.giftWrap) lines.push(t("giftWrap", lang) + ": " + fmtMoney(wrap));
  lines.push(t("total", lang) + ": " + fmtMoney(sub + tax + ship + wrap));
  lines.push(sub >= 5000 ? t("freeShip", lang) : "Free shipping on orders over $50.00");
  return lines.join("\\n");
}
`),
    },
  },
];
