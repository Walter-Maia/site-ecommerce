import "server-only";
import { CATEGORIES } from "@/data/site";
import { CURATED_LOOKS } from "@/data/mannequins";
import type { Category, CategorySlug, CuratedLook, Product, ProductQuery, ProductSort, ProductVariantStock } from "@/lib/types";
import { all, get, type Param } from "./db/client";
import { toProduct, type ProductRow, type SizeRow } from "./db/mappers";
import { escapeLike, normalizeSearch } from "./util";

/**
 * CONTRATO (assinaturas estáveis). Leitura do catálogo no SQLite.
 * Toda condição usa placeholder; ORDER BY vem de uma lista fechada.
 */

const ORDER_BY: Record<ProductSort, string> = {
  relevancia: "is_featured DESC, review_count DESC, position ASC",
  novidades: "created_at DESC, position ASC",
  "menor-preco": "price ASC, position ASC",
  "maior-preco": "price DESC, position ASC",
};

const MAX_LIMIT = 100;

function sizesFor(ids: string[]): Map<string, ProductVariantStock[]> {
  const map = new Map<string, ProductVariantStock[]>();
  if (ids.length === 0) return map;
  const rows = all<SizeRow>(
    "SELECT product_id, size, stock FROM product_sizes WHERE product_id IN (SELECT value FROM json_each(?)) ORDER BY product_id, position",
    JSON.stringify(ids),
  );
  for (const r of rows) {
    const list = map.get(r.product_id) ?? [];
    list.push({ size: r.size, stock: r.stock });
    map.set(r.product_id, list);
  }
  return map;
}

export function hydrateProducts(rows: ProductRow[]): Product[] {
  const sizes = sizesFor(rows.map((r) => r.id));
  return rows.map((r) => toProduct(r, sizes.get(r.id) ?? []));
}

export async function listProducts(query: ProductQuery = {}): Promise<{ items: Product[]; total: number }> {
  const where: string[] = [];
  const params: Param[] = [];

  if (query.ids) {
    where.push("id IN (SELECT value FROM json_each(?))");
    params.push(JSON.stringify(query.ids.filter((id) => typeof id === "string").slice(0, 200)));
  }
  if (query.category) {
    where.push("category = ?");
    params.push(String(query.category));
  }
  if (query.gender) {
    where.push("(gender = ? OR gender = 'unissex')");
    params.push(String(query.gender));
  }
  if (query.formality) {
    where.push("json_extract(garment, '$.formality') = ?");
    params.push(String(query.formality));
  }
  if (query.slot) {
    where.push("json_extract(garment, '$.slot') = ?");
    params.push(String(query.slot));
  }
  if (query.q) {
    const terms = normalizeSearch(String(query.q).slice(0, 100)).split(/\s+/).filter(Boolean).slice(0, 6);
    for (const t of terms) {
      where.push("search_text LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(t)}%`);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql = ORDER_BY[query.sort ?? "relevancia"] ?? ORDER_BY.relevancia;
  const limit = query.limit != null ? Math.max(0, Math.min(MAX_LIMIT, Math.trunc(Number(query.limit)) || 0)) : -1;
  const offset = Math.max(0, Math.trunc(Number(query.offset ?? 0)) || 0);

  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM products ${whereSql}`, ...params)?.n ?? 0;
  const rows = all<ProductRow>(
    `SELECT * FROM products ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );
  return { items: hydrateProducts(rows), total: Number(total) };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (typeof slug !== "string" || slug.length > 120) return null;
  const row = get<ProductRow>("SELECT * FROM products WHERE slug = ?", slug);
  return row ? hydrateProducts([row])[0] : null;
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
