"use client";
import { pieces, useFitting } from "../context";
import type { GridLook } from "../types";
import { Icon } from "../ui/icons";
import { LookThumb } from "../ui/LookThumb";

/** LOOKS: prontos (curadoria) + meus looks salvos. Um toque veste o look. */
export function LooksPanel() {
  const f = useFitting();
  const curated = f.looks.filter((l) => l.kind === "curated");
  const saved = f.looks.filter((l) => l.kind === "saved");
  return (
    <div className="pv-stack">
      <section aria-labelledby="pv-looks-prontos">
        <h3 id="pv-looks-prontos" className="pv-h3">
          Looks prontos
        </h3>
        <ul className="pv-lookgrid">
          {curated.map((l) => (
            <li key={l.id}>
              <LookCard look={l} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="pv-looks-meus">
        <h3 id="pv-looks-meus" className="pv-h3">
          Meus looks
        </h3>
        {saved.length ? (
          <ul className="pv-lookgrid">
            {saved.map((l) => (
              <li key={l.id}>
                <LookCard look={l} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="pv-muted">Monte um look e toque em Salvar: ele fica guardado aqui para provar de novo.</p>
        )}
      </section>
    </div>
  );
}

function LookCard({ look }: { look: GridLook }) {
  const f = useFitting();
  const on = look.id === f.state.appliedLookId;
  const colors = look.items.flatMap((it) => {
    const p = f.byId.get(it.productId);
    return p ? [p.garment.colors.base || p.colorHex] : [];
  });
  return (
    <button
      type="button"
      className="pv-look"
      aria-pressed={on}
      onClick={() => {
        f.applyLook(look);
        // no celular, gaveta aberta por inteiro esconde o manequim: desce até a metade
        if (f.mobile && f.sheet === "full") f.setSheet("half");
      }}
    >
      <LookThumb image={look.image} colors={colors} sizes="(max-width: 767px) 30vw, 128px" />
      <span className="pv-look__name">{look.name}</span>
      <span className="pv-look__meta">
        {f.mannequinName(look.mannequinId)} · {pieces(look.items.length)}
      </span>
      {on ? (
        <span className="pv-look__on">
          <Icon name="check" size={14} /> Vestindo
        </span>
      ) : null}
    </button>
  );
}
