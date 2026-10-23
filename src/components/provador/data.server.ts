import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { listCuratedLooks, listProducts } from "@/server/catalog";
import { getSavedLook, listSavedLooks } from "@/server/looks";
import { listMannequins } from "@/server/mannequins";
import { getWishlistProductIds } from "@/server/wishlist";
import type { CuratedLook, Product, SavedLook } from "@/lib/types";
import { orderLooks, savedLookToGrid } from "./looks";
import type { GridLook, ProvadorData, ProvadorProduct } from "./types";

/** Só usa a imagem se o arquivo existir em /public (evita 404 enquanto as fotos são geradas). */
const IMAGES_DIR = path.join(process.cwd(), "public", "images");

export function publicImage(src: string | undefined): string | null {
  if (!src || !src.startsWith("/images/")) return null;
  try {
    const file = path.resolve(process.cwd(), "public", "." + src);
    if (!file.startsWith(IMAGES_DIR + path.sep)) return null; // bloqueia ../ (path traversal)
    return existsSync(file) ? src : null;
  } catch {
    return null;
  }
}

export function toProvadorProduct(p: Product): ProvadorProduct {
  const packshot = p.images.find((i) => i.kind === "packshot") ?? p.images[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortName: p.shortName,
    garment: p.garment,
    sizeChart: p.sizeChart,
    colorName: p.colorName,
    colorHex: p.colorHex,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: p.category,
    sizes: p.sizes.map((s) => ({ size: s.size, stock: Math.max(0, s.stock) })),
    image: publicImage(packshot?.src),
    imageAlt: packshot?.alt ?? p.name,
  };
}

function curatedToGrid(l: CuratedLook, bySlug: Map<string, ProvadorProduct>): GridLook {
  return {
    id: l.id,
    kind: "curated",
    name: l.name,
    code: l.code,
    mannequinId: l.mannequinId,
    items: l.productSlugs.flatMap((slug) => {
      const p = bySlug.get(slug);
      return p ? [{ productId: p.id }] : [];
    }),
    image: publicImage(l.thumbnail ?? `/images/provador/looks/${l.id}.webp`),
  };
}

/**
 * Tudo que o provador precisa, já enxuto para o cliente.
 * `lookId` (de ?look=) garante o look salvo do visitante via getSavedLook.
 */
export async function loadProvadorData(opts: { lookId?: string } = {}): Promise<ProvadorData> {
  const [{ items }, mannequins, curated, wishlist, savedList, requested] = await Promise.all([
    listProducts({ sort: "relevancia" }),
    listMannequins(),
    listCuratedLooks(),
    getWishlistProductIds().catch(() => [] as string[]),
    listSavedLooks().catch(() => [] as SavedLook[]),
    opts.lookId && !opts.lookId.startsWith("look-") ? getSavedLook(opts.lookId).catch(() => null) : Promise.resolve(null),
  ]);
  const saved = requested && !savedList.some((l) => l.id === requested.id) ? [requested, ...savedList] : savedList;
  const products = items.map(toProvadorProduct);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const ids = new Set(products.map((p) => p.id));
  const mannequinIds = new Set(mannequins.map((m) => m.id));
  // listSavedLooks vem do mais novo para o mais antigo; looks travados (drop futuro) não aparecem.
  const looks: GridLook[] = orderLooks([
    ...curated
      .filter((l) => !l.locked)
      .map((l) => curatedToGrid(l, bySlug))
      .filter((l) => l.items.length > 0 && mannequinIds.has(l.mannequinId)),
    ...saved.map((l, i) => savedLookToGrid(l, saved.length - i, ids)).filter((l) => l.items.length > 0),
  ]);
  return {
    products,
    mannequins,
    looks,
    wishlist: wishlist.filter((id) => ids.has(id)),
  };
}
