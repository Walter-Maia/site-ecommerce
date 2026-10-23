import type { GarmentSlot, LookItem, Size } from "@/lib/types";
import type { BodyMeasurements } from "@/lib/provador/contract";
import { recommendSize } from "@/lib/provador/fit";
import { applyItemToOutfit, SLOT_LABELS, SLOT_ORDER } from "@/lib/provador/outfit";
import type { ProvadorProduct } from "./types";

/** Um item por slot (forma persistida no navegador e enviada às Server Actions). */
export type Outfit = Partial<Record<GarmentSlot, LookItem>>;

/**
 * Ordem de exibição do motor (de cima para baixo no corpo). O `prop` (skate na mão)
 * entra no fim enquanto o motor não o incluir em SLOT_ORDER.
 */
export const UI_SLOTS: readonly GarmentSlot[] = SLOT_ORDER.includes("prop") ? SLOT_ORDER : [...SLOT_ORDER, "prop"];

/** Rótulo completo do slot (vem do motor; "Na mão" até o motor publicar o do prop). */
export function slotLabel(slot: GarmentSlot): string {
  return SLOT_LABELS[slot] ?? (slot === "prop" ? "Na mão" : slot);
}

/** Rótulo curto dos filtros de PEÇAS. */
export const SLOT_SHORT: Record<GarmentSlot, string> = {
  head: "Cabeça",
  top: "Cima",
  outer: "Sobreposição",
  bottom: "Baixo",
  full: "Vestido",
  feet: "Pés",
  prop: "Skate",
};

/** O skate (prop) é segurado, não vestido: sem tamanho de corpo nem selo de caimento. */
export function hasFit(slot: GarmentSlot): boolean {
  return slot !== "prop";
}

export function outfitItems(outfit: Outfit): (LookItem & { slot: GarmentSlot })[] {
  return UI_SLOTS.flatMap((slot) => (outfit[slot] ? [{ ...outfit[slot]!, slot }] : []));
}

/**
 * Veste a peça seguindo as regras de slot do motor (applyItemToOutfit) e devolve
 * o novo look e as peças que saíram (ex.: vestido tira parte de cima e de baixo).
 */
export function wearProduct(
  outfit: Outfit,
  product: ProvadorProduct,
  size: Size,
  byId: ReadonlyMap<string, ProvadorProduct>,
): { outfit: Outfit; removed: ProvadorProduct[] } {
  const current = outfitItems(outfit).flatMap((it) => {
    const p = byId.get(it.productId);
    return p ? [{ product: p, size: it.size }] : [];
  });
  const next = applyItemToOutfit(current, { product, size });
  const kept = new Set(next.map((n) => n.product.id));
  const removed = current.filter((c) => c.product.id !== product.id && !kept.has(c.product.id)).map((c) => c.product);
  const out: Outfit = {};
  for (const n of next) out[n.product.garment.slot] = { productId: n.product.id, size: n.size };
  return { outfit: out, removed };
}

export function removeSlot(outfit: Outfit, slot: GarmentSlot): Outfit {
  const next = { ...outfit };
  delete next[slot];
  return next;
}

/** Sobreposição sem nada por baixo (permitido, mas a UI avisa). */
export function outerWithoutBase(outfit: Outfit): boolean {
  return !!outfit.outer && !outfit.top && !outfit.full;
}

export function stockOf(p: ProvadorProduct, size: Size): number {
  return p.sizes.find((s) => s.size === size)?.stock ?? 0;
}

/** Tamanho recomendado; se esgotado, o mais próximo com estoque. */
export function pickSize(p: ProvadorProduct, m: BodyMeasurements): Size {
  const rec = recommendSize(p, m);
  if (stockOf(p, rec) > 0) return rec;
  const order = p.sizes.map((s) => s.size);
  const i = Math.max(0, order.indexOf(rec));
  for (let d = 1; d < order.length; d++) {
    for (const j of [i + d, i - d]) {
      const s = order[j];
      if (s && stockOf(p, s) > 0) return s;
    }
  }
  return rec;
}

/** Normaliza para busca: sem acento, minúsculas. */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
