import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { PRODUCTS } from "@/data/catalog";
import { CATEGORIES } from "@/data/site";
import { MANNEQUIN_PRESETS } from "@/data/mannequins";
import type { Product } from "@/lib/types";
import { checkPasswordStrength, hashPasswordSync } from "../auth/password";
import { newId, normalizeSearch, nowIso } from "../util";

export const ADMIN_EMAIL = "admin@kimkriss.test";

export function productSearchText(p: Pick<Product, "name" | "shortName" | "colorName" | "collection" | "category" | "tags">) {
  const category = CATEGORIES.find((c) => c.slug === p.category)?.name ?? p.category;
  return normalizeSearch([p.name, p.shortName, p.colorName, p.collection, category, ...p.tags].join(" "));
}

/** Insere o catálogo e os manequins de src/data. Idempotente (não sobrescreve edições do admin). */
export function seedCatalog(db: DatabaseSync): { products: number; mannequins: number } {
  const now = nowIso();
  const insProduct = db.prepare(`
    INSERT INTO products (id, slug, position, name, short_name, description, details, category, gender, collection,
      price, compare_at_price, color_name, color_hex, size_chart, images, garment, tags, rating, review_count,
      is_new, is_featured, search_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`);
  const insSize = db.prepare(
    "INSERT INTO product_sizes (product_id, size, stock, position) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
  );
  const insMannequin = db.prepare(`
    INSERT INTO mannequins (id, name, body, skin_tone, hair_style, hair_color, style, height_cm, weight_kg,
      active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`);

  let products = 0;
  let mannequins = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    PRODUCTS.forEach((p, position) => {
      const r = insProduct.run(
        p.id, p.slug, position, p.name, p.shortName, p.description, JSON.stringify(p.details), p.category,
        p.gender, p.collection, p.price, p.compareAtPrice ?? null, p.colorName, p.colorHex,
        JSON.stringify(p.sizeChart), JSON.stringify(p.images), JSON.stringify(p.garment), JSON.stringify(p.tags),
        p.rating, p.reviewCount, p.isNew ? 1 : 0, p.isFeatured ? 1 : 0, productSearchText(p),
        new Date(p.createdAt).toISOString(), now,
      );
      products += Number(r.changes);
      p.sizes.forEach((s, i) => insSize.run(p.id, s.size, s.stock, i));
    });
    for (const m of MANNEQUIN_PRESETS) {
      const r = insMannequin.run(
        m.id, m.name, m.body, m.skinTone, m.hairStyle, m.hairColor, m.style, m.heightCm, m.weightKg,
        m.active ? 1 : 0, m.sortOrder, now, now,
      );
      mannequins += Number(r.changes);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { products, mannequins };
}

/**
 * Garante o usuário admin. A senha vem de ADMIN_SEED_PASSWORD (.env.local),
 * nunca do código. Com `resetPassword`, troca a senha e derruba as sessões.
 */
export function ensureAdmin(
  db: DatabaseSync,
  password: string,
  opts: { resetPassword?: boolean } = {},
): "created" | "updated" | "exists" {
  const weak = checkPasswordStrength(password, { email: ADMIN_EMAIL });
  if (weak) throw new Error(`ADMIN_SEED_PASSWORD fraca: ${weak}`);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(ADMIN_EMAIL) as { id: string } | undefined;
  const now = nowIso();
  if (!existing) {
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, ?)",
    ).run(newId(), "Admin KIM KRISS", ADMIN_EMAIL, hashPasswordSync(password), now, now);
    return "created";
  }
  if (opts.resetPassword) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin', updated_at = ? WHERE id = ?").run(
      hashPasswordSync(password), now, existing.id,
    );
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
    return "updated";
  }
  return "exists";
}

/** Auto-seed na primeira conexão: catálogo se o banco está vazio; admin se houver senha no ambiente. */
export function seedIfEmpty(db: DatabaseSync, opts: { adminPassword?: string }) {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
  if (Number(count) === 0) seedCatalog(db);
  if (opts.adminPassword) {
    try {
      ensureAdmin(db, opts.adminPassword);
    } catch (err) {
      console.error("[kimkriss] admin não semeado:", (err as Error).message);
    }
  }
}
