import type { CSSProperties } from "react";

/**
 * Pôster estático do manequim (SVG, sem imagem): silhueta low-poly com as
 * cores do look. Aparece antes do 3D carregar e em movimento reduzido.
 */
export interface PosterColors {
  skin: string;
  hair: string;
  head?: string;
  top?: string;
  outer?: string;
  bottom?: string;
  full?: string;
  feet?: string;
  feminine?: boolean;
}

const shade = (c: string, pct: number) => `color-mix(in oklab, ${c} ${100 - pct}%, #000)`;
const lift = (c: string, pct: number) => `color-mix(in oklab, ${c} ${100 - pct}%, #fff)`;
const OUTLINE = "color-mix(in oklab, var(--y2k-deep) 40%, #000)";

/** Polígono com contorno escuro e faces claras/escuras (luz vindo da esquerda). */
function Poly({ points, color, dark = false }: { points: string; color: string; dark?: boolean }) {
  const style: CSSProperties = { fill: dark ? shade(color, 16) : color, stroke: OUTLINE, strokeWidth: 2.5, strokeLinejoin: "round" };
  return <polygon points={points} style={style} />;
}

export function PosterFigure({ c, className }: { c: PosterColors; className?: string }) {
  const torso = c.full ?? c.top ?? lift(c.skin, 6);
  const legs = c.full ? c.skin : c.bottom ? c.skin : lift(c.skin, 8);
  const s = c.feminine ? 34 : 40; // meia largura de ombros
  const w = c.feminine ? 26 : 30; // meia largura de cintura
  const torsoPts = `${100 - s},102 ${100 + s},102 ${100 + w},242 ${100 - w},242`;
  return (
    <svg viewBox="0 0 200 480" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="pv-poster-floor">
          <stop offset="0" style={{ stopColor: "var(--y2k-cyan)", stopOpacity: 0.6 }} />
          <stop offset="1" style={{ stopColor: "var(--y2k-cyan)", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id="pv-poster-shine" x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "#fff", stopOpacity: 0.32 }} />
          <stop offset="0.5" style={{ stopColor: "#fff", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="460" rx="78" ry="13" style={{ fill: "url(#pv-poster-floor)" }} />

      {/* pernas */}
      <Poly points="76,250 98,250 95,438 78,438" color={legs} />
      <Poly points="102,250 124,250 122,438 105,438" color={legs} dark />
      {/* parte de baixo (ou vestido) */}
      {c.full ? (
        <Poly points={`${100 - w - 2},170 ${100 + w + 2},170 ${100 + 48},336 ${100 - 48},336`} color={c.full} />
      ) : c.bottom ? (
        <Poly points={`${100 - w - 2},236 ${100 + w + 2},236 ${100 + 38},330 103,330 100,286 97,330 ${100 - 38},330`} color={c.bottom} />
      ) : null}
      {/* pés */}
      <Poly points="72,436 98,436 100,452 62,452" color={c.feet ?? shade(c.skin, 18)} />
      <Poly points="102,436 128,436 138,452 100,452" color={c.feet ?? shade(c.skin, 18)} dark />
      {/* braços */}
      <Poly points={`${100 - s},106 ${100 - s + 12},110 ${100 - s - 2},250 ${100 - s - 14},246`} color={c.skin} />
      <Poly points={`${100 + s - 12},110 ${100 + s},106 ${100 + s + 14},246 ${100 + s + 2},250`} color={c.skin} dark />
      {/* tronco + brilho só sobre ele */}
      <Poly points={torsoPts} color={torso} />
      <polygon points={torsoPts} style={{ fill: "url(#pv-poster-shine)" }} />
      {c.outer ? (
        <>
          <Poly points={`${100 - s - 6},100 ${100 - 9},100 ${100 - 13},254 ${100 - w - 10},254 ${100 - s - 16},238`} color={c.outer} />
          <Poly points={`${100 + 9},100 ${100 + s + 6},100 ${100 + s + 16},238 ${100 + w + 10},254 ${100 + 13},254`} color={c.outer} dark />
        </>
      ) : null}
      {/* pescoço, cabeça, cabelo, boné */}
      <Poly points="92,80 108,80 109,104 91,104" color={c.skin} dark />
      <ellipse cx="100" cy="56" rx="22" ry="27" style={{ fill: c.skin, stroke: OUTLINE, strokeWidth: 2.5 }} />
      <path
        d="M77,58 C74,28 90,20 100,20 C114,20 128,30 123,60 C119,42 110,37 100,37 C90,37 81,43 77,58 Z"
        style={{ fill: c.hair, stroke: OUTLINE, strokeWidth: 2.5, strokeLinejoin: "round" }}
      />
      {c.head ? (
        <path
          d="M76,46 C77,20 123,20 124,46 L148,50 L124,53 L76,53 Z"
          style={{ fill: c.head, stroke: OUTLINE, strokeWidth: 2.5, strokeLinejoin: "round" }}
        />
      ) : null}
    </svg>
  );
}
