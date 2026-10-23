"use client";
import "./provador.css";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { BodyParams, WornItem } from "@/lib/provador/contract";
import { computeFit, estimateMeasurements, lookFitScore, recommendSize } from "@/lib/provador/fit";
import { FIT_LABEL_UI, sortByLayer } from "@/lib/provador/outfit";
import { CART_EVENT } from "@/components/loja/StoreProvider";
import { SITE } from "@/data/site";
import type { ActionResult, CartView, GarmentSlot, LookBodySettings, SavedLook } from "@/lib/types";
import { addLookToCart } from "@/server/actions/cart";
import { saveLook } from "@/server/actions/looks";
import { toggleWishlist } from "@/server/actions/wishlist";
import { FittingContext, MOBILE_QUERY, pieces, useMediaQuery, type FittingApi, type SheetState, type TabId, type WornView } from "./context";
import { LookSummary } from "./LookSummary";
import { orderLooks, savedLookToGrid } from "./looks";
import { Panel } from "./Panel";
import { hasFit, outfitItems, pickSize, stockOf, wearProduct, type Outfit } from "./slots";
import { StageView } from "./StageView";
import {
  fittingReducer,
  initialFittingState,
  LEGACY_STORAGE_KEYS,
  parsePersisted,
  serializeState,
  STORAGE_KEY,
  type FittingAction,
  type FittingState,
} from "./state";
import type { GridLook, ProvadorData, ProvadorProduct } from "./types";

interface Props {
  data: ProvadorData;
  initialLookId?: string;
  initialAddSlug?: string;
}

/* ───────────── Regras puras de montagem de estado ───────────── */

function lookToAction(look: GridLook, s: FittingState, data: ProvadorData, byId: Map<string, ProvadorProduct>): FittingAction {
  const current = data.mannequins.find((m) => m.id === s.mannequinId) ?? data.mannequins[0];
  const lookPreset = data.mannequins.find((m) => m.id === look.mannequinId);
  let outfit: Outfit = {};

  if (look.kind === "saved" && look.body) {
    const body: LookBodySettings = lookPreset ? look.body : { ...look.body, mannequinId: current.id };
    const target = lookPreset ?? current;
    const m = estimateMeasurements({ body: target.body, heightCm: body.heightCm, weightKg: body.weightKg });
    for (const it of look.items) {
      const p = byId.get(it.productId);
      if (!p) continue;
      const size = it.size && p.sizes.some((x) => x.size === it.size) ? it.size : pickSize(p, m);
      outfit = wearProduct(outfit, p, size, byId).outfit;
    }
    return { type: "applyLook", lookId: look.id, outfit, saved: body };
  }

  // Look pronto: troca de manequim só se o cliente ainda não personalizou o seu.
  const switchTo = !s.touchedBody && !s.touchedAppearance && lookPreset && lookPreset.id !== s.mannequinId ? lookPreset : undefined;
  const target = switchTo ?? current;
  const m = estimateMeasurements({
    body: target.body,
    heightCm: s.touchedBody ? s.heightCm : target.heightCm,
    weightKg: s.touchedBody ? s.weightKg : target.weightKg,
  });
  for (const it of look.items) {
    const p = byId.get(it.productId);
    if (!p) continue;
    outfit = wearProduct(outfit, p, it.size ?? pickSize(p, m), byId).outfit;
  }
  return { type: "applyLook", lookId: look.id, outfit, preset: switchTo };
}

function resolveState(
  base: FittingState | null,
  data: ProvadorData,
  byId: Map<string, ProvadorProduct>,
  lookId?: string,
  addSlug?: string,
): FittingState {
  let s = base ?? initialFittingState(data.mannequins[0]);
  const fromUrl = lookId ? data.looks.find((l) => l.id === lookId) : undefined;
  // Primeira visita: veste o primeiro look pronto do manequim inicial.
  const look = fromUrl ?? (!base ? data.looks.find((l) => l.kind === "curated" && l.mannequinId === s.mannequinId) : undefined);
  if (look) s = fittingReducer(s, lookToAction(look, s, data, byId));
  const add = addSlug ? data.products.find((p) => p.slug === addSlug) : undefined;
  if (add) {
    const preset = data.mannequins.find((m) => m.id === s.mannequinId) ?? data.mannequins[0];
    const m = estimateMeasurements({ body: preset.body, heightCm: s.heightCm, weightKg: s.weightKg });
    s = fittingReducer(s, { type: "setOutfit", outfit: wearProduct(s.outfit, add, pickSize(add, m), byId).outfit });
  }
  return s;
}

