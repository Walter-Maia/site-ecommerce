import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/catalog";
import type { GarmentKind } from "@/lib/types";
import { estimateMeasurements } from "@/lib/provador/fit";
import {
  FIT_SLOTS, GARMENT_KIND_LABELS, LAYER_ORDER, SLOT_LABELS, SLOT_ORDER,
  applyItemToOutfit, dressItem, occupiedSlots, outfitCompleteness, removeFromOutfit, slotHasFit, sortByLayer,
} from "@/lib/provador/outfit";

/** Produtos pelo id (estável) — os slugs mudam quando a marca é renomeada. */
const P = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`produto ausente: ${id}`);
  return p;
};
const m = estimateMeasurements({ body: "feminino", heightCm: 166, weightKg: 58 });
const item = (id: string) => dressItem(P(id), m);

const BABY_TEE = "p17";
const RIB_TANK = "p18";
const MINI_SKIRT = "p20";
const BLAZER = "p14";
const SLIP_DRESS = "p22";
const MIDI_SKIRT = "p19";
const VARSITY = "p08";
const SNEAKER = "p27";
const JERSEY_DRESS = "p21";
const SKATE_TEE = "p29";
const FLANNEL = "p32";
const CARGO = "p34";
const BEANIE = "p37";
const SKATE_SHOE = "p38";
const SKATEBOARD = "p40";

describe("applyItemToOutfit", () => {
  it("um item por slot", () => {
    let o = applyItemToOutfit([], item(BABY_TEE));
    o = applyItemToOutfit(o, item(RIB_TANK));
    expect(o.map((x) => x.product.id)).toEqual([RIB_TANK]);
  });

  it("vestido remove top e bottom; top/bottom removem vestido", () => {
    let o = applyItemToOutfit([], item(BABY_TEE));
    o = applyItemToOutfit(o, item(MINI_SKIRT));
    o = applyItemToOutfit(o, item(BLAZER));
    o = applyItemToOutfit(o, item(SLIP_DRESS));
    expect(o.map((x) => x.product.garment.slot).sort()).toEqual(["full", "outer"]);
    o = applyItemToOutfit(o, item(MIDI_SKIRT));
    expect(o.map((x) => x.product.garment.slot).sort()).toEqual(["bottom", "outer"]);
  });

  it("ordena de dentro para fora e calcula ocupação", () => {
    let o = applyItemToOutfit([], item(VARSITY));
    o = applyItemToOutfit(o, item(SNEAKER));
    o = applyItemToOutfit(o, item(RIB_TANK));
    expect(o.map((x) => x.product.garment.slot)).toEqual(["feet", "top", "outer"]);
    expect(outfitCompleteness(o)).toBe(0.5);
    o = applyItemToOutfit(o, item(JERSEY_DRESS));
    expect(occupiedSlots(o).has("bottom")).toBe(true);
    expect(removeFromOutfit(o, { slot: "outer" }).length).toBe(2);
  });

  it("o skate (prop) é independente: não remove peças e só troca outro objeto na mão", () => {
    let o = applyItemToOutfit([], item(SKATE_TEE));
    o = applyItemToOutfit(o, item(CARGO));
    o = applyItemToOutfit(o, item(SKATEBOARD));
    expect(o.map((x) => x.product.garment.slot)).toEqual(["bottom", "top", "prop"]);
    // vestido no lugar de top + bottom mantém o skate
    o = applyItemToOutfit(o, item(SLIP_DRESS));
    expect(o.map((x) => x.product.garment.slot).sort()).toEqual(["full", "prop"]);
    // outro objeto na mão substitui o anterior
    const other = { ...item(SKATEBOARD), product: { ...P(SKATEBOARD), id: "prop-2" } };
    o = applyItemToOutfit(o, other);
    expect(o.filter((x) => x.product.garment.slot === "prop").map((x) => x.product.id)).toEqual(["prop-2"]);
    expect(removeFromOutfit(o, { slot: "prop" }).map((x) => x.product.garment.slot)).toEqual(["full"]);
  });

  it("o prop fica sempre por último na ordem de camadas", () => {
    const o = sortByLayer([item(SKATEBOARD), item(BEANIE), item(FLANNEL), item(SKATE_SHOE)]);
    // a flanela (p32) é sobreposição: vai aberta por cima da camiseta
    expect(o.map((x) => x.product.garment.slot)).toEqual(["feet", "outer", "head", "prop"]);
  });
});

describe("outfitCompleteness", () => {
  it("não conta o prop", () => {
    expect(outfitCompleteness([item(SKATEBOARD)])).toBe(0);
    const look = [BEANIE, SKATE_TEE, CARGO, SKATE_SHOE].map(item);
    expect(outfitCompleteness(look)).toBe(1);
    expect(outfitCompleteness([...look, item(SKATEBOARD)])).toBe(1);
  });
});

describe("rótulos e ordens", () => {
  it("slot prop: rótulo, ordem de exibição e de camadas", () => {
    expect(SLOT_LABELS.prop).toBe("Na mão");
    expect(SLOT_ORDER.at(-1)).toBe("prop");
    expect(LAYER_ORDER.at(-1)).toBe("prop");
    expect(new Set(SLOT_ORDER).size).toBe(Object.keys(SLOT_LABELS).length);
    expect(new Set(LAYER_ORDER).size).toBe(Object.keys(SLOT_LABELS).length);
  });

  it("prop não tem selo de caimento", () => {
    expect(slotHasFit("prop")).toBe(false);
    expect(slotHasFit("feet")).toBe(true);
    expect(FIT_SLOTS).not.toContain("prop");
  });

  it("todo tipo de peça do catálogo tem rótulo em pt-BR", () => {
    const kinds = new Set<GarmentKind>(PRODUCTS.map((p) => p.garment.kind));
    for (const k of kinds) expect(GARMENT_KIND_LABELS[k]?.length).toBeGreaterThan(2);
    expect(GARMENT_KIND_LABELS.longTee).toBe("Camiseta manga longa");
    expect(GARMENT_KIND_LABELS.skateboard).toBe("Skate completo");
    expect(GARMENT_KIND_LABELS.beanie).toBe("Gorro");
  });
});
