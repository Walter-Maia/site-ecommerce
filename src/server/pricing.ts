import "server-only";
import { FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD } from "@/data/site";

/** Regras de preço num lugar só (carrinho, checkout e testes usam a mesma função). */
export const MAX_QTY_PER_LINE = 10;
export const MAX_CART_LINES = 30;

export function shippingFor(subtotal: number): number {
  return subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
}

export function computeTotals(lines: { unitPrice: number; quantity: number }[]) {
  let subtotal = 0;
  let itemCount = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) throw new Error("preço inválido");
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new Error("quantidade inválida");
    subtotal += l.unitPrice * l.quantity;
    itemCount += l.quantity;
  }
  const shipping = shippingFor(subtotal);
  return { subtotal, shipping, total: subtotal + shipping, itemCount };
}
