import { Thumb } from "./Thumb";

/** Miniatura quadrada do look: render do manequim quando existe; senão faixas com as cores das peças. */
export function LookThumb({ image, colors, sizes }: { image: string | null; colors: string[]; sizes: string }) {
  return (
    <span className="pv-lookthumb">
      <Thumb
        src={image}
        alt=""
        sizes={sizes}
        fallback={
          <span className="pv-lookthumb__stripes">
            {colors.slice(0, 5).map((c, i) => (
              <span key={i} style={{ background: c }} />
            ))}
          </span>
        }
      />
    </span>
  );
}
