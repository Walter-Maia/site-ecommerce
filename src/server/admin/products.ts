import "server-only";
import type { Product } from "@/lib/types";
import { hydrateProducts } from "../catalog";
import { all, get, run, transaction } from "../db/client";
import type { ProductRow } from "../db/mappers";
import { escapeLike, nowIso, parseJson } from "../util";
import type { ProductUpdateInput } from "./schemas";

/** Dados do admin. Quem chama (página/ação) DEVE ter passado por requireAdmin(). */

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  isNew: boolean;
  isFeatured: boolean;
  totalStock: number;
  lowSizes: number;
  likes: number;
  image: string;
}

export function listProductsForAdmin(q?: string): AdminProductRow[] {
  const rows = all<{
    id: string; slug: string; name: string; category: string; price: number; compare_at_price: number | null;
    is_new: number; is_featured: number; images: string; total_stock: number; low_sizes: number; likes: number;
  }>(
    `SELECT p.id, p.slug, p.name, p.category, p.price, p.compare_at_price, p.is_new, p.is_featured, p.images,
            COALESCE((SELECT SUM(stock) FROM product_sizes s WHERE s.product_id = p.id), 0) AS total_stock,
            (SELECT COUNT(*) FROM product_sizes s WHERE s.product_id = p.id AND s.stock <= 3) AS low_sizes,
            (SELECT COUNT(*) FROM wishlist w WHERE w.product_id = p.id) AS likes
       FROM products p
      WHERE (? IS NULL OR p.name LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\')
      ORDER BY p.position`,
    q ? q : null,
    q ? `%${escapeLike(q)}%` : null,
    q ? `%${escapeLike(q)}%` : null,
  );
  return rows.map((r) => {
    const image = parseJson<{ src: string }[]>(r.images, [])[0]?.src ?? "";
    return {
      id: r.id, slug: r.slug, name: r.name, category: r.category, price: r.price, compareAtPrice: r.compare_at_price,
      isNew: r.is_new === 1, isFeatured: r.is_featured === 1, totalStock: r.total_stock, lowSizes: r.low_sizes,
      likes: r.likes, image,
    };
  });
}

export function getProductForAdmin(id: string): Product | null {
  const row = get<ProductRow>("SELECT * FROM products WHERE id = ?", id);
  return row ? hydrateProducts([row])[0] : null;
}

/** Atualiza preço/flags/estoque numa transação. Devolve o "antes" para auditoria. */
export function updateProduct(id: string, input: ProductUpdateInput, stock: Record<string, number>) {
  return transaction(() => {
    const before = getProductForAdmin(id);
    if (!before) return null;
    run(
      "UPDATE products SET price = ?, compare_at_price = ?, is_new = ?, is_featured = ?, updated_at = ? WHERE id = ?",
      input.price,
      input.compareAtPrice,
      input.isNew ? 1 : 0,
      input.isFeatured ? 1 : 0,
      nowIso(),
      id,
    );
    for (const s of before.sizes) {
      if (stock[s.size] === undefined) continue;
      run("UPDATE product_sizes SET stock = ? WHERE product_id = ? AND size = ?", stock[s.size], id, s.size);
    }
    return before;
  });
}
