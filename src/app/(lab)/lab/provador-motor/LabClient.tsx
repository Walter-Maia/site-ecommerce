"use client";
import { useMemo, useState } from "react";
import { PRODUCTS } from "@/data/catalog";
import { CURATED_LOOKS, HAIR_COLORS, MANNEQUIN_PRESETS, SKIN_TONES } from "@/data/mannequins";
import type { GarmentSlot, HairStyle, MannequinBody, MannequinStyle, Product, Size } from "@/lib/types";
import type { Appearance, BodyParams, SceneTheme, SceneView, WornItem } from "@/lib/provador/contract";
import { computeFit, estimateMeasurements, lookFitScore, recommendSize } from "@/lib/provador/fit";
import { FIT_LABEL_UI, SLOT_LABELS, SLOT_ORDER, applyItemToOutfit, removeFromOutfit } from "@/lib/provador/outfit";
import LazyMannequinScene from "@/components/provador/scene/LazyMannequinScene";
import { type SceneDebug, SceneDebugContext } from "@/components/provador/scene/debug";

const HAIRS: HairStyle[] = ["raspado", "curto", "cacheado-curto", "black-power", "trancas", "maria-chiquinha", "coque", "rabo-de-cavalo", "longo-liso"];

interface LabState {
  body: MannequinBody;
  h: number;
  w: number;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  style: MannequinStyle;
  theme: SceneTheme;
  quality: "alta" | "baixa";
  view: SceneView;
  auto: boolean;
  items: { id: string; size?: Size }[];
  label?: string;
}

const SLOTS: GarmentSlot[] = ["head", "top", "outer", "bottom", "full", "feet", "prop"];

/** Look de teste da linha skate: gorro + camiseta + flanela aberta + cargo + tênis de skate + skate. */
const SKATE_LOOK = ["p37", "p29", "p32:outer", "p34", "p38", "p40"];
const derived = new Map<string, Product>();

/**
 * Busca por id ou slug. `id:slot` veste a peça em outro slot só no laboratório
 * (ex.: `p32:outer` = flanela aberta por cima da camiseta).
 */
const findProduct = (key: string): Product | undefined => {
  const [k, slot] = key.split(":");
  const p = PRODUCTS.find((x) => x.id === k || x.slug === k);
  if (!p || !slot || !SLOTS.includes(slot as GarmentSlot) || slot === p.garment.slot) return p;
  const id = `${p.id}:${slot}`;
  let d = derived.get(id);
  if (!d) {
    d = { ...p, id, garment: { ...p.garment, slot: slot as GarmentSlot } };
    derived.set(id, d);
  }
  return d;
};

function parseItems(v: string): { id: string; size?: Size }[] {
  const out: { id: string; size?: Size }[] = [];
  for (const s of v.split(/[,~|]/).filter(Boolean)) {
    const [k, size] = s.split("@");
    const p = findProduct(k);
    if (p) out.push({ id: p.id, size: size as Size | undefined });
  }
  return out;
}

function applyParams(base: LabState, p: Record<string, string>): LabState {
  const s: LabState = { ...base };
  if (p.look) {
    const look = CURATED_LOOKS.find((l) => l.id === p.look);
    const preset = MANNEQUIN_PRESETS.find((m) => m.id === look?.mannequinId);
    if (look && preset) {
      Object.assign(s, { body: preset.body, h: preset.heightCm, w: preset.weightKg, skin: preset.skinTone, hair: preset.hairStyle, hairColor: preset.hairColor, style: preset.style });
      s.items = look.productSlugs.map((slug) => ({ id: findProduct(slug)!.id }));
    }
  }
  if (p.preset) {
    const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const preset = MANNEQUIN_PRESETS.find((m) => m.id === p.preset || norm(m.name) === norm(p.preset));
    if (preset) Object.assign(s, { body: preset.body, h: preset.heightCm, w: preset.weightKg, skin: preset.skinTone, hair: preset.hairStyle, hairColor: preset.hairColor, style: preset.style });
  }
  if (p.body) s.body = p.body.startsWith("m") ? "masculino" : "feminino";
  if (p.h) s.h = Number(p.h);
  if (p.w) s.w = Number(p.w);
  if (p.skin) s.skin = p.skin.startsWith("#") ? p.skin : `#${p.skin}`;
  if (p.hair) s.hair = p.hair as HairStyle;
  if (p.hc) s.hairColor = p.hc.startsWith("#") ? p.hc : `#${p.hc}`;
  if (p.style) s.style = p.style === "formal" ? "formal" : "informal";
  if (p.theme) s.theme = p.theme as SceneTheme;
  if (p.q) s.quality = p.q === "baixa" ? "baixa" : "alta";
  if (p.view) s.view = p.view as SceneView;
  if (p.auto) s.auto = p.auto === "1";
  if (p.items !== undefined) s.items = parseItems(p.items);
  if (p.label) s.label = p.label;
  return s;
}

