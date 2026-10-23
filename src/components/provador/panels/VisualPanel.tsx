"use client";
import { useId } from "react";
import { HAIR_COLORS, SKIN_TONES } from "@/data/mannequins";
import type { MannequinStyle } from "@/lib/types";
import { useFitting } from "../context";
import { HAIR_STYLE_LABEL, HAIR_STYLES } from "../state";

function Swatches({
  legend,
  name,
  options,
  value,
  onChange,
  customLabel,
}: {
  legend: string;
  name: string;
  options: readonly { name: string; hex: string }[];
  value: string;
  onChange: (hex: string) => void;
  customLabel: string;
}) {
  const customId = useId();
  const isPreset = options.some((o) => o.hex.toLowerCase() === value.toLowerCase());
  return (
    <fieldset className="pv-fieldset">
      <legend className="pv-h3">{legend}</legend>
      <div className="pv-swatches">
        {options.map((o) => (
          <label key={o.hex} className="pv-swatch" title={o.name}>
            <input type="radio" name={name} value={o.hex} checked={o.hex.toLowerCase() === value.toLowerCase()} onChange={() => onChange(o.hex)} />
            <span style={{ background: o.hex }} />
            <span className="sr-only">{o.name}</span>
          </label>
        ))}
        <label className="pv-color" htmlFor={customId}>
          <input id={customId} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          <span>
            {customLabel}
            {!isPreset ? ` (${value.toUpperCase()})` : ""}
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/** VISUAL: estilo (formal/informal), pele e cabelo do manequim. */
export function VisualPanel() {
  const f = useFitting();
  const ap = f.state.appearance;
  const setStyle = (style: MannequinStyle) => {
    f.dispatch({ type: "appearance", patch: { style } });
    f.announce(style === "formal" ? "Estilo formal: postura de vitrine." : "Estilo informal: pose relaxada.");
  };

  return (
    <div className="pv-stack">
      <h3 className="sr-only">Visual do manequim</h3>
      <fieldset className="pv-fieldset">
        <legend className="pv-h3">Estilo</legend>
        <div className="pv-segfield">
          {(["informal", "formal"] as const).map((s) => (
            <label key={s}>
              <input type="radio" name="pv-estilo" value={s} checked={ap.style === s} onChange={() => setStyle(s)} />
              {s === "formal" ? "Formal" : "Informal"}
            </label>
          ))}
        </div>
        <p className="pv-hint">
          {ap.style === "formal" ? "Postura de vitrine e estúdio creme." : "Pose relaxada no palco aqua com piso em grade."}
        </p>
      </fieldset>

      <Swatches
        legend="Tom de pele"
        name="pv-pele"
        options={SKIN_TONES}
        value={ap.skinTone}
        customLabel="Outro tom"
        onChange={(hex) => f.dispatch({ type: "appearance", patch: { skinTone: hex } })}
      />

      <fieldset className="pv-fieldset">
        <legend className="pv-h3">Cabelo</legend>
        <div className="pv-chips pv-chips--wrap">
          {HAIR_STYLES.map((h) => (
            <label key={h} className="pv-chip">
              <input
                type="radio"
                name="pv-cabelo"
                value={h}
                checked={ap.hairStyle === h}
                onChange={() => f.dispatch({ type: "appearance", patch: { hairStyle: h } })}
              />
              {HAIR_STYLE_LABEL[h]}
            </label>
          ))}
        </div>
      </fieldset>

      <Swatches
        legend="Cor do cabelo"
        name="pv-cor-cabelo"
        options={HAIR_COLORS}
        value={ap.hairColor}
        customLabel="Outra cor"
        onChange={(hex) => f.dispatch({ type: "appearance", patch: { hairColor: hex } })}
      />
    </div>
  );
}
