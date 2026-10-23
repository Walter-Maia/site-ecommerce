import type { Appearance, SceneView } from "@/lib/provador/contract";
import { BODY_LIMITS } from "@/lib/types";
import type { GarmentSlot, HairStyle, LookBodySettings, MannequinPreset, MannequinStyle, Size } from "@/lib/types";
import { removeSlot, UI_SLOTS, type Outfit } from "./slots";
import type { ProvadorData } from "./types";

export const HAIR_STYLE_LABEL: Record<HairStyle, string> = {
  raspado: "Raspado",
  curto: "Curto",
  "cacheado-curto": "Cacheado curto",
  "black-power": "Black power",
  trancas: "Tranças",
  "maria-chiquinha": "Maria-chiquinha",
  coque: "Coque",
  "rabo-de-cavalo": "Rabo de cavalo",
  "longo-liso": "Longo liso",
};
export const HAIR_STYLES = Object.keys(HAIR_STYLE_LABEL) as HairStyle[];

export interface FittingState {
  mannequinId: string;
  heightCm: number;
  weightKg: number;
  appearance: Appearance;
  outfit: Outfit;
  /** Depois que o cliente mexe, trocar de manequim não reseta suas medidas; looks prontos não trocam o personagem. */
  touchedBody: boolean;
  touchedAppearance: boolean;
  selectedLookId: string | null;
  appliedLookId: string | null;
  view: SceneView;
  autoRotate: boolean;
  spin: number;
}

export type FittingAction =
  | { type: "mannequin"; preset: MannequinPreset }
  | { type: "body"; heightCm?: number; weightKg?: number }
  | { type: "resetBody"; preset: MannequinPreset }
  | { type: "appearance"; patch: Partial<Appearance> }
  /** Look novo já calculado com as regras de slot do motor (slots.ts → wearProduct). */
  | { type: "setOutfit"; outfit: Outfit }
  | { type: "remove"; slot: GarmentSlot }
  | { type: "size"; slot: GarmentSlot; size: Size }
  | { type: "applyLook"; lookId: string; outfit: Outfit; preset?: MannequinPreset; saved?: LookBodySettings }
  | { type: "clear" }
  | { type: "select"; lookId: string | null }
  | { type: "view"; view: SceneView }
  | { type: "autoRotate"; value: boolean }
  | { type: "spin" }
  | { type: "hydrate"; state: FittingState };

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

export function appearanceOf(p: MannequinPreset): Appearance {
  return { skinTone: p.skinTone, hairStyle: p.hairStyle, hairColor: p.hairColor, style: p.style };
}

/** Trocar de manequim traz a aparência dele; as medidas do cliente ficam se ele já mexeu. */
function withPreset(s: FittingState, p: MannequinPreset): FittingState {
  return {
    ...s,
    mannequinId: p.id,
    heightCm: s.touchedBody ? s.heightCm : p.heightCm,
    weightKg: s.touchedBody ? s.weightKg : p.weightKg,
    appearance: appearanceOf(p),
    touchedAppearance: false,
  };
}

export function fittingReducer(s: FittingState, a: FittingAction): FittingState {
  switch (a.type) {
    case "mannequin":
      return withPreset(s, a.preset);
    case "body":
      return {
        ...s,
        touchedBody: true,
        heightCm: a.heightCm === undefined ? s.heightCm : clamp(a.heightCm, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max),
        weightKg: a.weightKg === undefined ? s.weightKg : clamp(a.weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max),
      };
    case "resetBody":
      return { ...s, touchedBody: false, heightCm: a.preset.heightCm, weightKg: a.preset.weightKg };
    case "appearance":
      return { ...s, touchedAppearance: true, appearance: { ...s.appearance, ...a.patch } };
    case "setOutfit":
      return { ...s, outfit: a.outfit, appliedLookId: null };
    case "remove":
      return { ...s, outfit: removeSlot(s.outfit, a.slot), appliedLookId: null };
    case "size": {
      const cur = s.outfit[a.slot];
      if (!cur) return s;
      return { ...s, outfit: { ...s.outfit, [a.slot]: { ...cur, size: a.size } } };
    }
    case "applyLook": {
      let next: FittingState = { ...s, outfit: a.outfit, appliedLookId: a.lookId, selectedLookId: a.lookId };
      if (a.saved) {
        next = {
          ...next,
          mannequinId: a.saved.mannequinId,
          heightCm: a.saved.heightCm,
          weightKg: a.saved.weightKg,
          appearance: { skinTone: a.saved.skinTone, hairColor: a.saved.hairColor, hairStyle: a.saved.hairStyle, style: a.saved.style },
          touchedBody: true,
          touchedAppearance: true,
        };
      } else if (a.preset) {
        next = withPreset(next, a.preset);
      }
      return next;
    }
    case "clear":
      return { ...s, outfit: {}, appliedLookId: null };
    case "select":
      return { ...s, selectedLookId: a.lookId };
    case "view":
      return { ...s, view: a.view, autoRotate: a.view === "livre" ? s.autoRotate : false };
    case "autoRotate":
      return { ...s, autoRotate: a.value, view: a.value ? "livre" : s.view };
    case "spin":
      return { ...s, spin: s.spin + 1, view: "livre" };
    case "hydrate":
      return a.state;
  }
}

