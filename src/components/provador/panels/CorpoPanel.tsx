"use client";
import { useId, type CSSProperties } from "react";
import { BODY_LIMITS } from "@/lib/types";
import { useFitting } from "../context";
import { FitBadge } from "../ui/FitBadge";

function Slider({
  label,
  unit,
  value,
  min,
  max,
  onChange,
  valueText,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  valueText: string;
}) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="pv-slider">
      <div className="pv-slider__top">
        <label htmlFor={id} className="pv-label">
          {label}
        </label>
        <output htmlFor={id} className="pv-slider__value" aria-hidden="true">
          {value}
          <small> {unit}</small>
        </output>
      </div>
      <input
        id={id}
        className="pv-range"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--pv-fill": `${fill}%` } as CSSProperties}
      />
      <div className="pv-slider__scale" aria-hidden="true">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}

/** CORPO: altura e peso, medidas estimadas e tamanho recomendado de cada peça vestida. */
export function CorpoPanel() {
  const f = useFitting();
  const { state, measurements: m, preset } = f;
  const r = (n: number) => Math.round(n);
  const changed = state.heightCm !== preset.heightCm || state.weightKg !== preset.weightKg;
  const garments = f.worn.filter((w) => w.fits);

  return (
    <div className="pv-stack">
      <section aria-labelledby="pv-corpo-h">
        <div className="pv-h3row">
          <h3 id="pv-corpo-h" className="pv-h3">
            Seu corpo
          </h3>
          {changed ? (
            <button type="button" className="pv-link" onClick={() => f.dispatch({ type: "resetBody", preset })}>
              Voltar às medidas de {preset.name}
            </button>
          ) : null}
        </div>
        <div className="pv-sliders">
          <Slider
            label="Altura"
            unit="cm"
            value={state.heightCm}
            min={BODY_LIMITS.heightCm.min}
            max={BODY_LIMITS.heightCm.max}
            valueText={`${state.heightCm} centímetros`}
            onChange={(n) => f.dispatch({ type: "body", heightCm: n })}
          />
          <Slider
            label="Peso"
            unit="kg"
            value={state.weightKg}
            min={BODY_LIMITS.weightKg.min}
            max={BODY_LIMITS.weightKg.max}
            valueText={`${state.weightKg} quilos`}
            onChange={(n) => f.dispatch({ type: "body", weightKg: n })}
          />
        </div>
      </section>

      <section aria-labelledby="pv-medidas-h">
        <h3 id="pv-medidas-h" className="pv-h3">
          Medidas estimadas
        </h3>
        <dl className="pv-measures">
          <div>
            <dt>{preset.body === "feminino" ? "Busto" : "Tórax"}</dt>
            <dd>{r(m.chestCm)} cm</dd>
          </div>
          <div>
            <dt>Cintura</dt>
            <dd>{r(m.waistCm)} cm</dd>
          </div>
          <div>
            <dt>Quadril</dt>
            <dd>{r(m.hipCm)} cm</dd>
          </div>
          <div>
            <dt>Ombros</dt>
            <dd>{r(m.shoulderCm)} cm</dd>
          </div>
          <div>
            <dt>Entrepernas</dt>
            <dd>{r(m.inseamCm)} cm</dd>
          </div>
          <div>
            <dt>Pé</dt>
            <dd>{m.footCm.toFixed(1).replace(".", ",")} cm</dd>
          </div>
        </dl>
        <p className="pv-hint">
          Estimativa a partir da altura, do peso e do tipo de corpo ({preset.body}). IMC {m.bmi.toFixed(1).replace(".", ",")}.
        </p>
      </section>

      <section aria-labelledby="pv-tam-h">
        <h3 id="pv-tam-h" className="pv-h3">
          Tamanho recomendado
        </h3>
        <div aria-live="polite">
          {garments.length ? (
            <ul className="pv-sizes">
              {garments.map((w) => {
                const canUse = w.recommended !== w.size && w.product.sizes.some((s) => s.size === w.recommended && s.stock > 0);
                return (
                  <li key={w.slot}>
                    <span className="pv-sizes__name">{w.product.shortName}</span>
                    <span className="pv-sizes__rec">
                      <b>{w.recommended}</b>
                      {w.recommended !== w.size ? <span className="pv-sizes__now"> · vestindo {w.size}</span> : null}
                    </span>
                    <FitBadge fit={w.fit} />
                    {canUse ? (
                      <button
                        type="button"
                        className="pv-link"
                        onClick={() => f.dispatch({ type: "size", slot: w.slot, size: w.recommended })}
                        aria-label={`Usar ${w.recommended} em ${w.product.name}`}
                      >
                        Usar {w.recommended}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pv-muted">Vista uma peça para ver o tamanho recomendado e o caimento no seu corpo.</p>
          )}
        </div>
      </section>
    </div>
  );
}
