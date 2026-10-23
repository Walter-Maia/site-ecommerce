import type { CartView } from "@/lib/types";

/**
 * Demo estática: CONTRATO de src/server/cart.ts. No build não existe visitante,
 * então a sacola renderizada no HTML é vazia; o StoreProvider a hidrata do
 * localStorage no navegador (src/static/client/storage.ts).
 */
export async function getCart(): Promise<CartView> {
  return { lines: [], itemCount: 0, subtotal: 0, shipping: 0, total: 0 };
}
