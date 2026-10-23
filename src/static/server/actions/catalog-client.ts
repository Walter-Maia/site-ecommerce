import type { Product } from "@/lib/types";

/**
 * Catálogo para as "ações" da demo estática, carregado sob demanda (chunk
 * separado): só baixa na primeira ação (adicionar à sacola, curtir, salvar
 * look, finalizar pedido) e não pesa no carregamento de cada página.
 */
let cache: Promise<Map<string, Product>> | null = null;

export function catalogById(): Promise<Map<string, Product>> {
  cache ??= import("@/data/catalog").then(({ PRODUCTS }) => new Map(PRODUCTS.map((p) => [p.id, p])));
  return cache;
}

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
