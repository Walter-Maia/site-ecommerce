import { CanvasTexture, ClampToEdgeWrapping, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { FabricPattern, GarmentSpec } from "@/lib/types";
import { hash } from "./math";

/**
 * Texturas procedurais em <canvas> (sem rede, compatível com CSP estrita).
 * Padrões em escala física: `tileCm` = quantos cm um ladrilho cobre.
 */

const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function tex(c: HTMLCanvasElement, repeat: boolean) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

/** Ajusta a luminância de um hex (−1 escurece, +1 clareia). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k >= 0) {
    r += (255 - r) * k;
    g += (255 - g) * k;
    b += (255 - b) * k;
  } else {
    r *= 1 + k;
    g *= 1 + k;
    b *= 1 + k;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export const luminance = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, color: string, alpha: number, size = 1, seed = 1) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) ctx.fillRect(hash(i * 3.1 + seed) * w, hash(i * 7.7 + seed) * h, size, size);
  ctx.globalAlpha = 1;
}

export interface PatternTex {
  texture: CanvasTexture;
  tileCm: number;
}

export function patternTexture(pattern: FabricPattern, base: string, secondary?: string, trim?: string): PatternTex {
  const S = pattern === "plaid" ? 512 : 256;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const dark = luminance(base) < 0.25;
  let tileCm = 8;
  switch (pattern) {
    case "plaid": {
      // xadrez de flanela (tartan simplificado): faixas largas da cor secundária nos dois
      // sentidos (o cruzamento escurece), filetes finos de `trim` e sarja escovada.
      tileCm = 15;
      const sec = secondary ?? shade(base, -0.65);
      const thin = trim ?? shade(base, 0.45);
      const band = (pos: number, w: number, color: string, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(pos * S, 0, w * S, S);
        ctx.fillRect(0, pos * S, S, w * S);
      };
      band(0.5, 0.5, sec, 0.62);
      band(0.06, 0.07, sec, 0.45);
      band(0.32, 0.03, sec, 0.55);
      band(0.71, 0.012, thin, 0.85);
      band(0.79, 0.012, thin, 0.85);
      band(0.215, 0.008, thin, 0.6);
      ctx.globalAlpha = 1;
      // sarja: diagonais finas alternando claro/escuro
      ctx.lineWidth = 1.2;
      for (let i = -S; i < S * 2; i += 6) {
        ctx.strokeStyle = i % 12 === 0 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)";
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + S, S);
        ctx.stroke();
      }
      // flanela escovada: fiapos claros curtos
      for (let i = 0; i < 2600; i++) {
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = hash(i * 2.3) > 0.5 ? "#ffffff" : "#000000";
        ctx.fillRect(hash(i * 1.1 + 4) * S, hash(i * 5.7 + 2) * S, 3 + hash(i) * 4, 1);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "canvas": {
      // lona/sarja pesada: diagonal marcada + manchas sutis de tingimento
      tileCm = 2.2;
      ctx.lineWidth = 2.2;
      for (let i = -S; i < S * 2; i += 8) {
        ctx.strokeStyle = shade(base, dark ? 0.1 : -0.1);
        ctx.beginPath();
        ctx.moveTo(i, S);
        ctx.lineTo(i + S, 0);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (let i = -S + 4; i < S * 2; i += 8) {
        ctx.strokeStyle = shade(base, dark ? 0.16 : 0.08);
        ctx.beginPath();
        ctx.moveTo(i, S);
        ctx.lineTo(i + S, 0);
        ctx.stroke();
      }
      noise(ctx, S, S, 1400, dark ? "#ffffff" : "#000000", 0.05, 3, 13);
      break;
    }
    case "corduroy": {
      // veludo cotelê: nervuras verticais (gomos) com brilho aveludado no topo de cada uma
      tileCm = 1.4;
      const n = 4;
      for (let k = 0; k < n; k++) {
        const x = (k * S) / n;
        const g = ctx.createLinearGradient(x, 0, x + S / n, 0);
        g.addColorStop(0, shade(base, dark ? -0.2 : -0.3));
        g.addColorStop(0.18, shade(base, dark ? 0.04 : -0.06));
        g.addColorStop(0.5, shade(base, dark ? 0.2 : 0.14));
        g.addColorStop(0.82, shade(base, dark ? 0.04 : -0.06));
        g.addColorStop(1, shade(base, dark ? -0.2 : -0.3));
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, S / n, S);
      }
      noise(ctx, S, S, 900, dark ? "#ffffff" : "#000000", 0.05, 2, 17);
      break;
    }
    case "pinstripe": {
      tileCm = 4;
      ctx.fillStyle = secondary ?? "#f2f0ea";
      ctx.globalAlpha = 0.95;
      for (let x = 0; x < S; x += S / 2) ctx.fillRect(x + S / 4 - 1.2, 0, 2.4, S);
      ctx.globalAlpha = 1;
      noise(ctx, S, S, 900, dark ? "#ffffff" : "#000000", 0.04);
      break;
    }
    case "mesh": {
      tileCm = 1.6;
      const hole = shade(base, dark ? 0.18 : -0.35);
      const n = 4;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const ox = (x + (y % 2) * 0.5) * (S / n) + S / n / 2;
          const oy = y * (S / n) + S / n / 2;
          ctx.fillStyle = hole;
          ctx.beginPath();
          ctx.arc(ox % S, oy, S / n / 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    }
    case "denim": {
      tileCm = 3;
      ctx.lineWidth = 3;
      for (let i = -S; i < S * 2; i += 9) {
        ctx.strokeStyle = i % 18 === 0 ? shade(base, 0.22) : shade(base, -0.12);
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + S, S);
        ctx.stroke();
      }
      noise(ctx, S, S, 2500, "#ffffff", 0.12, 2, 3);
      noise(ctx, S, S, 1200, "#0b1830", 0.1, 2, 5);
      break;
    }
    case "rib": {
      tileCm = 1.6;
      for (let x = 0; x < S; x += S / 4) {
        const g = ctx.createLinearGradient(x, 0, x + S / 4, 0);
        g.addColorStop(0, shade(base, dark ? 0.05 : -0.18));
        g.addColorStop(0.5, shade(base, dark ? 0.16 : 0.08));
        g.addColorStop(1, shade(base, dark ? 0.05 : -0.18));
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, S / 4, S);
      }
      break;
    }
    case "satin": {
      tileCm = 60;
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, shade(base, -0.06));
      g.addColorStop(0.45, shade(base, 0.12));
      g.addColorStop(0.55, shade(base, 0.04));
      g.addColorStop(1, shade(base, -0.06));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      break;
    }
    case "leather": {
      tileCm = 5;
      noise(ctx, S, S, 2200, "#000000", 0.12, 3, 7);
      noise(ctx, S, S, 900, "#ffffff", 0.06, 2, 9);
      break;
    }
    case "heather": {
      tileCm = 5;
      for (let i = 0; i < 2600; i++) {
        const x = hash(i * 1.7) * S, y = hash(i * 9.1) * S;
        ctx.fillStyle = hash(i * 4.3) > 0.5 ? shade(base, 0.32) : shade(base, -0.3);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, 4 + hash(i) * 6, 1.4);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "nylon": {
      tileCm = 2.4;
      ctx.strokeStyle = shade(base, dark ? 0.12 : -0.1);
      ctx.lineWidth = 2;
      for (let x = 0; x <= S; x += S / 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, x);
        ctx.lineTo(S, x);
        ctx.stroke();
      }
      break;
    }
    default: {
      tileCm = 6;
      noise(ctx, S, S, 1800, dark ? "#ffffff" : "#000000", dark ? 0.035 : 0.03, 2, 11);
    }
  }
  return { texture: tex(c, true), tileCm };
}

/** Ribana (gola, punho, barra) com listras opcionais (varsity). */
export function ribTexture(color: string, stripes?: string[]): PatternTex {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  const dark = luminance(color) < 0.25;
  for (let x = 0; x < S; x += 8) {
    ctx.fillStyle = shade(color, dark ? 0.1 : -0.14);
    ctx.fillRect(x, 0, 3, S);
  }
  if (stripes?.length) {
    // listras horizontais (o UV v corre ao longo da altura da faixa, ~4 cm)
    stripes.forEach((s, i) => {
      ctx.fillStyle = s;
      ctx.fillRect(0, S * (0.3 + i * 0.25), S, S * 0.11);
    });
    return { texture: tex(c, true), tileCm: 4.2 };
  }
  return { texture: tex(c, true), tileCm: 2 };
}

/* ───────────────────────── Fontes ───────────────────────── */

function cssFamily(varName: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

export function fontFor(style: NonNullable<GarmentSpec["graphic"]>["style"], px: number) {
  const serif = cssFamily("--font-newsreader", "Georgia, serif");
  const sans = cssFamily("--font-archivo", "'Arial Black', Arial, sans-serif");
  switch (style) {
    case "varsity":
      return `800 ${px}px ${serif}`;
    case "script":
      return `italic 700 ${px}px "Segoe Script", "Brush Script MT", "Snell Roundhand", ${serif}`;
    case "gothic":
      return `800 ${px}px "Old English Text MT", "UnifrakturMaguntia", ${serif}`;
    default:
      return `900 ${px}px ${sans}`;
  }
}

/** Promessa que resolve quando as fontes usadas nas estampas estão prontas. */
export function fontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const specs = [fontFor("varsity", 64), fontFor("block", 64), fontFor("script", 64)];
  return Promise.all(specs.map((s) => document.fonts.load(s).catch(() => undefined))).then(() => undefined);
}

/* ───────────────────────── Estampas ───────────────────────── */

type Graphic = NonNullable<GarmentSpec["graphic"]>;

function fitText(ctx: CanvasRenderingContext2D, text: string, style: Graphic["style"], maxW: number, maxH: number) {
  let px = maxH;
  ctx.font = fontFor(style, px);
  const w = ctx.measureText(text).width;
  if (w > maxW) px = Math.floor((px * maxW) / w);
  ctx.font = fontFor(style, px);
  return px;
}

function strokeFill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, outline: string | undefined, px: number, outer?: string) {
  ctx.lineJoin = "round";
  if (outer) {
    ctx.strokeStyle = outer;
    ctx.lineWidth = px * 0.2;
    ctx.strokeText(text, x, y);
  }
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = px * 0.11;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/**
 * Estampa principal: texto (+ número). `layout` define a proporção do decalque:
 * "wide" (texto no peito), "stack" (texto em cima, número grande embaixo),
 * "number" (só número, costas), "badge" (letra única).
 */
export function graphicTexture(g: Graphic, layout: "wide" | "stack" | "number" | "badge" | "vertical", base: string, gap = 0): CanvasTexture {
  const W = 1024;
  const H = layout === "wide" ? 384 : layout === "vertical" ? 256 : 1024;
  const { c, ctx } = canvas(W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const outer = g.style === "varsity" || g.style === "block" ? (luminance(base) < 0.3 ? undefined : undefined) : undefined;
  if (layout === "wide" || layout === "vertical") {
    const px = fitText(ctx, g.text, g.style, W * 0.92, H * (g.style === "script" ? 0.62 : 0.7));
    ctx.save();
    if (g.style === "script") {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.06);
      strokeFill(ctx, g.text, 0, 0, g.color, g.outline, px);
      // rabisco sublinhado típico de script de beisebol
      ctx.strokeStyle = g.color;
      ctx.lineWidth = px * 0.07;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-W * 0.36, px * 0.55);
      ctx.quadraticCurveTo(0, px * 0.8, W * 0.42, px * 0.42);
      ctx.stroke();
    } else {
      const text = g.style === "block" || g.style === "varsity" ? g.text.toUpperCase() : g.text;
      const words = text.split(" ");
      if (layout === "wide" && text.length > 13 && words.length > 1) {
        // texto longo: duas linhas equilibradas (ex.: "KIM KRISS / SKATE CO.")
        let best = 1;
        let bestD = Infinity;
        for (let i = 1; i < words.length; i++) {
          const a = words.slice(0, i).join(" ").length;
          const d = Math.abs(a - (text.length - a - 1));
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        const l1 = words.slice(0, best).join(" ");
        const l2 = words.slice(best).join(" ");
        const p2 = Math.min(fitText(ctx, l1, g.style, W * 0.9, H * 0.42), fitText(ctx, l2, g.style, W * 0.9, H * 0.42));
        ctx.font = fontFor(g.style, p2);
        strokeFill(ctx, l1, W / 2, H * 0.28, g.color, g.outline, p2, outer);
        strokeFill(ctx, l2, W / 2, H * 0.73, g.color, g.outline, p2, outer);
      } else {
        const p1 = fitText(ctx, text, g.style, W * 0.92, H * 0.7);
        strokeFill(ctx, text, W / 2, H / 2, g.color, g.outline, p1, outer);
      }
    }
    ctx.restore();
  } else if (layout === "stack") {
    const text = g.style === "script" || g.style === "gothic" ? g.text : g.text.toUpperCase();
    const tpx = fitText(ctx, text, g.style, W * 0.9, H * 0.22);
    // texto levemente em arco (varsity)
    if (g.style === "varsity" || g.style === "block") {
      const chars = [...text];
      const total = ctx.measureText(text).width;
      let x = W / 2 - total / 2;
      for (const ch of chars) {
        const cw = ctx.measureText(ch).width;
        const u = (x + cw / 2 - W / 2) / (W / 2);
        ctx.save();
        ctx.translate(x + cw / 2, H * 0.2 + u * u * H * 0.06);
        ctx.rotate(u * 0.12);
        strokeFill(ctx, ch, 0, 0, g.color, g.outline, tpx);
        ctx.restore();
        x += cw;
      }
    } else {
      strokeFill(ctx, text, W / 2, H * 0.2, g.color, g.outline, tpx);
    }
    if (g.number) {
      const npx = fitText(ctx, g.number, g.style === "script" ? "varsity" : g.style, W * 0.8, H * 0.62);
      strokeFill(ctx, g.number, W / 2, H * 0.64, g.color, g.outline, npx, g.outline ? shadeOuter(base) : undefined);
    }
  } else if (layout === "number") {
    const n = g.number ?? g.text.slice(0, 1);
    const npx = fitText(ctx, n, g.style === "script" ? "varsity" : g.style, W * 0.86, H * 0.86);
    strokeFill(ctx, n, W / 2, H * 0.53, g.color, g.outline, npx, g.outline ? shadeOuter(base) : undefined);
  } else {
    // badge: letra única em chenille (contorno grosso)
    const px = fitText(ctx, g.text, g.style, W * 0.8, H * 0.85);
    strokeFill(ctx, g.text, W / 2, H * 0.54, g.color, g.outline ?? shade(g.color, -0.4), px, g.outline ? g.color : undefined);
  }
  // estampa atravessada por zíper: o centro fica livre para o cadarço
  if (gap > 0) ctx.clearRect(W * (0.5 - gap / 2), 0, W * gap, H);
  return tex(c, false);
}

function shadeOuter(base: string) {
  return luminance(base) < 0.3 ? shade(base, 0.08) : shade(base, -0.05);
}

/* ───────────────────────── Detalhes (bolsos, vistas, zíper) ───────────────────────── */

export type DetailKind =
  | "kangaroo"
  | "placketButtons"
  | "zipper"
  | "snaps"
  | "blazerFront"
  | "jeansFront"
  | "jeansBack"
  | "pleats"
  | "drawstring"
  | "sideStripe"
  | "shirtPocket"
  | "grommets"
  // linha skate / workwear
  | "zipFull" // zíper metálico de ponta a ponta (moletom com zíper)
  | "splitPockets" // bolsos canguru divididos ao meio
  | "patchPocket" // bolso de chapa com pesponto (workwear)
  | "flapPocket" // bolso com aba e botão (flanela, bolso traseiro da cargo)
  | "flapPocketLine" // idem, só costuras e sombra (o tecido estampado aparece)
  | "cargoPocket" // bolso lateral com fole, aba e botões de pressão
  | "cargoFront" // bolsos faca, braguilha, passantes
  | "buttonholes" // vista com casas de botão (frente aberta)
  | "placketLine"; // vista só com costuras e botões (tecido estampado aparece)

export interface DetailOpts {
  /** Cor dos botões (vistas). */
  button?: string;
  /** Altura ÷ largura do decalque (vistas): os botões saem redondos. */
  aspect?: number;
  /** Quantidade de botões na vista. */
  count?: number;
}

const STRIPS = new Set<DetailKind>(["placketButtons", "placketLine", "buttonholes"]);

/** Textura transparente com o detalhe desenhado em `color` (tom sobre tom quando possível). */
export function detailTexture(kind: DetailKind, base: string, accent: string, opts: DetailOpts = {}): CanvasTexture {
  // vistas: o canvas segue a proporção do decalque (botões redondos, não riscos)
  const strip = STRIPS.has(kind);
  const W = strip ? 96 : 512;
  const H = strip ? Math.round(clampN(96 * (opts.aspect ?? 12), 256, 2048)) : 512;
  const { c, ctx } = canvas(W, H);
  const dark = luminance(base) < 0.3;
  const line = dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.28)";
  const seam = (x0: number, y0: number, x1: number, y1: number, w = 4, dash = false, col = line) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.setLineDash(dash ? [10, 8] : []);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  switch (kind) {
    case "kangaroo": {
      ctx.fillStyle = shade(base, dark ? 0.04 : -0.05);
      ctx.beginPath();
      ctx.moveTo(W * 0.04, H * 0.98);
      ctx.lineTo(W * 0.96, H * 0.98);
      ctx.lineTo(W * 0.8, H * 0.08);
      ctx.lineTo(W * 0.2, H * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 6;
      ctx.stroke();
      // aberturas laterais
      seam(W * 0.2, H * 0.08, W * 0.06, H * 0.7, 10, false, dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)");
      seam(W * 0.8, H * 0.08, W * 0.94, H * 0.7, 10, false, dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)");
      seam(W * 0.22, H * 0.14, W * 0.78, H * 0.14, 3, true);
      break;
    }
    case "placketButtons":
    case "placketLine": {
      if (kind === "placketButtons") {
        ctx.fillStyle = shade(base, dark ? 0.03 : -0.03);
        ctx.fillRect(W * 0.2, 0, W * 0.6, H);
      }
      seam(W * 0.2, 0, W * 0.2, H, 3, false, accent);
      seam(W * 0.8, 0, W * 0.8, H, 3, false, accent);
      const n = opts.count ?? 5;
      for (let i = 0; i < n; i++) {
        const y = H * ((i + 0.5) / n);
        ctx.fillStyle = opts.button ?? (dark ? "#e9e6dd" : "#f4f2ec");
        ctx.beginPath();
        ctx.arc(W * 0.5, y, W * 0.17, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        for (const dx of [-0.05, 0.05]) {
          ctx.beginPath();
          ctx.arc(W * (0.5 + dx), y, W * 0.025, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "zipper": {
      ctx.fillStyle = accent;
      ctx.fillRect(W * 0.46, 0, W * 0.08, H);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let y = 0; y < H; y += 10) ctx.fillRect(W * 0.49, y, W * 0.02, 5);
      ctx.fillStyle = "#c9ccd1";
      ctx.fillRect(W * 0.43, H * 0.02, W * 0.14, H * 0.07);
      break;
    }
    case "snaps": {
      seam(W * 0.5, 0, W * 0.5, H, 5, false, line);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(W * 0.5, H * (0.08 + i * 0.21), 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.arc(W * 0.5, H * (0.08 + i * 0.21), 8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "blazerFront": {
      // botão único + bolsos com aba
      ctx.fillStyle = shade(base, dark ? 0.16 : -0.3);
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.12, 15, 0, Math.PI * 2);
      ctx.fill();
      for (const x of [0.06, 0.66]) {
        ctx.fillStyle = shade(base, dark ? 0.05 : -0.06);
        ctx.fillRect(W * x, H * 0.6, W * 0.28, H * 0.09);
        ctx.strokeStyle = line;
        ctx.lineWidth = 4;
        ctx.strokeRect(W * x, H * 0.6, W * 0.28, H * 0.09);
      }
      seam(W * 0.5, H * 0.14, W * 0.5, H, 3, false, dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.3)");
      break;
    }
    case "jeansFront": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 8]);
      // braguilha
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H * 0.08);
      ctx.lineTo(W * 0.5, H * 0.7);
      ctx.moveTo(W * 0.56, H * 0.08);
      ctx.lineTo(W * 0.56, H * 0.6);
      ctx.quadraticCurveTo(W * 0.56, H * 0.72, W * 0.5, H * 0.72);
      ctx.stroke();
      // bolsos
      ctx.beginPath();
      ctx.moveTo(W * 0.02, H * 0.1);
      ctx.quadraticCurveTo(W * 0.2, H * 0.12, W * 0.24, H * 0.42);
      ctx.moveTo(W * 0.98, H * 0.1);
      ctx.quadraticCurveTo(W * 0.8, H * 0.12, W * 0.76, H * 0.42);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#c9a24a";
      ctx.beginPath();
      ctx.arc(W * 0.53, H * 0.05, 11, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "jeansBack": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 8]);
      for (const x of [0.08, 0.58]) {
        ctx.beginPath();
        ctx.moveTo(W * x, H * 0.2);
        ctx.lineTo(W * (x + 0.34), H * 0.2);
        ctx.lineTo(W * (x + 0.32), H * 0.75);
        ctx.lineTo(W * (x + 0.17), H * 0.85);
        ctx.lineTo(W * (x + 0.02), H * 0.75);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      break;
    }
    case "pleats": {
      for (const x of [0.2, 0.28, 0.72, 0.8]) seam(W * x, 0, W * x, H * 0.55, 5, false, dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.22)");
      seam(W * 0.5, 0, W * 0.5, H * 0.5, 4, false, dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.2)");
      break;
    }
    case "drawstring": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(W * 0.44, H * 0.05);
      ctx.quadraticCurveTo(W * 0.4, H * 0.5, W * 0.42, H * 0.95);
      ctx.moveTo(W * 0.56, H * 0.05);
      ctx.quadraticCurveTo(W * 0.6, H * 0.5, W * 0.57, H * 0.9);
      ctx.stroke();
      ctx.fillStyle = "#d8d8d8";
      ctx.fillRect(W * 0.4, H * 0.86, W * 0.04, H * 0.1);
      ctx.fillRect(W * 0.55, H * 0.82, W * 0.04, H * 0.1);
      break;
    }
    case "sideStripe": {
      ctx.fillStyle = accent;
      ctx.fillRect(W * 0.2, 0, W * 0.6, H);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(W * 0.2, 0, W * 0.05, H);
      ctx.fillRect(W * 0.75, 0, W * 0.05, H);
      break;
    }
    case "shirtPocket": {
      ctx.fillStyle = shade(base, -0.02);
      ctx.fillRect(W * 0.1, H * 0.1, W * 0.8, H * 0.85);
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 6;
      ctx.strokeRect(W * 0.1, H * 0.1, W * 0.8, H * 0.85);
      seam(W * 0.1, H * 0.22, W * 0.9, H * 0.22, 4, true);
      break;
    }
    case "grommets": {
      for (let x = 0; x < W; x += W / 6) {
        ctx.fillStyle = "#d9dbe0";
        ctx.beginPath();
        ctx.arc(x + W / 12, H / 2, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#151515";
        ctx.beginPath();
        ctx.arc(x + W / 12, H / 2, 20, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "zipFull": {
      // cadarço do zíper no tom do tecido, dentes metálicos e cursor com puxador
      ctx.fillStyle = shade(base, dark ? 0.06 : -0.12);
      ctx.fillRect(W * 0.38, 0, W * 0.24, H);
      seam(W * 0.4, 0, W * 0.4, H, 3, true, dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)");
      seam(W * 0.6, 0, W * 0.6, H, 3, true, dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)");
      for (let y = 0; y < H; y += 9) {
        ctx.fillStyle = "#c7cacf";
        ctx.fillRect(W * 0.455, y, W * 0.045, 5);
        ctx.fillRect(W * 0.5, y + 4.5, W * 0.045, 5);
      }
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(W * 0.497, 0, W * 0.006, H);
      // cursor perto do topo + puxador pendurado
      ctx.fillStyle = "#b9bdc3";
      ctx.fillRect(W * 0.43, H * 0.035, W * 0.14, H * 0.05);
      ctx.fillStyle = "#9da2a8";
      ctx.fillRect(W * 0.47, H * 0.08, W * 0.06, H * 0.09);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(W * 0.47, H * 0.08, W * 0.06, H * 0.09);
      break;
    }
    case "splitPockets": {
      // dois bolsos canguru (um de cada lado do zíper), aberturas inclinadas
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? W * 0.03 : W * 0.56;
        const x1 = side < 0 ? W * 0.44 : W * 0.97;
        ctx.fillStyle = shade(base, dark ? 0.035 : -0.045);
        ctx.beginPath();
        if (side < 0) {
          ctx.moveTo(x0, H * 0.98);
          ctx.lineTo(x1, H * 0.98);
          ctx.lineTo(x1, H * 0.08);
          ctx.lineTo(x0 + W * 0.14, H * 0.08);
        } else {
          ctx.moveTo(x1, H * 0.98);
          ctx.lineTo(x0, H * 0.98);
          ctx.lineTo(x0, H * 0.08);
          ctx.lineTo(x1 - W * 0.14, H * 0.08);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = line;
        ctx.lineWidth = 5;
        ctx.stroke();
        const ox = side < 0 ? x0 + W * 0.14 : x1 - W * 0.14;
        const ex = side < 0 ? x0 + W * 0.01 : x1 - W * 0.01;
        seam(ox, H * 0.08, ex, H * 0.72, 10, false, dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)");
      }
      break;
    }
    case "patchPocket": {
      // bolso de chapa: tecido levemente mais escuro, pesponto duplo e cantos de reforço
      ctx.fillStyle = shade(base, dark ? 0.05 : -0.07);
      ctx.fillRect(W * 0.06, H * 0.06, W * 0.88, H * 0.88);
      ctx.strokeStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.32)";
      ctx.lineWidth = 7;
      ctx.strokeRect(W * 0.06, H * 0.06, W * 0.88, H * 0.88);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(W * 0.12, H * 0.12, W * 0.76, H * 0.76);
      ctx.beginPath();
      ctx.moveTo(W * 0.12, H * 0.24);
      ctx.lineTo(W * 0.88, H * 0.24);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = accent;
      for (const x of [0.12, 0.88]) {
        ctx.beginPath();
        ctx.arc(W * x, H * 0.12, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "flapPocket": {
      ctx.fillStyle = shade(base, dark ? 0.04 : -0.05);
      ctx.fillRect(W * 0.08, H * 0.12, W * 0.84, H * 0.84);
      ctx.strokeStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.28)";
      ctx.lineWidth = 6;
      ctx.strokeRect(W * 0.08, H * 0.12, W * 0.84, H * 0.84);
      // aba em ponta com sombra embaixo
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.moveTo(W * 0.06, H * 0.08);
      ctx.lineTo(W * 0.94, H * 0.08);
      ctx.lineTo(W * 0.94, H * 0.4);
      ctx.lineTo(W * 0.5, H * 0.5);
      ctx.lineTo(W * 0.06, H * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(base, dark ? 0.08 : -0.02);
      ctx.beginPath();
      ctx.moveTo(W * 0.06, H * 0.04);
      ctx.lineTo(W * 0.94, H * 0.04);
      ctx.lineTo(W * 0.94, H * 0.36);
      ctx.lineTo(W * 0.5, H * 0.46);
      ctx.lineTo(W * 0.06, H * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.36, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case "flapPocketLine": {
      // bolso de flanela: o xadrez continua; só sombra da aba, costuras e botão
      const ink = "rgba(0,0,0,0.42)";
      ctx.strokeStyle = ink;
      ctx.lineWidth = 6;
      ctx.strokeRect(W * 0.1, H * 0.14, W * 0.8, H * 0.8);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H * 0.36);
      ctx.lineTo(W * 0.5, H * 0.48);
      ctx.lineTo(W * 0.92, H * 0.36);
      ctx.lineTo(W * 0.92, H * 0.42);
      ctx.lineTo(W * 0.5, H * 0.55);
      ctx.lineTo(W * 0.08, H * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H * 0.06);
      ctx.lineTo(W * 0.92, H * 0.06);
      ctx.lineTo(W * 0.92, H * 0.36);
      ctx.lineTo(W * 0.5, H * 0.48);
      ctx.lineTo(W * 0.08, H * 0.36);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.36, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case "cargoPocket": {
      // bolso lateral com fole: corpo, sombra das pregas, aba com dois botões de pressão
      ctx.fillStyle = shade(base, dark ? 0.05 : -0.06);
      ctx.fillRect(W * 0.07, H * 0.2, W * 0.86, H * 0.76);
      ctx.strokeStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = 7;
      ctx.strokeRect(W * 0.07, H * 0.2, W * 0.86, H * 0.76);
      for (const x of [0.13, 0.87]) seam(W * x, H * 0.24, W * x, H * 0.94, 5, false, dark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.22)");
      seam(W * 0.5, H * 0.3, W * 0.5, H * 0.92, 8, false, dark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.18)");
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(W * 0.11, H * 0.24, W * 0.78, H * 0.68);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(W * 0.04, H * 0.27, W * 0.92, H * 0.06);
      ctx.fillStyle = shade(base, dark ? 0.09 : -0.02);
      ctx.fillRect(W * 0.04, H * 0.03, W * 0.92, H * 0.26);
      ctx.strokeStyle = line;
      ctx.lineWidth = 5;
      ctx.strokeRect(W * 0.04, H * 0.03, W * 0.92, H * 0.26);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(W * 0.08, H * 0.07, W * 0.84, H * 0.18);
      ctx.setLineDash([]);
      for (const x of [0.28, 0.72]) {
        ctx.fillStyle = "#8d8f93";
        ctx.beginPath();
        ctx.arc(W * x, H * 0.17, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.arc(W * x, H * 0.17, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "cargoFront": {
      // braguilha pespontada, bolsos faca, passantes e botão do cós
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(W * 0.56, H * 0.12);
      ctx.lineTo(W * 0.56, H * 0.62);
      ctx.quadraticCurveTo(W * 0.56, H * 0.74, W * 0.5, H * 0.74);
      ctx.stroke();
      ctx.setLineDash([]);
      seam(W * 0.5, H * 0.12, W * 0.5, H * 0.74, 4, false, dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)");
      for (const [x0, x1] of [
        [0.04, 0.2],
        [0.96, 0.8],
      ]) {
        seam(W * x0, H * 0.12, W * x1, H * 0.5, 9, false, dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.32)");
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.moveTo(W * x0 + (x1 > x0 ? 14 : -14), H * 0.12);
        ctx.lineTo(W * x1 + (x1 > x0 ? 14 : -14), H * 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // passantes (topo do decalque = cós)
      for (const x of [0.12, 0.36, 0.64, 0.88]) {
        ctx.fillStyle = shade(base, dark ? 0.1 : -0.08);
        ctx.fillRect(W * x - 9, 0, 18, H * 0.11);
        ctx.strokeStyle = line;
        ctx.lineWidth = 3;
        ctx.strokeRect(W * x - 9, 0, 18, H * 0.11);
      }
      ctx.fillStyle = "#8d8f93";
      ctx.beginPath();
      ctx.arc(W * 0.53, H * 0.055, 12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "buttonholes": {
      seam(W * 0.2, 0, W * 0.2, H, 3, false, accent);
      seam(W * 0.8, 0, W * 0.8, H, 3, false, accent);
      const n = opts.count ?? 6;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(W * 0.32, H * ((i + 0.5) / n) - W * 0.035, W * 0.36, W * 0.07);
      }
      break;
    }
  }
  return tex(c, false);
}

/** Etiqueta tecida (gorro, bolso): retângulo com o texto centralizado. */
export function labelTexture(g: Graphic, base: string, background?: string): CanvasTexture {
  const W = 512, H = 192;
  const { c, ctx } = canvas(W, H);
  const textLight = luminance(g.color) > 0.5;
  const bg = background ?? g.outline ?? (textLight ? (luminance(base) < 0.2 ? "#1f1f22" : shade(base, -0.5)) : "#efebe1");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.strokeStyle = textLight ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  ctx.strokeRect(16, 16, W - 32, H - 32);
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = g.style === "block" || g.style === "varsity" ? g.text.toUpperCase() : g.text;
  const px = fitText(ctx, text, g.style, W * 0.84, H * 0.5);
  ctx.fillStyle = g.color;
  ctx.fillText(text, W / 2, H * 0.53);
  void px;
  return tex(c, false);
}

/* ───────────────────────── Skate ───────────────────────── */

/** Lixa (grip): preta com grão; u = largura, v = comprimento. */
export function gripTexture(): CanvasTexture {
  const W = 128, H = 512;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#151517";
  ctx.fillRect(0, 0, W, H);
  noise(ctx, W, H, 5200, "#ffffff", 0.07, 1, 41);
  noise(ctx, W, H, 2200, "#000000", 0.25, 2, 43);
  // parafusos do truck (8 pontos) e corte central discreto da lixa
  ctx.fillStyle = "#6d6f73";
  for (const v of [0.2, 0.26, 0.74, 0.8])
    for (const u of [0.38, 0.62]) {
      ctx.beginPath();
      ctx.arc(u * W, v * H, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  return tex(c, false);
}

/**
 * Base do shape com o grafismo do produto: fundo na cor base, faixas em `secondary`
 * e o texto de `graphic` correndo ao longo do comprimento (v = tail → nose).
 */
export function deckBottomTexture(base: string, secondary: string | undefined, trim: string | undefined, g: Graphic | undefined): CanvasTexture {
  const W = 256, H = 1024;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const dark = luminance(base) < 0.3;
  noise(ctx, W, H, 1500, dark ? "#ffffff" : "#000000", 0.04, 2, 47);
  if (secondary) {
    ctx.fillStyle = secondary;
    ctx.fillRect(0, H * 0.06, W, H * 0.05);
    ctx.fillRect(0, H * 0.89, W, H * 0.05);
  }
  if (trim) {
    ctx.fillStyle = trim;
    ctx.fillRect(0, H * 0.12, W, H * 0.012);
    ctx.fillRect(0, H * 0.868, W, H * 0.012);
  }
  if (g) {
    // texto rotacionado: lê de baixo (tail) para cima (nose) com a placa de pé
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = g.style === "block" || g.style === "varsity" ? g.text.toUpperCase() : g.text;
    const px = fitText(ctx, text, g.style, H * 0.66, W * 0.62);
    strokeFill(ctx, text, 0, 0, g.color, g.outline, px);
    ctx.restore();
  }
  return tex(c, false);
}

/** Cinto (repete ao longo da faixa) com ilhoses metálicos. */
export function beltTexture(color: string): PatternTex {
  const { c, ctx } = canvas(128, 64);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 64);
  for (const x of [32, 96]) {
    ctx.fillStyle = "#d9dbe0";
    ctx.beginPath();
    ctx.arc(x, 32, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(x, 32, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  return { texture: tex(c, true), tileCm: 6 };
}

/* ───────────────────────── Calçados e boné ───────────────────────── */

/**
 * Cabedal do tênis/mocassim em UV normalizado: u = volta (0 = lado medial,
 * 0.25 = topo, 0.5 = lateral, 0.75 = sola), v = calcanhar → bico.
 */
export function shoeTexture(kind: "sneaker" | "loafer" | "skate", base: string, secondary?: string, trim?: string): CanvasTexture {
  const W = 512, H = 512;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // v (calcanhar→bico) é o eixo y do canvas invertido: y = (1 − v)·H
  const Y = (v: number) => (1 - v) * H;
  const X = (u: number) => u * W;
  if (kind === "skate") {
    const dark = luminance(base) < 0.3;
    // camurça: grão aveludado
    noise(ctx, W, H, 4200, dark ? "#ffffff" : "#000000", dark ? 0.05 : 0.06, 2, 23);
    noise(ctx, W, H, 1600, dark ? "#000000" : "#ffffff", 0.08, 3, 25);
    // biqueira de borracha (cor da sola) envolvendo a ponta, só na metade de baixo
    // tênis de skate: sola/biqueira = secondary (branca, goma…); pesponto e faixa = trim
    const rubber = secondary ?? trim ?? "#f1ede4";
    const accent = trim && trim.toLowerCase() !== base.toLowerCase() ? trim : undefined;
    ctx.fillStyle = rubber;
    ctx.fillRect(0, Y(1), W, Y(0.95) - Y(1));
    ctx.fillRect(X(0.37), Y(0.95), X(1) - X(0.37), Y(0.85) - Y(0.95));
    ctx.fillRect(0, Y(0.95), X(0.13), Y(0.85) - Y(0.95));
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(0.13), Y(0.85));
    ctx.lineTo(X(0.13), Y(0.95));
    ctx.lineTo(X(0.37), Y(0.95));
    ctx.lineTo(X(0.37), Y(0.85));
    ctx.lineTo(W, Y(0.85));
    ctx.moveTo(0, Y(0.85));
    ctx.lineTo(X(0.13), Y(0.85));
    ctx.stroke();
    // sobreposições de camurça em tom sobre tom (biqueira de cima e contraforte)
    const over = shade(base, dark ? 0.07 : -0.07);
    ctx.fillStyle = over;
    ctx.fillRect(0, Y(0.86), W, Y(0.7) - Y(0.86));
    ctx.fillRect(0, Y(0.22), W, Y(0) - Y(0.22));
    // pesponto duplo nas sobreposições
    const stitch = accent ?? (dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.3)");
    ctx.strokeStyle = stitch;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    for (const v of [0.705, 0.725, 0.215, 0.195]) {
      ctx.beginPath();
      ctx.moveTo(0, Y(v));
      ctx.lineTo(W, Y(v));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // faixa lateral ondulada (lado externo e interno), na cor secundária
    if (accent) {
      for (const u0 of [0.5, 0.0]) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(X(u0 + 0.08), Y(0.24));
        ctx.bezierCurveTo(X(u0 + 0.02), Y(0.4), X(u0 + 0.14), Y(0.5), X(u0 + 0.06), Y(0.68));
        ctx.lineTo(X(u0 + 0.1), Y(0.68));
        ctx.bezierCurveTo(X(u0 + 0.18), Y(0.5), X(u0 + 0.06), Y(0.4), X(u0 + 0.13), Y(0.24));
        ctx.closePath();
        ctx.fill();
      }
    }
    // gola acolchoada escura em volta do tornozelo
    ctx.fillStyle = dark ? shade(base, 0.12) : shade(base, -0.35);
    ctx.beginPath();
    ctx.ellipse(X(0.25), Y(0.2), X(0.14), H * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // lingueta grossa e cadarço largo (6 passadas)
    ctx.fillStyle = shade(base, dark ? 0.05 : -0.05);
    ctx.fillRect(X(0.16), Y(0.68), X(0.18), Y(0.28) - Y(0.68));
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(X(0.16), Y(0.68), X(0.18), Y(0.28) - Y(0.68));
    const lace = dark ? shade(base, 0.08) : shade(base, -0.2);
    for (let i = 0; i < 6; i++) {
      const v = 0.33 + i * 0.062;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(X(0.165), Y(v));
      ctx.lineTo(X(0.335), Y(v + 0.02));
      ctx.stroke();
      ctx.strokeStyle = lace;
      ctx.lineWidth = 10;
      ctx.stroke();
      // ilhoses
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      for (const u of [0.17, 0.33]) {
        ctx.beginPath();
        ctx.arc(X(u), Y(v + 0.01), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // sola (parte de baixo do cabedal) na cor da borracha
    ctx.fillStyle = rubber;
    ctx.fillRect(X(0.68), 0, X(0.14), H);
    return tex(c, false);
  }
  if (kind === "sneaker") {
    noise(ctx, W, H, 2000, "#000", 0.03, 2, 21);
    const suede = secondary ? shade(secondary, -0.08) : "#a9a8a4";
    ctx.fillStyle = suede;
    // biqueira
    ctx.fillRect(0, Y(1), W, Y(0.82) - Y(1));
    // contraforte do calcanhar
    ctx.fillRect(0, Y(0.2), W, Y(0) - Y(0.2));
    // painel lateral e medial (faixa)
    for (const u0 of [0.36, 0.0]) {
      ctx.beginPath();
      ctx.moveTo(X(u0 + 0.04), Y(0.3));
      ctx.lineTo(X(u0 + 0.12), Y(0.62));
      ctx.lineTo(X(u0 + 0.2), Y(0.62));
      ctx.lineTo(X(u0 + 0.12), Y(0.3));
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(X(0.86), Y(0.62), X(0.14), Y(0.3) - Y(0.62));
    // boca do tênis (colarinho escuro em volta do tornozelo)
    ctx.fillStyle = "#3a3633";
    ctx.beginPath();
    ctx.ellipse(X(0.25), Y(0.2), X(0.13), Y(0.08) - Y(0.2) + H * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // lingueta e cadarço sobre o peito do pé (topo: u ≈ 0.25)
    ctx.fillStyle = shade(base, -0.1);
    ctx.fillRect(X(0.17), Y(0.64), X(0.16), Y(0.3) - Y(0.64));
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(X(0.17), Y(0.64), X(0.16), Y(0.3) - Y(0.64));
    for (let i = 0; i < 6; i++) {
      const v = 0.34 + i * 0.05;
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(X(0.175), Y(v));
      ctx.lineTo(X(0.325), Y(v + 0.018));
      ctx.stroke();
      ctx.strokeStyle = trim ?? "#f4f4f2";
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    // linha da sola
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(X(0.68), 0, X(0.14), H);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    for (const v of [0.82, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(0, Y(v));
      ctx.lineTo(W, Y(v));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else {
    // mocassim: brilho de couro + tira "penny" e costura do avental
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, shade(base, 0.04));
    g.addColorStop(0.25, shade(base, 0.16));
    g.addColorStop(0.5, shade(base, 0.02));
    g.addColorStop(1, shade(base, 0.04));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = shade(base, -0.4);
    ctx.fillRect(X(0.08), Y(0.6), X(0.34), Y(0.52) - Y(0.6));
    ctx.fillStyle = shade(base, -0.6);
    ctx.fillRect(X(0.21), Y(0.585), X(0.08), Y(0.535) - Y(0.585));
    ctx.strokeStyle = trim ? shade(trim, 0.25) : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.ellipse(X(0.25), Y(0.78), X(0.15), Y(0.6) - Y(0.78), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  return tex(c, false);
}

/** Sola vulcanizada (UV: u = volta, v = chão → topo): borracha com filete e textura de piso. */
export function vulcSoleTexture(rubber: string, line?: string): CanvasTexture {
  const W = 512, H = 64;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = rubber;
  ctx.fillRect(0, 0, W, H);
  const dark = luminance(rubber) < 0.45;
  noise(ctx, W, H, 900, dark ? "#000000" : "#6b6255", 0.08, 2, 51);
  // filete fino perto do topo (fita de vulcanização) e linha do piso embaixo
  ctx.fillStyle = line ?? (dark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.55)");
  ctx.fillRect(0, H * 0.2, W, H * 0.07);
  ctx.fillStyle = dark ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.12)";
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
  for (let x = 0; x < W; x += 8) {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x, H * 0.82, 3, H * 0.18);
  }
  return tex(c, false);
}

/** Copa do boné: gomos com costura e botão (UV: u = volta, v = aba → topo). */
export function capTexture(base: string, pattern: FabricPattern): CanvasTexture {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const dark = luminance(base) < 0.3;
  noise(ctx, W, H, 1500, dark ? "#fff" : "#000", 0.04, 2, 31);
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.22)";
  ctx.lineWidth = 3;
  const panels = pattern === "nylon" ? 5 : 6;
  for (let i = 0; i < panels; i++) {
    const x = ((i + 0.5) / panels) * W;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x, 0);
    ctx.stroke();
  }
  if (pattern === "nylon") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 40; i++) ctx.fillRect(((i * 37) % W) + 3, 40 + ((i * 53) % 120), 3, 3);
  }
  return tex(c, false);
}
