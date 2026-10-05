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
  lines.push(sub >= 5000 ? t("freeShip", lang) : "Free shipping on orders over $50.00");
  return lines.join("\n");
}
