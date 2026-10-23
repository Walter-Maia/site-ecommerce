import type { ProvadorProduct } from "../types";
import { Thumb } from "./Thumb";

/** Packshot pequeno (4:5) ou amostra da cor da peça enquanto a foto não existe. */
export function ProductThumb({ p, sizes = "48px", className = "pv-thumb" }: { p: ProvadorProduct; sizes?: string; className?: string }) {
  const base = p.garment.colors.base || p.colorHex;
  return (
    <span className={className}>
      <Thumb
        src={p.image}
        alt=""
        sizes={sizes}
        fallback={<span className="pv-thumb__swatch" style={{ background: base }} />}
      />
    </span>
  );
}
