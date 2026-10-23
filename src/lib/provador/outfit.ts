import type { GarmentKind, GarmentSlot, Size } from "@/lib/types";
import type { BodyMeasurements, FitLabel, GarmentProduct, WornItem } from "./contract";
import { computeFit, recommendSize } from "./fit";

/** Rótulos de slot em pt-BR (filtros, HUD, leitores de tela). */
export const SLOT_LABELS: Record<GarmentSlot, string> = {
  head: "Cabeça",
  top: "Parte de cima",
  outer: "Sobreposição",
  bottom: "Parte de baixo",
  full: "Vestido",
  feet: "Pés",
  prop: "Na mão",
};

/** Ordem de exibição na UI (de cima para baixo no corpo; o objeto na mão por último). */
export const SLOT_ORDER: GarmentSlot[] = ["head", "outer", "top", "full", "bottom", "feet", "prop"];

/** Ordem de camadas, de dentro para fora (é a ordem em que o motor veste). O prop fica fora do corpo. */
export const LAYER_ORDER: GarmentSlot[] = ["feet", "bottom", "top", "full", "outer", "head", "prop"];

/** Slots que entram no cálculo de caimento e de tamanho (o "prop" é segurado, não vestido). */
export const FIT_SLOTS: readonly GarmentSlot[] = ["head", "top", "outer", "bottom", "full", "feet"];

/** O slot tem selo de caimento/tamanho? (falso para o skate na mão). */
export const slotHasFit = (slot: GarmentSlot) => slot !== "prop";

export const GARMENT_KIND_LABELS: Record<GarmentKind, string> = {
  tee: "Camiseta",
  babyTee: "Baby tee",
  tank: "Regata",
  ribTank: "Top canelado",
  jersey: "Camisa esportiva",
  shirt: "Camisa",
  hoodie: "Moletom canguru",
  croppedHoodie: "Moletom cropped",
  crewneck: "Moletom careca",
  varsityJacket: "Jaqueta varsity",
  windbreaker: "Corta-vento",
  blazer: "Blazer",
  shorts: "Bermuda",
  meshShorts: "Bermuda mesh",
  sweatpants: "Calça de moletom",
  jeans: "Calça jeans",
  trousers: "Calça de alfaiataria",
  wideTrousers: "Calça wide leg",
  miniSkirt: "Minissaia",
  midiSkirt: "Saia midi",
  dress: "Vestido",
  slipDress: "Slip dress",
  cap: "Boné",
  sneaker: "Tênis",
  loafer: "Mocassim",
  longTee: "Camiseta manga longa",
  zipHoodie: "Moletom com zíper",
  workJacket: "Jaqueta workwear",
  cargoPants: "Calça cargo",
  cargoShorts: "Bermuda cargo",
  beanie: "Gorro",
  skateShoe: "Tênis de skate",
  skateboard: "Skate completo",
};

/** Texto e tom sugeridos para o selo de caimento. */
export const FIT_LABEL_UI: Record<FitLabel, { text: string; tone: "warn" | "ok" | "info" }> = {
  apertado: { text: "APERTADO", tone: "warn" },
  justo: { text: "JUSTO", tone: "info" },
  ideal: { text: "IDEAL", tone: "ok" },
  solto: { text: "SOLTO", tone: "info" },
  grande: { text: "GRANDE", tone: "warn" },
};

type Slotted = { product: Pick<GarmentProduct, "id" | "garment"> };

const slotOf = (it: Slotted) => it.product.garment.slot;

/**
 * Veste uma peça respeitando as regras de slot:
 * - um item por slot (a peça nova substitui a antiga do mesmo slot);
 * - `full` (vestido) remove `top` e `bottom`; `top` ou `bottom` removem `full`;
 * - `outer` fica sempre por cima de `top`/`full` (sem top, o manequim mostra a base neutra);
 * - `prop` (skate) é independente: só substitui outro objeto na mão.
 * Retorna um novo array ordenado por camada (de dentro para fora).
 */
export function applyItemToOutfit<T extends Slotted>(outfit: readonly T[], item: T): T[] {
  const slot = slotOf(item);
  const removes = new Set<GarmentSlot>([slot]);
  if (slot === "full") {
    removes.add("top");
    removes.add("bottom");
  }
  if (slot === "top" || slot === "bottom") removes.add("full");
  const next = outfit.filter((it) => !removes.has(slotOf(it)) && it.product.id !== item.product.id);
  next.push(item);
  return sortByLayer(next);
}

/** Remove a peça (por id do produto) ou tudo de um slot. */
export function removeFromOutfit<T extends Slotted>(outfit: readonly T[], target: { productId?: string; slot?: GarmentSlot }): T[] {
  return outfit.filter((it) => (target.productId ? it.product.id !== target.productId : true) && (target.slot ? slotOf(it) !== target.slot : true));
}

export function sortByLayer<T extends Slotted>(outfit: readonly T[]): T[] {
  return [...outfit].sort((a, b) => LAYER_ORDER.indexOf(slotOf(a)) - LAYER_ORDER.indexOf(slotOf(b)));
}

/** Slots ocupados (um vestido conta como top + bottom). */
export function occupiedSlots(outfit: readonly Slotted[]): Set<GarmentSlot> {
  const s = new Set<GarmentSlot>();
  for (const it of outfit) {
    const slot = slotOf(it);
    s.add(slot);
    if (slot === "full") {
      s.add("top");
      s.add("bottom");
    }
  }
  return s;
}

/** Fração do look montado (cabeça, tronco, pernas, pés) — barra de progresso do HUD. O prop não conta. */
export function outfitCompleteness(outfit: readonly Slotted[]): number {
  const s = occupiedSlots(outfit);
  const parts = [s.has("head"), s.has("top") || s.has("outer"), s.has("bottom"), s.has("feet")];
  return parts.filter(Boolean).length / parts.length;
}

/** Monta um WornItem já com o caimento calculado (tamanho recomendado se omitido). */
export function dressItem(product: GarmentProduct, measurements: BodyMeasurements, size?: Size): WornItem {
  const s = size ?? recommendSize(product, measurements);
  return { product, size: s, fit: computeFit(product, s, measurements) };
}

/** Recalcula o caimento de todo o look (ex.: depois de mexer em altura/peso). */
export function refitOutfit(outfit: readonly WornItem[], measurements: BodyMeasurements): WornItem[] {
  return outfit.map((it) => ({ ...it, fit: computeFit(it.product, it.size, measurements) }));
}
