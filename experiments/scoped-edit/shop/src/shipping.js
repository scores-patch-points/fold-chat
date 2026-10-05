export const FREE_SHIPPING_CENTS = 5000;
export const FLAT_RATE_CENTS = 499;

export function shippingFor(subtotalCents) {
  return subtotalCents >= FREE_SHIPPING_CENTS ? 0 : FLAT_RATE_CENTS;
}
