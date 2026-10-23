import { CATEGORIES } from "@/data/site";
import type { Gender, Product, ProductSort } from "@/lib/types";

/**
 * Regras de consulta do catálogo SEM banco (demo estática). Espelham as do
 * SQLite em src/server/catalog.ts + src/server/db/seed.ts para que a vitrine,
 * a busca e os filtros no cliente deem o mesmo resultado da versão com servidor.
 * Módulo neutro: roda no build (server) e no navegador (filtros/busca).
 */

/** Minúsculas sem acento (igual a src/server/util.ts → normalizeSearch). */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Mesmo texto indexado pelo seed (coluna search_text). */
export function productSearchText(p: Pick<Product, "name" | "shortName" | "colorName" | "collection" | "category" | "tags">): string {
  const category = CATEGORIES.find((c) => c.slug === p.category)?.name ?? p.category;
  return normalizeSearch([p.name, p.shortName, p.colorName, p.collection, category, ...p.tags].join(" "));
}

/** Termos da busca (até 6), como o `LIKE %termo%` encadeado do servidor. */
export function searchTerms(q: string): string[] {
  return normalizeSearch(String(q).slice(0, 100)).split(/\s+/).filter(Boolean).slice(0, 6);
}

export function matchesTerms(searchText: string, terms: string[]): boolean {
  return terms.every((t) => searchText.includes(t));
}

/** Gênero da página/filtro: inclui as peças unissex (igual ao SQL). */
export function matchesGender(g: Gender, wanted: Gender | undefined): boolean {
  return !wanted || g === wanted || g === "unissex";
}

export type Sortable = Pick<Product, "isFeatured" | "reviewCount" | "createdAt" | "price"> & { position: number };

/** ORDER BY de src/server/catalog.ts, como comparador. */
export function compareProducts(sort: ProductSort = "relevancia"): (a: Sortable, b: Sortable) => number {
  switch (sort) {
    case "novidades":
      return (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) || a.position - b.position;
    case "menor-preco":
      return (a, b) => a.price - b.price || a.position - b.position;
    case "maior-preco":
      return (a, b) => b.price - a.price || a.position - b.position;
    default:
      return (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.reviewCount - a.reviewCount || a.position - b.position;
  }
}
