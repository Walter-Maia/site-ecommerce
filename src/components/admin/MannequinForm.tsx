"use client";
import clsx from "clsx";
import { useActionState, useState } from "react";
import { Field, FormAlert } from "@/components/conta/Field";
import { HAIR_STYLE_LABEL } from "@/components/conta/labels";
import LazyMannequinScene from "@/components/provador/scene/LazyMannequinScene";
import { HAIR_COLORS, SKIN_TONES } from "@/data/mannequins";
import { BODY_LIMITS, type HairStyle, type MannequinPreset } from "@/lib/types";
import type { FormState } from "@/server/actions/auth";
import { createMannequinAction, updateMannequinAction } from "@/server/admin/actions";

const HEX = /^#[0-9a-fA-F]{6}$/;

type Values = Omit<MannequinPreset, "id">;

const EMPTY_MANNEQUIN: Values = {
  name: "",
  body: "feminino",
  skinTone: SKIN_TONES[3].hex,
  hairStyle: "rabo-de-cavalo",
  hairColor: HAIR_COLORS[0].hex,
  style: "informal",
  heightCm: 168,
  weightKg: 62,
  active: true,
  sortOrder: 10,
};

function ColorPicker({
  label,
  name,
  value,
  onChange,
  palette,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  palette: readonly { name: string; hex: string }[];
  error?: string;
}) {
  const valid = HEX.test(value);
  return (
    <fieldset>
      <legend className="t-label mb-2 block text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${label}: paleta`}>
        {palette.map((c) => {
          const selected = c.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              title={c.name}
              aria-label={c.name}
              onClick={() => onChange(c.hex)}
              className={clsx(
                "size-9 border transition-transform",
                selected ? "scale-110 border-ink outline outline-2 outline-offset-2 outline-ink" : "border-line hover:scale-105",
              )}
              style={{ background: c.hex }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <Field
          label="Hex livre"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          className="w-36"
          error={error ?? (!valid && value ? "Use #RRGGBB" : undefined)}
        />
        <input
          type="color"
          aria-label={`${label}: seletor de cor`}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="mb-0 h-12 w-14 cursor-pointer border border-line bg-paper p-1"
        />
      </div>
    </fieldset>
  );
}

function Range({
  label,
  name,
  unit,
  value,
  min,
  max,
  onChange,
  error,
}: {
  label: string;
  name: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={`campo-${name}`} className="t-label text-ink-2">
          {label}
        </label>
        <span className="tabular text-sm">
          {value} {unit}
        </span>
      </div>
      <input
        id={`campo-${name}`}
        name={name}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-invalid={error ? true : undefined}
        className="mt-3 w-full accent-ink"
      />
      <div className="flex justify-between text-xs text-mute">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {error ? <p className="mt-1 text-sm text-signal">{error}</p> : null}
    </div>
  );
}

export function MannequinForm({ id, initial = EMPTY_MANNEQUIN }: { id?: string; initial?: Values }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    id ? updateMannequinAction : createMannequinAction,
    undefined,
  );
  const [v, setV] = useState<Values>(initial);
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((prev) => ({ ...prev, [k]: value }));
  // A pré-visualização só recebe cores válidas (enquanto digita, mantém a última válida).
  const [preview, setPreview] = useState({ skinTone: initial.skinTone, hairColor: initial.hairColor });
  const setColor = (k: "skinTone" | "hairColor", value: string) => {
    set(k, value);
    if (HEX.test(value)) setPreview((p) => ({ ...p, [k]: value }));
  };
  const fe = state?.fieldErrors ?? {};

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
      <form action={action} className="space-y-8" noValidate>
        {id ? <input type="hidden" name="id" value={id} /> : null}

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <Field
            label="Nome (placa do provador)"
            name="name"
            value={v.name}
            maxLength={24}
            required
            onChange={(e) => set("name", e.target.value)}
            error={fe.name}
            hint="Ex.: MIA, KAUÃ"
          />
          <Field
            label="Ordem"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            value={String(v.sortOrder)}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
            error={fe.sortOrder}
            className="sm:w-28"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className="t-label mb-2 block text-ink-2">Corpo</legend>
            <div className="flex gap-2">
              {(["feminino", "masculino"] as const).map((b) => (
                <label key={b} className={clsx("btn flex-1 capitalize has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2", v.body === b && "btn-solid")}>
                  <input type="radio" name="body" value={b} checked={v.body === b} onChange={() => set("body", b)} className="sr-only" />
                  {b}
                </label>
              ))}
            </div>
            {fe.body ? <p className="mt-1 text-sm text-signal">{fe.body}</p> : null}
          </fieldset>
          <fieldset>
            <legend className="t-label mb-2 block text-ink-2">Estilo</legend>
            <div className="flex gap-2">
              {(["informal", "formal"] as const).map((s) => (
                <label key={s} className={clsx("btn flex-1 capitalize has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2", v.style === s && "btn-solid")}>
                  <input type="radio" name="style" value={s} checked={v.style === s} onChange={() => set("style", s)} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-mute">Formal = postura ereta; informal = pose relaxada.</p>
          </fieldset>
        </div>

        <ColorPicker label="Tom de pele" name="skinTone" value={v.skinTone} onChange={(x) => setColor("skinTone", x)} palette={SKIN_TONES} error={fe.skinTone} />

        <div className="grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
          <div>
            <label htmlFor="campo-hairStyle" className="t-label mb-2 block text-ink-2">
              Cabelo
            </label>
            <select
              id="campo-hairStyle"
              name="hairStyle"
              value={v.hairStyle}
              onChange={(e) => set("hairStyle", e.target.value as HairStyle)}
              className="block min-h-12 w-full border border-line bg-paper px-3 text-base outline-none focus:border-ink"
            >
              {(Object.keys(HAIR_STYLE_LABEL) as HairStyle[]).map((h) => (
                <option key={h} value={h}>
                  {HAIR_STYLE_LABEL[h]}
                </option>
              ))}
            </select>
            {fe.hairStyle ? <p className="mt-1 text-sm text-signal">{fe.hairStyle}</p> : null}
          </div>
          <ColorPicker label="Cor do cabelo" name="hairColor" value={v.hairColor} onChange={(x) => setColor("hairColor", x)} palette={HAIR_COLORS} error={fe.hairColor} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Range label="Altura padrão" name="heightCm" unit="cm" value={v.heightCm} min={BODY_LIMITS.heightCm.min} max={BODY_LIMITS.heightCm.max} onChange={(x) => set("heightCm", x)} error={fe.heightCm} />
          <Range label="Peso padrão" name="weightKg" unit="kg" value={v.weightKg} min={BODY_LIMITS.weightKg.min} max={BODY_LIMITS.weightKg.max} onChange={(x) => set("weightKg", x)} error={fe.weightKg} />
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" name="active" checked={v.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-ink" />
          Ativo (aparece para o cliente no provador)
        </label>

        {state?.error ? <FormAlert>{state.error}</FormAlert> : null}
        {state?.success ? <FormAlert tone="ok">Manequim salvo.</FormAlert> : null}
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Salvando…" : id ? "Salvar alterações" : "Criar manequim"}
        </button>
      </form>

      <aside aria-label="Pré-visualização" className="lg:sticky lg:top-6 lg:self-start">
        <p className="t-label mb-3 text-mute">Pré-visualização</p>
        <div className="aspect-[3/4] w-full overflow-hidden border border-line bg-sand">
          <LazyMannequinScene
            bodyParams={{ body: v.body, heightCm: v.heightCm, weightKg: v.weightKg }}
            appearance={{ skinTone: preview.skinTone, hairStyle: v.hairStyle, hairColor: preview.hairColor, style: v.style }}
            outfit={[]}
            autoRotate={false}
            view="frente"
            theme="neutral"
            ariaLabel={`Manequim ${v.name || "sem nome"}: corpo ${v.body}, ${v.heightCm} cm, ${v.weightKg} kg, estilo ${v.style}`}
            className="size-full"
          />
        </div>
        <p className="mt-3 text-sm text-ink-2">
          <span className="font-semibold">{v.name || "—"}</span> · {v.heightCm} cm · {v.weightKg} kg · {HAIR_STYLE_LABEL[v.hairStyle]}
        </p>
      </aside>
    </div>
  );
}
