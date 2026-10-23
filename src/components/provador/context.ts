"use client";
import { createContext, useContext, useSyncExternalStore, type Dispatch } from "react";
import type { BodyMeasurements, FitResult, WornItem } from "@/lib/provador/contract";
import type { ActionResult, CartView, GarmentSlot, MannequinPreset, SavedLook, Size } from "@/lib/types";
import type { FittingAction, FittingState } from "./state";
import type { GridLook, ProvadorData, ProvadorProduct } from "./types";

export type TabId = "looks" | "pecas" | "corpo" | "visual";
export type SheetState = "peek" | "half" | "full";

export interface WornView {
  slot: GarmentSlot;
  product: ProvadorProduct;
  size: Size;
  fit: FitResult;
  recommended: Size;
  /** false para o skate (prop): sem selo de caimento. */
  fits: boolean;
}

export interface FittingApi {
  data: ProvadorData;
  looks: GridLook[];
  state: FittingState;
  dispatch: Dispatch<FittingAction>;
  preset: MannequinPreset;
  measurements: BodyMeasurements;
  worn: WornView[];
  sceneOutfit: WornItem[];
  byId: Map<string, ProvadorProduct>;
  wishlist: ReadonlySet<string>;
  /** Caimento do look (0–100), só das peças vestidas (sem o skate). */
  lookFit: number;
  mobile: boolean;
  tab: TabId;
  sheet: SheetState;
  setSheet: (s: SheetState) => void;
  openTab: (tab: TabId, opts?: { expand?: boolean; focusSearch?: boolean }) => void;
  focusSearchSignal: number;
  consumeFocusSearch: () => void;
  isWorn: (productId: string) => boolean;
  toggleWear: (p: ProvadorProduct) => void;
  removeSlot: (slot: GarmentSlot) => void;
  toggleWish: (p: ProvadorProduct) => void;
  applyLook: (look: GridLook) => void;
  setMannequin: (id: string) => void;
  stepMannequin: (dir: 1 | -1) => void;
  spin: () => void;
  announce: (msg: string) => void;
  toast: { id: number; msg: string } | null;
  saveCurrentLook: (name: string) => Promise<ActionResult<SavedLook>>;
  buyLook: () => Promise<ActionResult<CartView>>;
  fullscreen: "off" | "native" | "pseudo";
  toggleFullscreen: () => void;
  mannequinName: (id: string) => string;
}

export const FittingContext = createContext<FittingApi | null>(null);

export function useFitting(): FittingApi {
  const v = useContext(FittingContext);
  if (!v) throw new Error("useFitting fora do <FittingRoom>");
  return v;
}

export const MOBILE_QUERY = "(max-width: 767.98px)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** matchMedia sem efeito colateral de hidratação (servidor = false). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** "1 peça" / "3 peças". */
export function pieces(n: number): string {
  return `${n} ${n === 1 ? "peça" : "peças"}`;
}