function readPersisted(): string | null {
  try {
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const raw = localStorage.getItem(key);
      if (raw) return raw;
    }
  } catch {
    /* modo privado: segue sem persistir */
  }
  return null;
}

export default function FittingRoom({ data, initialLookId, initialAddSlug }: Props) {
  const byId = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const [looks, setLooks] = useState<GridLook[]>(data.looks);
  const [state, dispatch] = useReducer(fittingReducer, null, () => resolveState(null, data, byId, initialLookId, initialAddSlug));
  const [wish, setWish] = useState<ReadonlySet<string>>(() => new Set(data.wishlist));
  const [tab, setTab] = useState<TabId>("looks");
  const [sheet, setSheet] = useState<SheetState>("peek");
  const [focusSearchSignal, setFocusSearchSignal] = useState(0);
  const consumeFocusSearch = useCallback(() => setFocusSearchSignal(0), []);
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [stageVisible, setStageVisible] = useState(true);
  const [onScreen, setOnScreen] = useState(true);
  const [fullscreen, setFullscreen] = useState<"off" | "native" | "pseudo">("off");
  const mobile = useMediaQuery(MOBILE_QUERY);
  const stageRef = useRef<HTMLElement>(null);
  const stateRef = useRef(state);
  const readyRef = useRef(false);
  const didHydrateRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  });

  const preset = data.mannequins.find((m) => m.id === state.mannequinId) ?? data.mannequins[0];
  const dataWithLooks = useMemo(() => ({ ...data, looks }), [data, looks]);

  /* ── Persistência local: salva (ignorado até hidratar) e hidrata uma vez ── */
  useEffect(() => {
    if (!readyRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeState(state));
    } catch {
      /* modo privado / cota cheia */
    }
  }, [state]);

  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;
    const persisted = parsePersisted(readPersisted(), data);
    if (persisted) dispatch({ type: "hydrate", state: resolveState(persisted, data, byId, initialLookId, initialAddSlug) });
    readyRef.current = true;
    if (initialLookId || initialAddSlug) {
      // Recarregar a página não deve reaplicar ?look/?add por cima do look em andamento.
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("look");
        url.searchParams.delete("add");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      } catch {
        /* ignore */
      }
    }
  }, [data, byId, initialLookId, initialAddSlug]);

  /* ── Derivados: medidas e caimento (fit.ts) ── */
  const bodyParams = useMemo<BodyParams>(
    () => ({ body: preset.body, heightCm: state.heightCm, weightKg: state.weightKg }),
    [preset.body, state.heightCm, state.weightKg],
  );
  const measurements = useMemo(() => estimateMeasurements(bodyParams), [bodyParams]);
  const worn = useMemo<WornView[]>(
    () =>
      outfitItems(state.outfit).flatMap((it) => {
        const product = byId.get(it.productId);
        if (!product) return [];
        const fit = computeFit(product, it.size, measurements);
        return [{ slot: it.slot, product, size: it.size, fit, recommended: recommendSize(product, measurements), fits: hasFit(it.slot) }];
      }),
    [state.outfit, byId, measurements],
  );
  // a cena recebe as peças na ordem de camadas (de dentro para fora)
  const sceneOutfit = useMemo<WornItem[]>(() => sortByLayer(worn.map((w) => ({ product: w.product, size: w.size, fit: w.fit }))), [worn]);
  const lookFit = useMemo(() => lookFitScore(sceneOutfit.filter((w) => hasFit(w.product.garment.slot))), [sceneOutfit]);

  /* ── Feedback ── */
  const announce = useCallback((msg: string) => {
    setAnnouncement(msg);
    setToast({ id: Date.now(), msg });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ── Ações ── */
  const mannequinName = useCallback((id: string) => data.mannequins.find((m) => m.id === id)?.name ?? "—", [data.mannequins]);

  const toggleWear = useCallback(
    (p: ProvadorProduct) => {
      const s = stateRef.current;
      const slot = p.garment.slot;
      if (s.outfit[slot]?.productId === p.id) {
        dispatch({ type: "remove", slot });
        announce(`Tirou ${p.shortName}.`);
        return;
      }
      const size = pickSize(p, measurements);
      const { outfit, removed } = wearProduct(s.outfit, p, size, byId);
      dispatch({ type: "setOutfit", outfit });
      const out = removed.length ? ` (saiu: ${removed.map((r) => r.shortName).join(" e ")})` : "";
      if (!hasFit(slot)) {
        announce(`${p.shortName} na mão${out}.`);
        return;
      }
      const fit = computeFit(p, size, measurements);
      announce(`Vestiu ${p.shortName} · ${size} · caimento ${FIT_LABEL_UI[fit.label].text.toLowerCase()}${out}.`);
    },
    [announce, measurements, byId],
  );

  const removeWorn = useCallback(
    (slot: GarmentSlot) => {
      const it = stateRef.current.outfit[slot];
      dispatch({ type: "remove", slot });
      const p = it ? byId.get(it.productId) : undefined;
      if (p) announce(`Tirou ${p.shortName}.`);
    },
    [announce, byId],
  );

  const toggleWish = useCallback(
    async (p: ProvadorProduct) => {
      const was = wish.has(p.id);
      const flip = (prev: ReadonlySet<string>, on: boolean) => {
        const n = new Set(prev);
        if (on) n.add(p.id);
        else n.delete(p.id);
        return n;
      };
      setWish((prev) => flip(prev, !was));
      try {
        const res = await toggleWishlist({ productId: p.id });
        if (!res.ok) throw new Error(res.error);
        setWish((prev) => flip(prev, res.data.liked));
        // a action já chama refresh(): o header recebe a lista nova
        announce(res.data.liked ? `${p.shortName} nas curtidas.` : `${p.shortName} saiu das curtidas.`);
      } catch {
        setWish((prev) => flip(prev, was));
        announce("Não deu para atualizar as curtidas agora. Tente de novo.");
      }
    },
    [wish, announce],
  );

  const applyLook = useCallback(
    (look: GridLook) => {
      const action = lookToAction(look, stateRef.current, { ...data, looks }, byId);
      dispatch(action);
      const n = action.type === "applyLook" ? Object.keys(action.outfit).length : 0;
      announce(`Provando ${look.name} · ${pieces(n)}.`);
    },
    [announce, data, looks, byId],
  );

  const setMannequin = useCallback(
    (id: string) => {
      const next = data.mannequins.find((m) => m.id === id);
      if (!next || next.id === stateRef.current.mannequinId) return;
      dispatch({ type: "mannequin", preset: next });
      announce(`Manequim ${next.name}.`);
    },
    [data.mannequins, announce],
  );

  const stepMannequin = useCallback(
    (dir: 1 | -1) => {
      const list = data.mannequins;
      if (list.length < 2) return;
      const i = list.findIndex((m) => m.id === stateRef.current.mannequinId);
      setMannequin(list[(i + dir + list.length) % list.length].id);
    },
    [data.mannequins, setMannequin],
  );

  const spin = useCallback(() => {
    dispatch({ type: "spin" });
    announce("Girando 360°.");
  }, [announce]);

  const openTab = useCallback((t: TabId, opts?: { expand?: boolean; focusSearch?: boolean }) => {
    setTab(t);
    if (opts?.expand) setSheet((s) => (s === "peek" ? "half" : s));
    if (opts?.focusSearch) setFocusSearchSignal((n) => n + 1);
  }, []);

  const saveCurrentLook = useCallback(
    async (name: string): Promise<ActionResult<SavedLook>> => {
      const s = stateRef.current;
      const items = outfitItems(s.outfit).map(({ productId, size }) => ({ productId, size }));
      if (!items.length) return { ok: false, error: "Vista ao menos uma peça antes de salvar." };
      const body: LookBodySettings = {
        mannequinId: s.mannequinId,
        heightCm: s.heightCm,
        weightKg: s.weightKg,
        skinTone: s.appearance.skinTone,
        hairColor: s.appearance.hairColor,
        hairStyle: s.appearance.hairStyle,
        style: s.appearance.style,
      };
      try {
        const res = await saveLook({ name: name.trim().slice(0, 40) || "Meu look", body, items });
        if (res.ok) {
          setLooks((prev) => {
            const savedCount = prev.filter((l) => l.kind === "saved").length;
            const grid = savedLookToGrid(res.data, savedCount + 1, new Set(byId.keys()));
            // o mais novo primeiro, como vem do servidor
            return orderLooks([grid, ...prev.filter((l) => l.id !== grid.id)]);
          });
          dispatch({ type: "applyLook", lookId: res.data.id, outfit: s.outfit });
          announce(`Look “${res.data.name}” salvo em Meus looks.`);
        }
        return res;
      } catch {
        return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
      }
    },
    [announce, byId],
  );

  const buyLook = useCallback(async (): Promise<ActionResult<CartView>> => {
    if (!worn.length) return { ok: false, error: "Nenhuma peça vestida." };
    const soldOut = worn.find((w) => stockOf(w.product, w.size) <= 0);
    if (soldOut) return { ok: false, error: `${soldOut.product.shortName} está esgotada no ${soldOut.size}. Escolha outro tamanho.` };
    try {
      const res = await addLookToCart({ items: worn.map((w) => ({ productId: w.product.id, size: w.size })) });
      if (res.ok) {
        announce(`${worn.length} ${worn.length === 1 ? "peça foi" : "peças foram"} para a sacola.`);
        window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: res.data }));
      }
      return res;
    } catch {
      return { ok: false, error: "Não foi possível adicionar à sacola agora." };
    }
  }, [worn, announce]);

  /* ── Tela cheia do palco (API nativa; fallback CSS no iPhone) ── */
  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (fullscreen === "pseudo") {
      setFullscreen("off");
      return;
    }
    if (el.requestFullscreen && document.fullscreenEnabled) {
      el.requestFullscreen().catch(() => setFullscreen("pseudo"));
    } else {
      setFullscreen("pseudo");
    }
  }, [fullscreen]);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement ? "native" : "off");
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ── Palco na tela: atalhos só com ele visível; sem giro automático fora da tela ── */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Só dois limiares e estado alterado apenas quando muda: antes, cada limiar cruzado na rolagem
    // re-renderizava a sala inteira (blocos de 270–730 ms com CPU 4×).
    let last = { on: false, visible: false };
    const io = new IntersectionObserver(
      ([e]) => {
        // "visível" = o palco ocupa ao menos 40% da altura da janela
        const next = { on: e.isIntersecting, visible: e.isIntersecting && e.intersectionRect.height >= window.innerHeight * 0.4 };
        if (next.on !== last.on) setOnScreen(next.on);
        if (next.visible !== last.visible) setStageVisible(next.visible);
        last = next;
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ── Atalhos: ←/→ trocam o manequim, R gira 360°, Esc sai da tela cheia simulada ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen === "pseudo") {
        setFullscreen("off");
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      if (!stageVisible && fullscreen === "off") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true'], [role='tab'], [role='slider'], [role='radio'], dialog")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepMannequin(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepMannequin(1);
      } else if (e.key === "r" || e.key === "R") {
        spin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageVisible, fullscreen, stepMannequin, spin]);

  const outfit = state.outfit;
  const isWorn = useCallback((id: string) => Object.values(outfit).some((it) => it?.productId === id), [outfit]);

  const api: FittingApi = {
    data: dataWithLooks,
    looks,
    state,
    dispatch,
    preset,
    measurements,
    worn,
    sceneOutfit,
    byId,
    wishlist: wish,
    lookFit,
    mobile,
    tab,
    sheet,
    setSheet,
    openTab,
    focusSearchSignal,
    consumeFocusSearch,
    isWorn,
    toggleWear,
    removeSlot: removeWorn,
    toggleWish,
    applyLook,
    setMannequin,
    stepMannequin,
    spin,
    announce,
    toast,
    saveCurrentLook,
    buyLook,
    fullscreen,
    toggleFullscreen,
    mannequinName,
  };

  const formal = state.appearance.style === "formal";

  return (
    <FittingContext.Provider value={api}>
      <div className="pv-room" data-style={formal ? "formal" : "informal"}>
        <header className="pv-head">
          <p className="pv-kicker" lang="en">
            Select your fit
          </p>
          <h1 id="pv-titulo" className="pv-title">
            Provador 3D
          </h1>
          <p className="pv-lede">
            Vista as peças da {SITE.name} no manequim com a sua altura e peso e veja o caimento antes de comprar.
          </p>
        </header>
        <StageView stageRef={stageRef} bodyParams={bodyParams} autoRotate={state.autoRotate && onScreen} />
        <Panel />
        <LookSummary />
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </div>
    </FittingContext.Provider>
  );
}
