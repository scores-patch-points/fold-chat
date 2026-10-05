const TABLE = {
  en: { subtotal: "Subtotal", tax: "Tax", shipping: "Shipping", total: "Total", freeShip: "Free shipping applied" },
  es: { subtotal: "Subtotal", tax: "Impuesto", shipping: "Envío", total: "Total", freeShip: "Envío gratis aplicado" },
};

export function t(key, lang = "en") {
  return (TABLE[lang] && TABLE[lang][key]) || key;
}