function parseVariant(v: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of v.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

function useScene(state: LabState) {
  const bodyParams = useMemo<BodyParams>(() => ({ body: state.body, heightCm: state.h, weightKg: state.w }), [state.body, state.h, state.w]);
  const appearance = useMemo<Appearance>(
    () => ({ skinTone: state.skin, hairStyle: state.hair, hairColor: state.hairColor, style: state.style }),
    [state.skin, state.hair, state.hairColor, state.style],
  );
  const m = useMemo(() => estimateMeasurements(bodyParams), [bodyParams]);
  const outfit = useMemo<WornItem[]>(() => {
    let o: WornItem[] = [];
    for (const it of state.items) {
      const p = findProduct(it.id);
      if (!p) continue;
      const size = it.size && p.sizeChart.some((r) => r.size === it.size) ? it.size : recommendSize(p, m);
      o = applyItemToOutfit(o, { product: p, size, fit: computeFit(p, size, m) });
    }
    return o;
  }, [state.items, m]);
  return { bodyParams, appearance, outfit, m };
}

function describe(outfit: WornItem[], body: MannequinBody) {
  if (!outfit.length) return `Manequim ${body} com roupa base neutra`;
  return `Manequim ${body} vestindo ${outfit.map((o) => `${o.product.name} tamanho ${o.size}`).join(", ")}`;
}

function SceneBox({ state, className }: { state: LabState; className?: string }) {
  const { bodyParams, appearance, outfit } = useScene(state);
  return (
    <LazyMannequinScene
      bodyParams={bodyParams}
      appearance={appearance}
      outfit={outfit}
      autoRotate={state.auto}
      view={state.view}
      theme={state.theme}
      quality={state.quality}
      ariaLabel={describe(outfit, state.body)}
      className={className}
    />
  );
}

const BG: Record<SceneTheme, string> = {
  y2k: "linear-gradient(180deg, #0a4a6b 0%, #2a8fb0 55%, #5bc0d8 100%)",
  boutique: "#efe6d8",
  neutral: "#f1efea",
};

const DEFAULT: LabState = {
  body: "feminino",
  h: 166,
  w: 58,
  skin: "#B57A55",
  hair: "maria-chiquinha",
  hairColor: "#1C1412",
  style: "informal",
  theme: "y2k",
  quality: "alta",
  view: "frente",
  auto: false,
  items: [],
};

export default function LabClient({ params, variants }: { params: Record<string, string>; variants: string[] }) {
  const debug = useMemo<SceneDebug | null>(() => {
    if (!params.az && !params.zoom && !params.focus && !params.el) return null;
    return { az: params.az ? Number(params.az) : undefined, el: params.el ? Number(params.el) : undefined, zoom: params.zoom ? Number(params.zoom) : undefined, focus: params.focus ? Number(params.focus) : undefined };
  }, [params]);
  return (
    <SceneDebugContext.Provider value={debug}>
      <LabInner params={params} variants={variants} />
    </SceneDebugContext.Provider>
  );
}

function LabInner({ params, variants }: { params: Record<string, string>; variants: string[] }) {
  const initial = useMemo(() => applyParams(DEFAULT, params), [params]);
  const [state, setState] = useState<LabState>(initial);
  const [spin, setSpin] = useState(0);
  const showUi = params.ui !== "0";

  if (variants.length) {
    const cols = Math.min(variants.length, Number(params.cols) || variants.length);
    return (
      <main className="min-h-dvh p-3" style={{ background: BG[initial.theme] }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {variants.map((v, i) => {
            const st = applyParams(initial, parseVariant(v));
            return (
              <figure key={i} className="flex flex-col">
                <SceneBox state={st} className="h-[86dvh] w-full" />
                <figcaption className="pt-1 text-center font-mono text-[13px] text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
                  {st.label ?? `${st.body} ${st.h}/${st.w}`}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </main>
    );
  }

  return <Bench state={state} setState={setState} spin={spin} setSpin={setSpin} showUi={showUi} />;
}

function Bench({ state, setState, spin, setSpin, showUi }: { state: LabState; setState: (s: LabState) => void; spin: number; setSpin: (n: number) => void; showUi: boolean }) {
  const { bodyParams, appearance, outfit, m } = useScene(state);
  const set = <K extends keyof LabState>(k: K, v: LabState[K]) => setState({ ...state, [k]: v });
  const wearing = new Map(outfit.map((o) => [o.product.id, o]));
  const toggle = (p: Product, size?: Size) => {
    let items = state.items.filter((x) => x.id !== p.id);
    if (!wearing.has(p.id) || size) {
      const tmp = applyItemToOutfit(outfit, { product: p, size: size ?? recommendSize(p, m), fit: computeFit(p, size ?? recommendSize(p, m), m) });
      items = tmp.map((o) => ({ id: o.product.id, size: o.product.id === p.id ? size : state.items.find((x) => x.id === o.product.id)?.size }));
    } else {
      items = removeFromOutfit(outfit, { productId: p.id }).map((o) => ({ id: o.product.id, size: state.items.find((x) => x.id === o.product.id)?.size }));
    }
    set("items", items);
  };

  return (
    <main className={`grid min-h-dvh grid-cols-1 ${showUi ? "lg:grid-cols-[1fr_420px]" : ""}`} style={{ background: BG[state.theme] }}>
      <section className={`relative ${showUi ? "h-[78dvh]" : "h-dvh"} lg:h-dvh`}>
        <LazyMannequinScene
          bodyParams={bodyParams}
          appearance={appearance}
          outfit={outfit}
          autoRotate={state.auto}
          view={state.view}
          spinSignal={spin}
          theme={state.theme}
          quality={state.quality}
          ariaLabel={describe(outfit, state.body)}
          className="absolute inset-0"
        />
      </section>
      {showUi && (
        <aside className="max-h-dvh overflow-y-auto bg-neutral-950/92 p-4 text-[13px] text-neutral-100">
          <h1 className="mb-3 font-mono text-sm tracking-widest text-cyan-300">LAB · MOTOR DO PROVADOR</h1>
          <Row label="Corpo">
            {(["feminino", "masculino"] as const).map((b) => (
              <Chip key={b} on={state.body === b} onClick={() => set("body", b)}>
                {b}
              </Chip>
            ))}
            {MANNEQUIN_PRESETS.map((p) => (
              <Chip key={p.id} on={false} onClick={() => setState({ ...state, body: p.body, h: p.heightCm, w: p.weightKg, skin: p.skinTone, hair: p.hairStyle, hairColor: p.hairColor, style: p.style })}>
                {p.name}
              </Chip>
            ))}
          </Row>
          <Slider label={`Altura ${state.h} cm`} min={145} max={205} value={state.h} onChange={(v) => set("h", v)} />
          <Slider label={`Peso ${state.w} kg`} min={40} max={150} value={state.w} onChange={(v) => set("w", v)} />
          <Row label="Pele">
            {SKIN_TONES.map((t) => (
              <button key={t.hex} aria-label={t.name} title={t.name} onClick={() => set("skin", t.hex)} className={`size-6 rounded-full border-2 ${state.skin === t.hex ? "border-cyan-300" : "border-white/20"}`} style={{ background: t.hex }} />
            ))}
          </Row>
          <Row label="Cabelo">
            {HAIRS.map((h) => (
              <Chip key={h} on={state.hair === h} onClick={() => set("hair", h)}>
                {h}
              </Chip>
            ))}
          </Row>
          <Row label="Cor do cabelo">
            {HAIR_COLORS.map((t) => (
              <button key={t.hex} aria-label={t.name} title={t.name} onClick={() => set("hairColor", t.hex)} className={`size-6 rounded-full border-2 ${state.hairColor === t.hex ? "border-cyan-300" : "border-white/20"}`} style={{ background: t.hex }} />
            ))}
          </Row>
          <Row label="Estilo">
            {(["informal", "formal"] as const).map((s) => (
              <Chip key={s} on={state.style === s} onClick={() => set("style", s)}>
                {s}
              </Chip>
            ))}
          </Row>
          <Row label="Tema / qualidade">
            {(["y2k", "boutique", "neutral"] as const).map((t) => (
              <Chip key={t} on={state.theme === t} onClick={() => set("theme", t)}>
                {t}
              </Chip>
            ))}
            {(["alta", "baixa"] as const).map((q) => (
              <Chip key={q} on={state.quality === q} onClick={() => set("quality", q)}>
                {q}
              </Chip>
            ))}
          </Row>
          <Row label="Câmera">
            {(["frente", "costas", "livre"] as const).map((v) => (
              <Chip key={v} on={state.view === v} onClick={() => set("view", v)}>
                {v}
              </Chip>
            ))}
            <Chip on={state.auto} onClick={() => set("auto", !state.auto)}>
              girar sempre
            </Chip>
            <Chip on={false} onClick={() => setSpin(spin + 1)}>
              giro 360°
            </Chip>
          </Row>

          <div className="mt-3 rounded border border-white/10 p-2 font-mono text-[12px] leading-5 text-emerald-300">
            IMC {m.bmi} · busto/tórax {m.chestCm} · cintura {m.waistCm} · quadril {m.hipCm} · ombros {m.shoulderCm} · tronco {m.torsoLengthCm} · entrepernas {m.inseamCm} · braço {m.armLengthCm} · cabeça {m.headCm} · pé {m.footCm}
            <br />
            CAIMENTO DO LOOK {lookFitScore(outfit)}%
          </div>

          <Row label="Looks prontos">
            {CURATED_LOOKS.filter((l) => !l.locked).map((l) => (
              <Chip
                key={l.id}
                on={false}
                onClick={() => {
                  const preset = MANNEQUIN_PRESETS.find((p) => p.id === l.mannequinId)!;
                  setState({ ...state, body: preset.body, h: preset.heightCm, w: preset.weightKg, skin: preset.skinTone, hair: preset.hairStyle, hairColor: preset.hairColor, style: preset.style, items: l.productSlugs.map((s) => ({ id: findProduct(s)!.id })) });
                }}
              >
                {l.code}
              </Chip>
            ))}
            <Chip on={false} onClick={() => set("items", SKATE_LOOK.map((id) => ({ id })))}>
              look skate
            </Chip>
            <Chip on={false} onClick={() => set("items", [])}>
              limpar
            </Chip>
          </Row>

          {SLOT_ORDER.map((slot: GarmentSlot) => (
            <div key={slot} className="mt-3">
              <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-neutral-400">{SLOT_LABELS[slot]}</div>
              <ul className="space-y-1">
                {PRODUCTS.filter((p) => p.garment.slot === slot).map((p) => {
                  const w = wearing.get(p.id);
                  return (
                    <li key={p.id} className={`flex items-center gap-2 rounded px-2 py-1 ${w ? "bg-cyan-400/15" : "bg-white/5"}`}>
                      <span className="size-3 shrink-0 rounded-sm border border-white/30" style={{ background: p.colorHex }} />
                      <button className="flex-1 truncate text-left" onClick={() => toggle(p)}>
                        {p.shortName}
                      </button>
                      {p.garment.kind === "shirt" && p.garment.slot === "top" && (
                        <button
                          className={`rounded px-1 font-mono text-[10px] ${wearing.has(`${p.id}:outer`) ? "bg-cyan-400/30" : "bg-white/10"}`}
                          title="Vestir aberta por cima da peça de cima (sobreposição)"
                          onClick={() => toggle(findProduct(`${p.id}:outer`)!)}
                        >
                          aberta
                        </button>
                      )}
                      {w && (
                        <span className={`font-mono text-[10px] ${FIT_LABEL_UI[w.fit.label].tone === "ok" ? "text-emerald-300" : FIT_LABEL_UI[w.fit.label].tone === "warn" ? "text-rose-300" : "text-amber-200"}`} title={w.fit.notes.join(" · ")}>
                          {FIT_LABEL_UI[w.fit.label].text} {w.fit.score}
                        </span>
                      )}
                      <select
                        aria-label={`Tamanho de ${p.shortName}`}
                        className="rounded bg-neutral-800 px-1 py-0.5"
                        value={w?.size ?? ""}
                        onChange={(e) => toggle(p, e.target.value as Size)}
                      >
                        <option value="">—</option>
                        {p.sizeChart.map((r) => (
                          <option key={r.size} value={r.size}>
                            {r.size}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {outfit.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12px] text-neutral-300">
              {outfit.map((o) => (
                <li key={o.product.id}>
                  <b className="text-neutral-100">{o.product.shortName}</b> {o.size}: {o.fit.notes.join(" · ")}
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-neutral-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-2.5 py-0.5 ${on ? "border-cyan-300 bg-cyan-300/20 text-cyan-100" : "border-white/15 bg-white/5 hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mt-3 block">
      <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-cyan-300" />
    </label>
  );
}