export function initialFittingState(preset: MannequinPreset): FittingState {
  return {
    mannequinId: preset.id,
    heightCm: preset.heightCm,
    weightKg: preset.weightKg,
    appearance: appearanceOf(preset),
    outfit: {},
    touchedBody: false,
    touchedAppearance: false,
    selectedLookId: null,
    appliedLookId: null,
    view: "frente",
    autoRotate: false,
    spin: 0,
  };
}

/* ───────────── Persistência local (look em andamento) ───────────── */

export const STORAGE_KEY = "provador.look.v1";
/** Chaves antigas lidas uma vez para não perder o look em andamento. */
export const LEGACY_STORAGE_KEYS = ["quadra.provador.v1"] as const;

const HEX = /^#[0-9a-f]{6}$/i;
const STYLES: MannequinStyle[] = ["formal", "informal"];

type Persisted = Omit<FittingState, "spin" | "view">;

export function serializeState(s: FittingState): string {
  const { spin: _spin, view: _view, ...rest } = s;
  void _spin;
  void _view;
  return JSON.stringify(rest satisfies Persisted);
}

/** Lê o JSON salvo e descarta tudo que não bater com o catálogo/manequins atuais. */
export function parsePersisted(raw: string | null, data: ProvadorData): FittingState | null {
  if (!raw) return null;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const preset = data.mannequins.find((m) => m.id === v.mannequinId) ?? data.mannequins[0];
  if (!preset) return null;
  const base = initialFittingState(preset);
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  const ap = (v.appearance ?? {}) as Partial<Record<keyof Appearance, unknown>>;
  const appearance: Appearance = {
    skinTone: typeof ap.skinTone === "string" && HEX.test(ap.skinTone) ? ap.skinTone : base.appearance.skinTone,
    hairColor: typeof ap.hairColor === "string" && HEX.test(ap.hairColor) ? ap.hairColor : base.appearance.hairColor,
    hairStyle: HAIR_STYLES.includes(ap.hairStyle as HairStyle) ? (ap.hairStyle as HairStyle) : base.appearance.hairStyle,
    style: STYLES.includes(ap.style as MannequinStyle) ? (ap.style as MannequinStyle) : base.appearance.style,
  };
  const outfit: Outfit = {};
  const rawOutfit = (v.outfit ?? {}) as Record<string, { productId?: unknown; size?: unknown }>;
  for (const slot of UI_SLOTS) {
    const it = rawOutfit[slot];
    const p = it && data.products.find((x) => x.id === it.productId);
    if (p && p.garment.slot === slot && p.sizes.some((s) => s.size === it.size)) {
      outfit[slot] = { productId: p.id, size: it.size as Size };
    }
  }
  const lookIds = new Set(data.looks.map((l) => l.id));
  const str = (x: unknown) => (typeof x === "string" && lookIds.has(x) ? x : null);
  return {
    ...base,
    heightCm: clamp(num(v.heightCm, base.heightCm), BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max),
    weightKg: clamp(num(v.weightKg, base.weightKg), BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max),
    appearance,
    outfit,
    touchedBody: v.touchedBody === true,
    touchedAppearance: v.touchedAppearance === true,
    selectedLookId: str(v.selectedLookId),
    appliedLookId: str(v.appliedLookId),
    autoRotate: v.autoRotate === true,
  };
}
