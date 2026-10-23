import { PRODUCTS } from "@/data/catalog";
import { CURATED_LOOKS } from "@/data/mannequins";
import { CATEGORIES } from "@/data/site";
import type { Category, CategorySlug, CuratedLook, Product, ProductQuery } from "@/lib/types";
import { compareProducts, matchesGender, matchesTerms, productSearchText, searchTerms } from "../catalog-query";

/**
 * Demo estática: mesmo CONTRATO de src/server/catalog.ts, lido de src/data
 * (sem SQLite). No build:pages, `@/server/catalog` aponta para cá.
 * Os preços/estoques são os do catálogo-semente (o admin não existe aqui).
 */

const MAX_LIMIT = 100;

const INDEX = PRODUCTS.map((p, position) => ({ p, position, text: productSearchText(p) }));

export async function listProducts(query: ProductQuery = {}): Promise<{ items: Product[]; total: number }> {
  const ids = query.ids ? new Set(query.ids.filter((id) => typeof id === "string").slice(0, 200)) : null;
  const terms = query.q ? searchTerms(query.q) : [];
  const rows = INDEX.filter(({ p, text }) => {
    if (ids && !ids.has(p.id)) return false;
    if (query.category && p.category !== query.category) return false;
    if (query.gender && !matchesGender(p.gender, query.gender)) return false;
    if (query.formality && p.garment.formality !== query.formality) return false;
    if (query.slot && p.garment.slot !== query.slot) return false;
    return matchesTerms(text, terms);
  });
  const cmp = compareProducts(query.sort ?? "relevancia");
  rows.sort((a, b) => cmp({ ...a.p, position: a.position }, { ...b.p, position: b.position }));
  const offset = Math.max(0, Math.trunc(Number(query.offset ?? 0)) || 0);
  const limit = query.limit != null ? Math.max(0, Math.min(MAX_LIMIT, Math.trunc(Number(query.limit)) || 0)) : Infinity;
  return { items: rows.slice(offset, offset + limit).map((r) => r.p), total: rows.length };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (typeof slug !== "string" || slug.length > 120) return null;
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return (await listProducts({ ids, sort: "relevancia" })).items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

export async function searchProducts(q: string, limit = 12): Promise<Product[]> {
  return (await listProducts({ q, limit })).items;
}

export async function listCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export async function getCategory(slug: string): Promise<Category | null> {
  return CATEGORIES.find((c) => c.slug === (slug as CategorySlug)) ?? null;
}

export async function listCuratedLooks(): Promise<CuratedLook[]> {
  return CURATED_LOOKS;
}

/** Posição de cada produto no catálogo (desempate da ordenação no cliente). */
export function productPosition(id: string): number {
  return INDEX.findIndex((r) => r.p.id === id);
}
