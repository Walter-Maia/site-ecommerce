import { Group, type Material, type Texture } from "three";
import type { GarmentKind, GarmentSlot, GarmentSpec, SizeChartRow } from "@/lib/types";
import { type TrunkField, armSection, legSection } from "./field";
import type { BodyMeshes } from "./body";
import { ARM_SEGS, LEG_SEGS } from "./body";
import type { Rig } from "./rig";
import type { Shape } from "./shape";
import {
  type LimbField, LimbDecal, LimbShell, Ribbon, SurfaceStrap, TrunkDecal, TrunkShell, boundary, clampedRows, spanRows,
} from "./pieces";
import { TAU, angBump, clamp, ellipseFactor, hash, lerp, offsetEllipseR, offsetEllipseR2, smax, smin, smoothstep } from "./math";
import { type RimUniforms, decalMaterial, fabricMaterial, plainMaterial } from "./materials";
import { type DetailKind, type DetailOpts, beltTexture, detailTexture, graphicTexture, luminance, patternTexture, ribTexture, shade } from "./textures";

/** Tipos internos do motor: camadas-base neutras quando o slot está vazio. */
export type EngineKind = GarmentKind | "sportsBra" | "baseTank" | "bikeShorts" | "baseShorts";

export interface EngineGarment {
  key: string;
  kind: EngineKind;
  slot: GarmentSlot;
  spec: Omit<GarmentSpec, "kind"> & { kind: EngineKind };
  row: SizeChartRow;
}

export interface Ctx {
  s: Shape;
  rig: Rig;
  field: TrunkField;
  body: BodyMeshes;
  armF: [LimbField, LimbField];
  legF: [LimbField, LimbField];
  /** Raio máximo no tronco antes de encostar no braço (∞ se livre). */
  armLimit: (y: number, phi: number) => number;
  /** Altura mínima (repouso) que a barra da calça alcança: frente/trás (sobre o calçado). */
  hemFloor: { front: number; back: number };
  tucked: boolean;
  hpsY: number;
  armpitY: number;
}

const FRONT = Math.PI / 2;
const BACK = (3 * Math.PI) / 2;
const TOPS: EngineKind[] = [
  "tee", "babyTee", "tank", "ribTank", "jersey", "shirt", "sportsBra", "baseTank", "hoodie", "croppedHoodie", "crewneck", "varsityJacket", "windbreaker", "blazer", "dress", "slipDress",
  "longTee", "zipHoodie", "workJacket",
];
const PANTS: EngineKind[] = ["sweatpants", "jeans", "trousers", "wideTrousers", "shorts", "meshShorts", "bikeShorts", "baseShorts", "cargoPants", "cargoShorts"];
const CARGO: EngineKind[] = ["cargoPants", "cargoShorts"];
/** Decalques em faixa vertical estreita (vistas, zíper): grade 2 × 14. */
const STRIP_DETAILS = new Set<DetailKind>(["placketButtons", "placketLine", "buttonholes", "zipFull"]);
/** Padrões que pedem UV cilíndrico (listras/xadrez retos, sem seguir a curva da barra). */
const CYL_PATTERNS = new Set(["plaid", "canvas", "corduroy"]);
const SKIRTS: EngineKind[] = ["miniSkirt", "midiSkirt"];

export const isTopLike = (k: EngineKind) => TOPS.includes(k);
export const isPants = (k: EngineKind) => PANTS.includes(k);
export const isSkirt = (k: EngineKind) => SKIRTS.includes(k);

/** Altura de repouso → parâmetro t da perna. */
export function yToLegT(s: Shape, rig: Rig, y: number) {
  const yHJ = rig.yHJ;
  return y >= s.kneeY ? (yHJ - y) / (yHJ - s.kneeY) : 1 + (s.kneeY - y) / (s.kneeY - s.ankleY);
}

/* ───────────────────────── Modelos por tipo ───────────────────────── */

type Neck = "crew" | "vneck" | "scoop" | "thin" | "slip" | "bra" | "blazer" | "stand" | "shirt" | "work";
type Fit = "box" | "regular" | "slim";

interface TopModel {
  thick: number;
  fit: Fit;
  aspect: number;
  neck: Neck;
  sleeve: "short" | "cap" | "long" | "none";
  cuff: "rib" | "band" | "none";
  hemBand: "rib" | "elastic" | "none" | "raw";
  collar: "rib" | "piping" | "shirt" | "stand" | "hood" | "none" | "blazer" | "work";
  sleeveColor: "base" | "secondary";
  folds: number;
  dress?: "box" | "bias";
  curvedHem: number;
  shoulderPad: number;
  straps?: { width: number; front: number; back: number };
  armhole?: "deep" | "normal";
  defaultLen: number;
  defaultSleeve: number;
  /** Frente aberta (camisa usada como sobreposição, desabotoada). */
  open?: boolean;
}

function topModel(k: EngineKind, sil: GarmentSpec["silhouette"], slot: GarmentSlot): TopModel {
  const fit: Fit = sil === "oversized" ? "box" : sil === "slim" ? "slim" : sil === "cropped" ? "slim" : "regular";
  const base: TopModel = {
    thick: 0.4, fit, aspect: 0.6, neck: "crew", sleeve: "short", cuff: "band", hemBand: "none", collar: "rib", sleeveColor: "base",
    folds: 0.6, curvedHem: 0, shoulderPad: 0, defaultLen: 70, defaultSleeve: 24,
  };
  switch (k) {
    case "tee":
      return base;
    case "babyTee":
      return { ...base, fit: "slim", sleeve: "cap", folds: 0, thick: 0.28, defaultLen: 45, defaultSleeve: 12 };
    case "tank":
      return { ...base, neck: "scoop", sleeve: "none", collar: "piping", armhole: "deep", straps: { width: sil === "oversized" ? 6 : 5, front: 0.92, back: 0.88 } };
    case "baseTank":
      return { ...base, fit: "slim", neck: "scoop", sleeve: "none", collar: "none", folds: 0, thick: 0.3, armhole: "normal", straps: { width: 5.5, front: 0.92, back: 0.88 } };
    case "ribTank":
      return { ...base, fit: "slim", neck: "thin", sleeve: "none", collar: "none", folds: 0, thick: 0.25, straps: { width: 1.3, front: 1.08, back: 0.98 } };
    case "sportsBra":
      return { ...base, fit: "slim", neck: "bra", sleeve: "none", collar: "none", hemBand: "elastic", folds: 0, thick: 0.3, straps: { width: 3.2, front: 1.0, back: 0.82 } };
    case "jersey":
      return { ...base, neck: "vneck", collar: "piping", curvedHem: 2.5 };
    case "shirt":
      // camisa na sobreposição (ex.: flanela por cima da camiseta) veste aberta
      return slot === "outer"
        ? { ...base, thick: 0.6, neck: "shirt", sleeve: "long", cuff: "band", collar: "shirt", curvedHem: 4, folds: 0.55, defaultLen: 76, defaultSleeve: 63, open: true }
        : { ...base, neck: "shirt", sleeve: "long", cuff: "band", collar: "shirt", curvedHem: 4, folds: 0.4, defaultLen: 74, defaultSleeve: 62 };
    case "longTee":
      return { ...base, sleeve: "long", cuff: "rib", folds: 0.5, defaultLen: 72, defaultSleeve: 61 };
    case "zipHoodie":
      return { ...base, thick: 0.9, aspect: 0.62, sleeve: "long", cuff: "rib", hemBand: "rib", collar: "hood", folds: 0.7, defaultSleeve: 60 };
    case "workJacket":
      return {
        ...base, fit: sil === "oversized" ? "box" : "regular", thick: 1.1, aspect: 0.63, neck: "work", sleeve: "long", cuff: "band", hemBand: "none", collar: "work",
        folds: 0.3, shoulderPad: 0.6, defaultLen: 74, defaultSleeve: 62,
      };
    case "hoodie":
      return { ...base, thick: 0.9, aspect: 0.62, sleeve: "long", cuff: "rib", hemBand: "rib", collar: "hood", folds: 0.8, defaultSleeve: 60 };
    case "croppedHoodie":
      return { ...base, fit: "box", thick: 0.85, aspect: 0.62, sleeve: "long", cuff: "rib", hemBand: "raw", collar: "hood", folds: 0.5, defaultSleeve: 56 };
    case "crewneck":
      return { ...base, thick: 0.8, aspect: 0.62, sleeve: "long", cuff: "rib", hemBand: "rib", collar: "rib", folds: 0.5, defaultSleeve: 59 };
    case "varsityJacket":
      return { ...base, thick: 1.15, aspect: 0.64, sleeve: "long", cuff: "rib", hemBand: "rib", collar: "rib", sleeveColor: "secondary", folds: 0.35, defaultSleeve: 62 };
    case "windbreaker":
      return { ...base, thick: 0.8, aspect: 0.62, neck: "stand", sleeve: "long", cuff: "band", hemBand: "elastic", collar: "stand", folds: 0.9, defaultSleeve: 61 };
    case "blazer":
      return { ...base, fit: sil === "oversized" ? "box" : "regular", thick: 1.0, aspect: 0.6, neck: "blazer", sleeve: "long", cuff: "none", collar: "blazer", folds: 0.25, shoulderPad: 2.6, defaultSleeve: 62 };
    case "dress":
      return { ...base, dress: "box", folds: 0.9, defaultLen: 92 };
    case "slipDress":
      return { ...base, fit: "slim", neck: "slip", sleeve: "none", collar: "none", dress: "bias", folds: 0.7, thick: 0.25, straps: { width: 0.8, front: 1.1, back: 0.98 }, defaultLen: 112 };
    default:
      return base;
  }
}

/* ───────────────────────── Instância de peça ───────────────────────── */

export class GarmentInstance {
  readonly group = new Group();
  readonly g: EngineGarment;
  private readonly rim: RimUniforms;
  private mats: Material[] = [];
  private texs: Texture[] = [];
  private shells: TrunkShell[] = [];
  private limbs: LimbShell[] = [];
  private decals: (TrunkDecal | LimbDecal)[] = [];
  private ribbons: Ribbon[] = [];

  // peças nomeadas
  private main?: TrunkShell;
  private yoke?: TrunkShell;
  private collar?: TrunkShell;
  private hemBand?: TrunkShell;
  private hood?: TrunkShell;
  private lapel?: TrunkShell;
  private sleeves: LimbShell[] = [];
  private sleevesTop: LimbShell[] = [];
  private cuffs: LimbShell[] = [];
  private straps: SurfaceStrap[] = [];
  private cords: Ribbon[] = [];
  private legs: LimbShell[] = [];
  private waistband?: TrunkShell;
  private gfx: { d: TrunkDecal | LimbDecal; place: string; layout: string; w: number; h: number; leg?: number }[] = [];
  private details: { d: TrunkDecal | LimbDecal; kind: DetailKind; leg?: number }[] = [];

  private model?: TopModel;
  private matBase!: Material;
  private matSecondary!: Material;
  private matTrim!: Material;
  private matRib!: Material;
  private matCollar!: Material;
  /** UV cilíndrico nas cascas do tronco (xadrez/lona/cotelê). */
  private cyl = false;
  /** Meia abertura (rad) da frente aberta por altura. */
  private gap: (y: number) => number = () => 0;

  /** Dados da última atualização, usados pela folga dos braços e pela barra da calça. */
  hemY = 0;
  topY = 0;
  private sleeveEndT = 0;
  private sleeveC: [number, number, number] = [0, 0, 0];

  constructor(g: EngineGarment, rim: RimUniforms, parent: Group) {
    this.g = g;
    this.rim = rim;
    this.group.name = `garment-${g.key}`;
    parent.add(this.group);
    const sp = g.spec;
    const pat = patternTexture(sp.pattern, sp.colors.base, sp.colors.secondary, sp.colors.trim);
    pat.texture.repeat.set(1 / pat.tileCm, 1 / pat.tileCm);
    this.texs.push(pat.texture);
    this.matBase = this.track(fabricMaterial(sp.pattern, pat.texture, rim));
    if (sp.pattern === "satin") (this.matBase as unknown as { flatShading: boolean }).flatShading = false;
    const secHex = sp.colors.secondary ?? sp.colors.base;
    if (g.kind === "varsityJacket" || g.kind === "windbreaker") {
      const p2 = patternTexture(g.kind === "varsityJacket" ? "leather" : sp.pattern, secHex);
      p2.texture.repeat.set(1 / p2.tileCm, 1 / p2.tileCm);
      this.texs.push(p2.texture);
      this.matSecondary = this.track(fabricMaterial(g.kind === "varsityJacket" ? "leather" : sp.pattern, p2.texture, rim));
    } else this.matSecondary = this.matBase;
    const trimHex = sp.colors.trim ?? sp.colors.base;
    this.matTrim = this.track(plainMaterial(trimHex, rim, 0.8));
    const stripes = g.kind === "varsityJacket" ? [sp.colors.base, sp.colors.base] : undefined;
    const rib = ribTexture(g.kind === "varsityJacket" ? sp.colors.base : trimHex, stripes ? [secHex, secHex] : undefined);
    rib.texture.repeat.set(1 / rib.tileCm, 1 / rib.tileCm);
    this.texs.push(rib.texture);
    this.matRib = this.track(fabricMaterial("rib", rib.texture, rim));
    this.cyl = CYL_PATTERNS.has(sp.pattern);
    if (g.kind === "workJacket") {
      // gola de veludo cotelê na cor de acabamento
      const cord = patternTexture("corduroy", trimHex);
      cord.texture.repeat.set(1 / cord.tileCm, 1 / cord.tileCm);
      this.texs.push(cord.texture);
      this.matCollar = this.track(fabricMaterial("corduroy", cord.texture, rim));
    } else this.matCollar = this.matBase;

    if (isTopLike(g.kind)) this.buildTop();
    else if (isPants(g.kind)) this.buildPants();
    else if (isSkirt(g.kind)) this.buildSkirt();
  }

  private track<T extends Material>(m: T): T {
    this.mats.push(m);
    return m;
  }

  /* ─────────── construção da topologia ─────────── */

  private buildTop() {
    const g = this.g;
    const m = (this.model = topModel(g.kind, g.spec.silhouette, g.slot));
    const rows = m.dress ? 30 : 24;
    this.main = this.shell(rows, this.matBase, "main");
    if (g.kind === "windbreaker") this.yoke = this.shell(8, this.matSecondary, "yoke");
    if (m.collar === "rib") this.collar = this.shell(3, g.kind === "varsityJacket" ? this.matRib : this.matRib, "collar");
    else if (m.collar === "piping") this.collar = this.shell(3, this.matTrim, "piping");
    else if (m.collar === "stand") this.collar = this.shell(3, this.matBase, "stand");
    else if (m.collar === "shirt") this.collar = this.shell(4, this.matBase, "shirtCollar");
    else if (m.collar === "work") this.collar = this.shell(5, this.matCollar, "workCollar");
    else if (m.collar === "hood") {
      this.collar = this.shell(3, this.matBase, "hoodRim");
      this.hood = this.shell(6, this.matBase, "hood");
    } else if (m.collar === "blazer") {
      const lapelMat = this.track(plainMaterial(shade(g.spec.colors.base, 0.04), this.rim, 0.45, 0.05));
      this.lapel = this.shell(4, lapelMat, "lapel");
    }
    if (m.hemBand === "rib") this.hemBand = this.shell(3, this.matRib, "hemBand");
    else if (m.hemBand === "elastic") this.hemBand = this.shell(3, g.kind === "sportsBra" ? this.track(plainMaterial(shade(g.spec.colors.base, -0.25), this.rim, 0.8)) : this.matBase, "hemBand");
    if (m.sleeve !== "none") {
      const sm = m.sleeveColor === "secondary" ? this.matSecondary : this.matBase;
      for (let k = 0; k < 2; k++) {
        this.sleeves.push(this.limb(ARM_SEGS, 12, sm, `sleeve${k}`, true));
        if (g.kind === "windbreaker") this.sleevesTop.push(this.limb(ARM_SEGS, 5, this.matSecondary, `sleeveTop${k}`, true));
        if (m.cuff !== "none" || m.sleeve === "short" || m.sleeve === "cap") {
          const cm = m.cuff === "rib" ? this.matRib : g.kind === "babyTee" || g.kind === "jersey" || g.kind === "dress" ? this.matTrim : sm;
          this.cuffs.push(this.limb(ARM_SEGS, 3, cm, `cuff${k}`));
        }
      }
    }
    if (m.straps)
      for (let k = 0; k < 2; k++) {
        const st = new SurfaceStrap(16, this.matBase, this.group, `strap${k}`, g.spec.pattern === "satin");
        this.straps.push(st);
      }
    if (m.collar === "hood") for (let k = 0; k < 2; k++) this.cords.push(this.ribbon(8, this.matTrim, `cord${k}`));

    // estampas e detalhes
    const gr = g.spec.graphic;
    if (gr) {
      const center = gr.placement === "center";
      const layout = center ? (gr.number ? "stack" : "wide") : gr.placement === "leftChest" ? (gr.text.length <= 2 ? "badge" : "wide") : gr.placement === "back" ? (gr.number ? "number" : "wide") : "wide";
      this.addGraphic(gr.placement, layout, 0, 0);
      const sporty = g.kind === "tank" || g.kind === "jersey" || g.kind === "dress";
      if (gr.number && sporty) this.addGraphic("back", "number", 0, 0);
      if (gr.number && gr.placement === "chest") this.addGraphic("frontNumber", "number", 0, 0);
    }
    const accent = g.spec.colors.trim ?? "#ffffff";
    if (g.kind === "hoodie") this.addDetail("kangaroo", accent);
    if (g.kind === "jersey") this.addDetail("placketButtons", accent, undefined, { aspect: 6, count: 4 });
    if (g.kind === "shirt") {
      const plaid = g.spec.pattern === "plaid";
      // estampada: a vista deixa o xadrez aparecer; botões na cor de acabamento (flanela: pretos)
      const strip: DetailKind = plaid ? "placketLine" : "placketButtons";
      const button = plaid ? g.spec.colors.trim ?? "#1c1c1c" : undefined;
      if (m.open) {
        // frente aberta: vista com botões na direita do corpo, casas na esquerda
        this.addDetail(strip, "rgba(0,0,0,0.3)", 0, { button, aspect: 18, count: 7 });
        this.addDetail("buttonholes", "rgba(0,0,0,0.3)", 1, { aspect: 18, count: 7 });
      } else this.addDetail(strip, plaid ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.12)", undefined, { button, aspect: 12.5, count: 7 });
      if (plaid) {
        // flanela: dois bolsos com aba no peito
        const btn = g.spec.colors.trim ?? shade(g.spec.colors.secondary ?? g.spec.colors.base, -0.2);
        this.addDetail("flapPocketLine", btn, 0);
        this.addDetail("flapPocketLine", btn, 1);
      } else this.addDetail("shirtPocket", accent);
    }
    if (g.kind === "zipHoodie") {
      this.addDetail("splitPockets", accent);
      this.addDetail("zipFull", accent);
    }
    if (g.kind === "workJacket") {
      // vista com botões de metal envelhecido
      this.addDetail("placketButtons", "rgba(0,0,0,0.2)", undefined, { button: "#a2957a", aspect: 9.5, count: 5 });
      const thread = shade(g.spec.colors.base, luminance(g.spec.colors.base) < 0.35 ? 0.35 : -0.35);
      for (let i = 0; i < 4; i++) this.addDetail("patchPocket", thread, i);
    }
    if (g.kind === "varsityJacket") this.addDetail("snaps", accent);
    if (g.kind === "windbreaker") this.addDetail("zipper", accent);
    if (g.kind === "blazer") this.addDetail("blazerFront", accent);
  }

  private buildPants() {
    const g = this.g;
    this.main = new TrunkShell(10, this.matBase, this.group, "pelvis", true, true);
    this.shells.push(this.main);
    for (let k = 0; k < 2; k++) this.legs.push(this.limb(LEG_SEGS, 16, this.matBase, `leg${k}`));
    const wbMat = g.kind === "jeans" || g.kind === "trousers" || g.kind === "wideTrousers" ? this.matBase : g.kind === "meshShorts" ? this.matTrim : this.matBase;
    this.waistband = this.shell(3, wbMat, "waistband");
    if (this.cyl) this.main.cylR = (g.row.hipCm ?? 100) / TAU;
    const accent = g.spec.colors.trim ?? "#ffffff";
    if (CARGO.includes(g.kind)) {
      const thread = shade(g.spec.colors.base, luminance(g.spec.colors.base) < 0.35 ? 0.3 : -0.3);
      this.addDetail("cargoFront", thread);
      this.addDetail("flapPocket", shade(g.spec.colors.base, -0.3), 0);
      this.addDetail("flapPocket", shade(g.spec.colors.base, -0.3), 1);
      this.addDetail("cargoPocket", thread, 0);
      this.addDetail("cargoPocket", thread, 1);
    }
    if (g.kind === "jeans") {
      this.addDetail("jeansFront", accent);
      this.addDetail("jeansBack", accent);
    }
    if (g.kind === "trousers" || g.kind === "wideTrousers") this.addDetail("pleats", accent);
    if (g.kind === "sweatpants" || g.kind === "shorts" || g.kind === "meshShorts") this.addDetail("drawstring", g.kind === "meshShorts" ? accent : shade(g.spec.colors.base, -0.15));
    if (g.kind === "meshShorts") {
      this.addDetail("sideStripe", g.spec.colors.secondary ?? "#d7261e", 0);
      this.addDetail("sideStripe", g.spec.colors.secondary ?? "#d7261e", 1);
    }
    const gr = g.spec.graphic;
    if (gr) this.addGraphic("leg", g.kind === "sweatpants" ? "vertical" : gr.text.length <= 2 ? "badge" : "wide", 0, 0, 0);
  }

  private buildSkirt() {
    const g = this.g;
    this.main = this.shell(16, this.matBase, "skirt");
    if (g.kind === "miniSkirt") {
      const belt = beltTexture(g.spec.colors.secondary ?? "#151515");
      belt.texture.repeat.set(1 / belt.tileCm, 1 / 3.2);
      this.texs.push(belt.texture);
      this.waistband = this.shell(3, this.track(plainMaterial("#ffffff", this.rim, 0.5, 0.1)), "belt");
      (this.waistband.mesh.material as unknown as { map: Texture }).map = belt.texture;
    } else this.waistband = this.shell(3, this.matBase, "waistband");
  }

  private shell(rows: number, mat: Material, name: string) {
    const s = new TrunkShell(rows, mat, this.group, name, true, false, this.g.spec.pattern === "satin" && (mat === this.matBase || mat === this.matSecondary));
    this.shells.push(s);
    return s;
  }

  private limb(segs: number, rows: number, mat: Material, name: string, capStart = false) {
    const l = new LimbShell(segs, rows, mat, this.group, name, capStart);
    this.limbs.push(l);
    return l;
  }

  private ribbon(n: number, mat: Material, name: string) {
    const r = new Ribbon(n, mat, this.group, name);
    this.ribbons.push(r);
    return r;
  }

  /** Fração central da estampa recortada para o zíper (moletom com zíper), 0 = inteira. */
  private zipGap(place: string) {
    return this.g.kind === "zipHoodie" && (place === "chest" || place === "center") ? 0.06 : 0;
  }

  private addGraphic(place: string, layout: "wide" | "stack" | "number" | "badge" | "vertical", w: number, h: number, leg?: number) {
    const gr = this.g.spec.graphic!;
    const t = graphicTexture(gr, layout, this.g.spec.colors.base, this.zipGap(place));
    this.texs.push(t);
    const mat = this.track(decalMaterial(t, this.rim, gr.style === "varsity" && place === "leftChest" ? 0.95 : 0.6));
    const d = place === "leg" ? new LimbDecal(mat, this.group, `gfx-${place}`, 8, layout === "vertical" ? 10 : 4) : new TrunkDecal(mat, this.group, `gfx-${place}`, 12, layout === "stack" || layout === "number" || layout === "badge" ? 10 : 5);
    this.decals.push(d);
    this.gfx.push({ d, place, layout, w, h, leg });
  }

  private addDetail(kind: DetailKind, accent: string, leg?: number, opts?: DetailOpts) {
    const t = detailTexture(kind, this.g.spec.colors.base, accent, opts);
    this.texs.push(t);
    const mat = this.track(decalMaterial(t, this.rim, 0.75));
    const d =
      kind === "sideStripe"
        ? new LimbDecal(mat, this.group, `det-${kind}`, 2, 10)
        : kind === "cargoPocket"
          ? new LimbDecal(mat, this.group, `det-${kind}`, 6, 6)
          : new TrunkDecal(mat, this.group, `det-${kind}`, STRIP_DETAILS.has(kind) ? 2 : 10, STRIP_DETAILS.has(kind) ? 14 : 8);
    this.decals.push(d);
    this.details.push({ d, kind, leg });
  }

  /** Recria as texturas de texto depois que as fontes carregam. */
  refreshGraphics() {
    const gr = this.g.spec.graphic;
    if (!gr) return;
    for (const it of this.gfx) {
      const mat = it.d.mesh.material as unknown as { map: Texture | null; needsUpdate: boolean };
      const old = mat.map;
      const t = graphicTexture(gr, it.layout as "wide", this.g.spec.colors.base, this.zipGap(it.place));
      mat.map = t;
      mat.needsUpdate = true;
      this.texs.push(t);
      if (old) {
        old.dispose();
        this.texs = this.texs.filter((x) => x !== old);
      }
    }
  }

  /**
   * Calça/saia sob uma peça de cima: decalques (bolsos, braguilha) cobertos em mais da
   * metade pela barra de cima ficam ocultos — o polygonOffset dos decalques venceria a
   * pequena folga entre as camadas e eles "vazariam" através da camiseta.
   */
  coverDecals(coverY: (phi: number) => number) {
    for (const d of this.decals) {
      if (!(d instanceof TrunkDecal)) continue;
      d.mesh.visible = coverY(d.phiC) > (d.y0 + d.y1) / 2;
    }
  }

  /** Altura da barra desta peça de cima em φ (−∞ onde não cobre: abertura da frente). */
  hemAt(phi: number): number {
    // por dentro da calça (camisa social) não cobre nada
    if (!this.model || this.tuckedNow) return Infinity;
    if (this.model.open) {
      const d = Math.abs(Math.atan2(Math.sin(phi - FRONT), Math.cos(phi - FRONT)));
      if (d < this.gap(this.hemY) + 0.15) return Infinity;
    }
    return this.hemY;
  }

  /* ─────────── medidas da peça ─────────── */

  private chestC(s: Shape) {
    const r = this.g.row;
    return r.chestCm ?? s.chest + (this.model?.fit === "box" ? 22 : this.model?.fit === "slim" ? 0 : 12);
  }

  /** Espessura comprimida por altura (para a folga dos braços). */
  clearanceThick(y: number): number {
    if (!isTopLike(this.g.kind) || !this.model) return 0;
    if (y < this.hemY || y > this.topY + 4) return 0;
    return this.model.thick + (this.model.fit === "box" ? 0.6 : 0.25);
  }

  /** Raio da saia/vestido abaixo do quadril (para as mãos não atravessarem). */
  lowDrape(ctx: Ctx, y: number, phi: number): number {
    if (isSkirt(this.g.kind)) return y >= this.hemY && y <= this.topY ? this.skirtRadiusRaw(ctx, y, phi) : 0;
    if (this.model?.dress && y >= this.hemY && y < ctx.s.hipY) return this.topRadiusRaw(ctx, y, phi);
    return 0;
  }

  /** Raio externo estimado da manga em t (para a folga dos braços). */
  sleeveOuter(s: Shape, t: number): number {
    if (!this.model || this.model.sleeve === "none" || t > this.sleeveEndT) return 0;
    const sec = armSection(s, t);
    const body = (sec.W + (sec.F + sec.B) / 2) / 2;
    return body + this.model.thick + 0.5;
  }

  /* ─────────── fase: partes de baixo (e camisa por dentro) ─────────── */

  updateBottom(ctx: Ctx) {
    if (isPants(this.g.kind)) this.updatePants(ctx);
    else if (isSkirt(this.g.kind)) this.updateSkirt(ctx);
  }

  /* ─────────── fase: tronco (tops, vestidos, sobreposições) ─────────── */

  /** Prepara alturas (barra, topo) sem gerar geometria — usado antes do cálculo dos braços. */
  private tuckedNow = false;

  prepare(ctx: Ctx) {
    const { s } = ctx;
    const g = this.g;
    this.tuckedNow = ctx.tucked;
    if (isTopLike(g.kind)) {
      const m = this.model!;
      const len = g.row.lengthCm ?? m.defaultLen;
      this.hemY = ctx.tucked ? this.waistbandY(ctx) - 7 : ctx.hpsY - len;
      this.topY = s.neckBaseY + 5;
      const sleeveLen = g.row.sleeveCm ?? m.defaultSleeve;
      this.sleeveEndT = m.sleeve === "none" ? -1 : this.sleeveT(ctx, sleeveLen);
      const C = this.chestC(s);
      this.buildAxes(ctx);
      const top = C * (m.fit === "box" ? 0.45 : m.fit === "regular" ? 0.42 : 0.36);
      const wristC = armSection(s, 2).C;
      const end = m.sleeve === "long" ? (m.cuff === "rib" || m.cuff === "band" ? wristC + 5 : top * 0.62) : top * 0.86;
      this.sleeveC = [top, m.sleeve === "long" ? top * 0.78 : top * 0.92, end];
    } else if (isSkirt(g.kind)) {
      const wb = g.kind === "miniSkirt" ? s.waistY - 7 : s.waistY + 0.5;
      this.topY = wb;
      this.hemY = wb - (g.row.lengthCm ?? 50);
    } else if (isPants(g.kind)) {
      this.topY = this.waistbandY(ctx);
      this.hemY = s.crotchY - (g.row.inseamCm ?? 70);
    }
  }

  private waistbandY(ctx: Ctx) {
    const s = ctx.s;
    switch (this.g.kind) {
      case "jeans":
        return s.waistY - 3;
      case "trousers":
        return s.waistY + 1.5;
      case "wideTrousers":
        return s.waistY + 2.5;
      case "bikeShorts":
        return s.waistY - 0.5;
      case "sweatpants":
        return s.waistY - 1.5;
      case "cargoPants":
      case "cargoShorts":
        return s.waistY - 2.5;
      default:
        return s.waistY - 2;
    }
  }

  private sleeveT(ctx: Ctx, len: number) {
    const arm = ctx.rig.arms[0];
    const m = this.model!;
    const drop = m.fit === "box" ? clamp((this.chestC(ctx.s) - ctx.s.chest - 10) * 0.25, 0, 7) : 0;
    const d = len + drop - 0.12 * arm.upperL;
    return d <= arm.upperL ? d / arm.upperL : Math.min(2.45, 1 + (d - arm.upperL) / arm.foreL);
  }

  private sleeveCirc(t: number) {
    const [a, b, c] = this.sleeveC;
    const e = Math.max(0.3, this.sleeveEndT);
    if (this.model?.sleeve !== "long") return lerp(a, c, clamp((t + 0.1) / (e + 0.1), 0, 1));
    if (t < 1) return lerp(a, b, clamp(t, 0, 1));
    // leve "blusê" antes do punho
    const u = clamp((t - 1) / (e - 1), 0, 1);
    return lerp(b, c, Math.pow(u, 2.2));
  }

  /** Raio da casca do top sem a ocupação (só caimento) — para pré-cálculos. */
  private topRadiusRaw(ctx: Ctx, y: number, phi: number) {
    const s = ctx.s;
    const ax = this.axes(ctx, y);
    let zc = this.zc(ctx, y);
    // o tecido pende do ápice do busto até a cintura (não "entra" sob o peito)
    if (y < s.chestY && y > s.waistY - 12) zc = Math.max(zc, lerp(this.zc(ctx, s.chestY), zc, smoothstep(s.chestY, s.waistY - 12, y)));
    let xc = 0;
    if (this.model?.dress && y < s.crotchY + 2) {
      // vestido acompanha o centro entre as pernas
      const [mu, mw] = ctx.field.legMid(y);
      const k = smoothstep(s.crotchY + 2, s.crotchY - 18, y);
      xc = mu * k;
      zc = lerp(zc, mw, k);
    }
    return offsetEllipseR2(phi, ax[0], ax[1], xc, zc) + this.fold(ctx, y, phi);
  }

  private axesCache = { y0: 0, keys: [] as [number, number, number][] };

  /** Semieixos (a, b) da elipse de caimento em função da altura. */
  private axes(ctx: Ctx, y: number): [number, number] {
    const keys = this.axesCache.keys;
    if (y <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 0; i < keys.length - 1; i++) {
      if (y <= keys[i + 1][0]) {
        const u = (y - keys[i][0]) / (keys[i + 1][0] - keys[i][0] || 1);
        return [lerp(keys[i][1], keys[i + 1][1], u), lerp(keys[i][2], keys[i + 1][2], u)];
      }
    }
    const k = keys[keys.length - 1];
    return [k[1], k[2]];
  }

  private zc(ctx: Ctx, y: number) {
    const f = ctx.field;
    return ((f.bodyR(y, FRONT) - f.bodyR(y, BACK)) / 2) * 0.75;
  }

  private looseness = 0;

  private fold(ctx: Ctx, y: number, phi: number) {
    const m = this.model;
    if (!m || !m.folds) return 0;
    const s = ctx.s;
    const amp = 0.6 * m.folds * this.looseness * smoothstep(s.waistY + 4, this.hemY, y);
    return amp * (0.65 * Math.sin(7 * phi + 0.7) + 0.35 * Math.sin(11 * phi + 2.1));
  }

  private buildAxes(ctx: Ctx) {
    const { s, field } = ctx;
    const m = this.model!;
    const C = this.chestC(s);
    const k = m.aspect;
    const aC = C / ellipseFactor(k);
    const shW = field.stations[field.stations.length - 3].W;
    const ease = C - s.chest;
    const drop = m.fit === "box" ? clamp(ease * 0.1, 0, 5) : 0;
    const aSh = Math.max(shW + m.thick + 0.5, Math.min(aC * 0.95, shW + drop + m.shoulderPad + m.thick));
    const neckR = s.neckC / TAU;
    const hang = m.fit === "box" ? [0.955, 0.965] : [0.94, 0.96];
    const keys: [number, number, number][] = [];
    if (m.dress) {
      const hipC = this.g.row.hipCm ?? C;
      const aHip = Math.max(aC * 0.98, hipC / ellipseFactor(0.7));
      const flare = m.dress === "bias" ? 1.08 : 1.04;
      keys.push([this.hemY, aHip * flare, aHip * flare * 0.72]);
      keys.push([s.crotchY, aHip, aHip * 0.7]);
      keys.push([s.hipY, aHip, aHip * 0.68]);
    } else {
      keys.push([this.hemY, aC * hang[1], aC * k * 0.985]);
    }
    // a largura afina na cintura, mas a frente continua pendendo do peito (sem vinco sob o busto)
    keys.push([s.waistY, aC * hang[0], aC * k * 0.985]);
    keys.push([s.chestY, aC, aC * k]);
    keys.push([ctx.armpitY, aC * 0.98, aC * 0.98 * k]);
    keys.push([s.shoulderY - 1, aSh, aSh * 0.52]);
    keys.push([s.neckBaseY + 3, neckR + 2, neckR + 2]);
    keys.sort((a, b) => a[0] - b[0]);
    this.axesCache.keys = keys;
    this.looseness = clamp(ease / 26, 0, 1.4);
  }

  private slimScale(ctx: Ctx, y: number) {
    // tops justos acompanham o corpo com o perímetro da peça
    const C = this.chestC(ctx.s);
    const k = C / Math.max(1, ctx.s.chest);
    const hipC = this.g.row.hipCm;
    const waistC = this.g.row.waistCm;
    const s = ctx.s;
    if (this.model?.dress === "bias" && hipC) {
      const kw = waistC ? waistC / s.waist : k;
      const kh = hipC / s.hip;
      if (y >= s.chestY) return k;
      if (y >= s.waistY) return lerp(kw, k, (y - s.waistY) / (s.chestY - s.waistY));
      if (y >= s.hipY) return lerp(kh, kw, (y - s.hipY) / (s.waistY - s.hipY));
      return kh * (1 + 0.07 * smoothstep(s.hipY, this.hemY, y));
    }
    return k;
  }

  updateTrunk(ctx: Ctx) {
    if (!isTopLike(this.g.kind) || !this.model) return;
    const { s, field } = ctx;
    const m = this.model;
    const g = this.g;
    this.buildAxes(ctx);
    const nb = s.neckBaseY;
    const top = this.neckBoundary(ctx);
    const hemCurve = m.curvedHem;
    const raw = m.hemBand === "raw";
    const hem = (phi: number) => this.hemY + (ctx.tucked ? 0 : hemCurve * Math.pow(Math.abs(Math.cos(phi)), 2)) + (raw ? (hash(Math.round(phi * 10)) - 0.5) * 0.8 : 0);
    const wb = this.waistbandY(ctx);
    const thick = m.thick;
    const chestY = s.chestY;
    const ubY = s.chestY - 9;
    const tautTop = s.neckBaseY - 3;
    field.computeTaut(this.hemY - 10, tautTop + 1);
    const radius = (y: number, phi: number) => {
      let base = y > tautTop ? field.occR(y, phi) : m.dress && y < s.crotchY + 4 ? field.tautSmooth(y, phi) : field.tautR(y, phi);
      const front = smoothstep(0.05, 0.6, Math.sin(phi));
      if (y < chestY && y > s.waistY && front > 0) {
        // a malha "pende" do ápice do busto até abaixo dele (suave nas laterais)
        const apex = field.tautR(chestY, phi) * (1 - (0.02 * (chestY - y)) / 9);
        const hang = lerp(apex, base, smoothstep(ubY + 2, s.waistY + 1, y));
        base = Math.max(base, lerp(base, hang, front));
      }
      const minR = base + thick;
      let r: number;
      if (m.fit === "slim" && !(m.dress === "box")) r = Math.max(minR, base * this.slimScale(ctx, y) + (m.dress === "bias" ? this.fold(ctx, y, phi) * 0.5 : 0));
      else r = smax(minR, this.topRadiusRaw(ctx, y, phi), 2.2);
      if (ctx.tucked && y < wb + 7) r = lerp(r, minR + 0.5, smoothstep(wb + 7, wb + 1, y));
      const lim = ctx.armLimit(y, phi);
      if (r > lim - 2.5) r = Math.max(minR, smin(r, lim, 2.5));
      return r;
    };
    // linhas: densas no ombro
    const yb = this.hemY - hemCurve;
    const ys: number[] = [];
    const nLow = m.dress ? 18 : 12;
    const nHigh = this.main!.grid.rows - nLow;
    for (let i = 0; i < nLow; i++) ys.push(lerp(yb, s.chestY, i / nLow));
    for (let i = 0; i < nHigh; i++) ys.push(lerp(s.chestY, nb + 6, Math.pow(i / (nHigh - 1), 0.8)));
    const bounds = (phi: number) => [hem(phi), top(phi)] as const;
    if (this.cyl) this.main!.cylR = this.chestC(s) / TAU;
    if (m.open) {
      // meia abertura: estreita no colarinho, abre em direção à barra
      const g0 = 0.2, g1 = 0.52;
      const yTopGap = nb + 2;
      const yHem = this.hemY;
      this.gap = (y: number) => lerp(g1, g0, smoothstep(yHem, yTopGap, y));
      this.main!.updateOpen(field, ys, bounds, radius, this.gap);
    } else this.main!.update(field, clampedRows(ys, bounds), radius);
    this.topY = nb + 5;

    if (this.yoke) {
      const yy = s.chestY + 3;
      this.yoke.update(field, spanRows(8, (phi) => [yy, Math.max(yy, top(phi))]), (y, phi) => field.occR(y, phi) + 0.22, false);
    }

    // gola / debrum / capuz
    if (this.collar) {
      const h = m.collar === "rib" ? 2.2 : m.collar === "piping" ? 1.4 : m.collar === "stand" ? 4.2 : m.collar === "shirt" ? 4.5 : 2.6;
      if (m.collar === "piping") {
        this.collar.update(field, spanRows(3, (phi) => [top(phi) - h, top(phi) + 0.1]), (y, phi) => field.occR(y, phi) + 0.22);
      } else if (m.collar === "shirt") {
        // pé de gola + pontas que descem no peito, abertas no centro
        // aberta: as pontas se afastam e deitam sobre o peito (gola "esporte")
        const dOpen = m.open ? this.gap(nb) + 0.03 : 0.12;
        const spread = m.open ? 1.6 : 0;
        const bound = (phi: number) => {
          const d = Math.abs(Math.atan2(Math.sin(phi - FRONT), Math.cos(phi - FRONT)));
          const open = d < dOpen;
          const yt = top(phi) + 3.8 - (m.open ? 1.2 * smoothstep(0.9, dOpen, d) : 0);
          const ybb = open ? yt : d < 0.75 + dOpen ? top(phi) - (5 + spread) * (1 - (d - dOpen) / 0.75) - 0.5 : top(phi) - 0.3;
          return [ybb, yt] as const;
        };
        this.collar.update(field, spanRows(4, bound), (y, phi) => {
          const d = Math.abs(Math.atan2(Math.sin(phi - FRONT), Math.cos(phi - FRONT)));
          return d < dOpen ? field.occR(y, phi) - 0.3 : field.occR(y, phi) + 0.6 + (0.3 + spread * 0.35) * smoothstep(top(phi) + 2, top(phi) - 3, y);
        });
      } else if (m.collar === "work") {
        // gola de jaqueta: pé baixo + "queda" larga deitada sobre ombros e costas; pontas no peito
        const dOpen = 0.1;
        const bound = (phi: number) => {
          const d = Math.abs(Math.atan2(Math.sin(phi - FRONT), Math.cos(phi - FRONT)));
          const t0 = top(phi);
          if (d < dOpen) return [t0 + 1.2, t0 + 1.2] as const;
          const pts = smoothstep(0.95, 0.3, d);
          const fall = lerp(5.4, 9.5, pts) * smoothstep(dOpen, dOpen + 0.08, d);
          return [t0 + 2.4 - fall, t0 + 2.4 - 0.6 * pts] as const;
        };
        this.collar.update(field, spanRows(5, bound), (y, phi) => {
          const t0 = top(phi);
          return field.occR(y, phi) + 0.55 + 0.75 * smoothstep(t0 + 1.5, t0 - 4.5, y);
        });
      } else if (m.collar === "hood") {
        this.collar.update(field, spanRows(3, (phi) => [top(phi) - 0.5, top(phi) + 2]), (y, phi) => field.occR(y, phi) + 0.9);
      } else {
        this.collar.update(field, spanRows(3, (phi) => [top(phi) - 0.5, top(phi) + h]), (y, phi) => field.occR(y, phi) + (m.collar === "stand" ? 0.5 : 0.35));
      }
    }
    if (this.hood) {
      // capuz baixado: "bolsa" nas costas
      const yb2 = nb - 13, yt2 = nb + 6;
      this.hood.update(
        field,
        spanRows(6, () => [yb2, yt2]),
        (y, phi) => {
          const w = angBump(phi, BACK, 0.75);
          const u = (y - yb2) / (yt2 - yb2);
          const bulge = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 4.2 * w;
          return w < 0.12 ? field.occR(y, phi) - 0.4 : field.occR(y, phi) + 0.3 + bulge;
        },
      );
    }
    if (this.lapel) {
      const btn = s.waistY - 2;
      const dV = 0.62;
      const V = (d: number) => btn + (d / dV) * (nb + 3 - btn);
      this.lapel.update(
        field,
        spanRows(4, (phi) => {
          const d = Math.abs(Math.atan2(Math.sin(phi - FRONT), Math.cos(phi - FRONT)));
          if (d < 0.05) return [btn, btn];
          if (d < dV + 0.2) return [Math.max(btn - 0.5, V(Math.min(d, dV)) - (3 + 8 * Math.min(1, d / dV))), V(Math.min(d, dV)) + 0.3];
          return [nb + 1, nb + 5.5];
        }),
        (y, phi) => {
          const d = Math.abs(Math.atan2(Math.sin(phi - FRONT), Math.cos(phi - FRONT)));
          return d < 0.05 ? field.occR(y, phi) - 0.5 : field.occR(y, phi) + 0.45;
        },
      );
    }
    if (this.hemBand) {
      const hb = m.hemBand === "elastic" && g.kind === "sportsBra" ? 3.5 : 5;
      this.hemBand.update(field, spanRows(3, (phi) => [hem(phi) - 0.2, hem(phi) + hb]), (y, phi) => {
        const r0 = field.occR(y, phi);
        return r0 + 0.3;
      });
    }

    // alças
    if (m.straps) this.updateStraps(ctx, top);
    if (this.cords.length) {
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? 1 : -1;
        const p0 = FRONT - side * 0.2;
        this.cords[k].updateOnTrunk(field, [[nb + 1.5, p0, 0.2], [nb - 6, p0 - side * 0.02, 0.6], [nb - 15 - k * 2, p0 - side * 0.05, 0.4]], 0.7, 0.5, 0.2);
      }
    }

    // decalques do tronco
    for (const d of this.details) this.placeDetail(ctx, d);
    for (const gfx of this.gfx) this.placeGraphic(ctx, gfx);
  }

  private neckBoundary(ctx: Ctx): (phi: number) => number {
    const s = ctx.s;
    const nb = s.neckBaseY;
    const m = this.model!;
    const shY = s.shoulderY;
    const ap = ctx.armpitY;
    switch (m.neck) {
      case "vneck":
        return boundary([[90, nb - 7], [70, nb - 1], [110, nb - 1], [45, nb + 2.5], [135, nb + 2.5], [0, nb + 4.2], [180, nb + 4.2], [270, nb + 3.2], [225, nb + 3.8], [315, nb + 3.8]]);
      case "scoop": {
        const deep = m.armhole === "deep";
        const arm = deep ? s.chestY + 0.5 : ap - 2.5;
        const f = nb - (deep ? 11 : 9);
        return boundary([[90, f], [72, f + 1.2], [108, f + 1.2], [52, shY - 1], [128, shY - 1], [0, arm], [180, arm], [308, shY - 1], [232, shY - 1], [288, nb - 5.2], [252, nb - 5.2], [270, nb - 6]]);
      }
      case "thin":
        return boundary([[90, s.chestY + 5], [62, ap + 1], [118, ap + 1], [0, ap - 2], [180, ap - 2], [298, ap + 1], [242, ap + 1], [270, s.chestY + 3]]);
      case "bra":
        return boundary([[90, s.chestY + 6], [58, ap + 2.5], [122, ap + 2.5], [0, ap - 1], [180, ap - 1], [300, ap + 3], [240, ap + 3], [270, ap + 1]]);
      case "slip":
        return boundary([[90, s.chestY + 5.5], [45, s.chestY + 6.5], [135, s.chestY + 6.5], [0, s.chestY + 6], [180, s.chestY + 6], [270, s.chestY + 1.5]]);
      case "blazer": {
        const btn = s.waistY - 2;
        const dV = 0.62;
        return (phi: number) => {
          const d = Math.abs(Math.atan2(Math.sin(phi - FRONT), Math.cos(phi - FRONT)));
          if (d < dV) return btn + (d / dV) * (nb + 3 - btn);
          return lerp(nb + 3, nb + 4.6, smoothstep(dV, dV + 0.6, d));
        };
      }
      case "stand":
        return boundary([[90, nb + 1.2], [0, nb + 4.6], [180, nb + 4.6], [270, nb + 4]]);
      case "shirt":
        return boundary([[90, nb + 0.4], [45, nb + 2.8], [135, nb + 2.8], [0, nb + 4.4], [180, nb + 4.4], [270, nb + 3.6]]);
      case "work":
        // decote em V raso (último botão aberto): mostra a gola da peça de baixo
        return boundary([[90, nb - 6.5], [74, nb - 3.4], [106, nb - 3.4], [50, nb + 1], [130, nb + 1], [0, nb + 4.2], [180, nb + 4.2], [270, nb + 3.4], [225, nb + 3.9], [315, nb + 3.9]]);
      default:
        return boundary([[90, nb + 0.8], [45, nb + 2.6], [135, nb + 2.6], [0, nb + 4.2], [180, nb + 4.2], [270, nb + 3.2], [225, nb + 3.8], [315, nb + 3.8]]);
    }
  }

  private updateStraps(ctx: Ctx, top: (phi: number) => number) {
    const m = this.model!;
    const st = m.straps!;
    const s = ctx.s;
    const nb = s.neckBaseY;
    const D = Math.PI / 180;
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? 1 : -1;
      // ângulos relativos ao lado (0° = lateral): frente +, costas −; espelhado no lado direito
      const ff = m.neck === "scoop" ? 52 : m.neck === "thin" ? 62 : m.neck === "bra" ? 58 : 45;
      const fb = m.neck === "scoop" ? 52 : m.neck === "thin" ? 62 : m.neck === "bra" ? 60 : 60;
      const pTop = side === 1 ? 0 : Math.PI;
      const pf = pTop + side * ff * D;
      const pb = pTop - side * fb * D;
      const yf = top(pf), ybk = top(pb);
      const crest = nb + 1.4 * st.front;
      const ctrl: [number, number][] = [
        [yf - 1.5, pf],
        [lerp(yf, crest, 0.55), lerp(pf, pTop + side * 0.36, 0.6)],
        [crest, pTop + side * 0.08],
        [crest - 0.3, pTop - side * 0.28],
        [lerp(ybk, crest, 0.5), lerp(pb, pTop - side * 0.42, 0.5)],
        [ybk - 1.5, pb],
      ];
      this.straps[k].update(ctx.field, ctrl, st.width, m.thick + 0.12);
    }
  }

  private placeDetail(ctx: Ctx, it: { d: TrunkDecal | LimbDecal; kind: DetailKind; leg?: number }) {
    const { s, field } = ctx;
    const nb = s.neckBaseY;
    if (it.d instanceof LimbDecal) return;
    const d = it.d;
    const k = this.g.kind;
    const side = it.leg === 1 ? -1 : 1;
    switch (it.kind) {
      case "kangaroo":
        d.update(field, FRONT, this.hemY + 13, 32, 19, 0.16);
        break;
      case "splitPockets":
        d.update(field, FRONT, this.hemY + 13, 36, 19, 0.16);
        break;
      case "zipFull": {
        const topY = nb + 2.4;
        const bot = this.hemY + 0.5;
        d.update(field, FRONT, (topY + bot) / 2, 5, topY - bot, 0.24);
        break;
      }
      case "placketButtons":
      case "placketLine":
      case "buttonholes": {
        if (this.model?.open) {
          // vista sobre a borda de cada frente (o centro acompanha a abertura)
          const topY = nb + 1;
          const bot = this.hemY + 0.6;
          const w = 3.4;
          const sg = it.kind === "buttonholes" ? -1 : 1;
          d.update(field, FRONT + sg * this.gap(nb), (topY + bot) / 2, w, topY - bot, 0.16, 0, (y) => {
            const r = Math.max(4, field.occR(y, FRONT + sg * (this.gap(y) + 0.1)));
            return FRONT + sg * (this.gap(y) + (w / 2 + 0.3) / r);
          });
          break;
        }
        const topY = k === "jersey" ? nb - 7.5 : k === "workJacket" ? nb - 7.2 : nb - 0.5;
        const bot = this.hemY + 1;
        d.update(field, FRONT, (topY + bot) / 2, 4.2, topY - bot, 0.13);
        break;
      }
      case "shirtPocket":
        d.update(field, FRONT - 0.42, s.chestY + 1, 10, 12, 0.18);
        break;
      case "flapPocket":
      case "flapPocketLine":
        if (isPants(k)) d.update(field, BACK + side * 0.42, this.topY - 11, 13, 14, 0.14);
        else d.update(field, FRONT + side * (this.model?.open ? 0.62 : 0.5), s.chestY + 1.5, 11, 13, 0.18);
        break;
      case "patchPocket": {
        const chest = (it.leg ?? 0) < 2;
        const sd = (it.leg ?? 0) % 2 === 0 ? 1 : -1;
        if (chest) d.update(field, FRONT + sd * 0.56, s.chestY + 1, 12, 13.5, 0.2);
        else d.update(field, FRONT + sd * 0.64, this.hemY + 12, 16.5, 17, 0.2);
        break;
      }
      case "cargoFront":
        d.update(field, FRONT, this.topY - 9.5, 36, 19, 0.13);
        break;
      case "snaps":
      case "zipper": {
        const topY = nb + (it.kind === "zipper" ? 4 : 0);
        const bot = this.hemY + (it.kind === "snaps" ? 5 : 1);
        d.update(field, FRONT, (topY + bot) / 2, 3.2, topY - bot, 0.2);
        break;
      }
      case "blazerFront": {
        const btn = s.waistY - 2;
        const bot = this.hemY + 1;
        const topY = btn + 1.5;
        d.update(field, FRONT, (topY + bot) / 2, 46, topY - bot, 0.15);
        break;
      }
      case "jeansFront":
        d.update(field, FRONT, this.topY - 10, 34, 18, 0.12);
        break;
      case "jeansBack":
        d.update(field, BACK, this.topY - 12, 30, 18, 0.12);
        break;
      case "pleats":
        d.update(field, FRONT, this.topY - 12, 34, 22, 0.1);
        break;
      case "drawstring":
        d.update(field, FRONT, this.topY - 6, 7, 13, 0.25);
        break;
      case "grommets":
        break;
    }
  }

  private placeGraphic(ctx: Ctx, it: { d: TrunkDecal | LimbDecal; place: string; layout: string; leg?: number }) {
    const { s, field } = ctx;
    const gr = this.g.spec.graphic!;
    if (it.d instanceof LimbDecal) return;
    const d = it.d;
    const k = this.g.kind;
    switch (it.place) {
      case "center":
        if (it.layout === "stack") d.update(field, FRONT, s.chestY - (this.model?.armhole === "deep" ? 8 : 5), 27, 27, 0.15);
        else d.update(field, FRONT, s.chestY - 2, 28, 10.5, 0.15);
        break;
      case "chest": {
        const w = k === "babyTee" ? 19 : gr.style === "gothic" ? 26 : 27;
        d.update(field, FRONT, s.chestY + (k === "babyTee" ? 2.5 : 3.5), w, (w * 384) / 1024, 0.15, gr.style === "script" ? 0 : 0);
        break;
      }
      case "leftChest":
        // jaqueta workwear: monograma bordado sobre o bolso do peito esquerdo
        if (k === "workJacket") d.update(field, FRONT - 0.56, s.chestY + 2.5, it.layout === "badge" ? 5 : 9, it.layout === "badge" ? 5 : 3.4, 0.26);
        else if (it.layout === "badge") d.update(field, FRONT - 0.48, s.chestY + 4, k === "varsityJacket" ? 11 : 6.5, k === "varsityJacket" ? 11 : 6.5, 0.2);
        else d.update(field, FRONT - 0.48, s.chestY + 5, 10, 3.75, 0.2);
        break;
      case "back":
        d.update(field, BACK, s.chestY - 6, 26, 26, 0.15);
        break;
      case "frontNumber":
        d.update(field, FRONT - 0.5, s.waistY + 4, 8, 8, 0.15);
        break;
    }
  }

  /* ─────────── mangas ─────────── */

  updateSleeves(ctx: Ctx) {
    if (!this.model || this.model.sleeve === "none" || !this.sleeves.length) return;
    const m = this.model;
    const { s, rig } = ctx;
    const tEnd = this.sleeveEndT;
    // começa acima da articulação (dentro da casca do tronco): o deltoide não aparece entre manga e ombro
    const tStart = -0.21;
    const ts: number[] = [];
    const n = this.sleeves[0].grid.rows;
    for (let i = 0; i < n; i++) ts.push(lerp(tStart, tEnd, Math.pow(i / (n - 1), 0.9)));
    for (let k = 0; k < 2; k++) {
      const arm = rig.arms[k];
      const path = ctx.body.armPaths[k];
      const field = ctx.armF[k];
      const loose = this.looseness;
      const open = m.sleeve === "long" ? (t: number) => smoothstep(-0.05, 0.55, t) : (t: number) => smoothstep(-0.08, tEnd * 0.95, t);
      // janela de meia linha: a manga de fora passa por cima do punho/barra estreita da de dentro
      const win = (0.5 * (tEnd - tStart)) / (n - 1);
      const radius = (t: number, phi: number) => {
        const base = Math.max(field.occR(t, phi), field.occR(t - win, phi), field.occR(t + win, phi));
        const fold = m.sleeve === "long" ? 0.35 * loose * Math.sin(5 * phi + t * 3) * smoothstep(0.8, 1.6, t) : 0.3 * loose * Math.sin(6 * phi) * open(t);
        // no topo a manga abraça o deltoide (sai de dentro da casca); abre em direção à barra
        const hug = field.maxR(t) + m.thick + 0.5;
        const R = lerp(hug, Math.max(hug, this.sleeveCirc(t) / TAU), open(t));
        // cabeça da manga: acima do deltoide a manga se fecha para dentro do ombro (sem borda aberta)
        const cap = smoothstep(tStart, tStart + 0.13, t);
        return Math.max((base + m.thick) * lerp(0.85, 1, cap), lerp(0.85 * hug, R, cap) + fold * cap);
      };
      const top = this.sleevesTop[k];
      this.sleeves[k].update(path, arm.front, top ? null : field, ts, () => [tStart, tEnd], radius);
      if (top) {
        const tt: number[] = [];
        for (let i = 0; i < 5; i++) tt.push(lerp(tStart, 0.55, i / 4));
        top.update(path, arm.front, null, tt, () => [tStart, 0.55], (t, phi) => radius(t, phi) + 0.05);
        // registra a ocupação depois das duas partes
        this.sleeves[k].update(path, arm.front, field, ts, () => [tStart, tEnd], radius);
      }
      const cuff = this.cuffs[k];
      if (cuff) {
        const len = m.cuff === "rib" ? 6.5 / arm.foreL : m.sleeve === "long" ? 5 / arm.foreL : 1.6 / arm.upperL;
        const t0 = tEnd - len;
        const tt = [t0, (t0 + tEnd) / 2, tEnd + 0.004];
        cuff.update(path, arm.front, field, tt, () => [t0, tEnd + 0.004], (t, phi) => {
          const r = field.occR(t, phi);
          return m.cuff === "rib" ? Math.max(armSection(s, Math.min(2, t)).C / TAU + 1.1, Math.min(r, armSection(s, Math.min(2, t)).C / TAU + 1.6)) + 0.25 : r + 0.22;
        });
      }
    }
  }

  /* ─────────── calças e bermudas ─────────── */

  private updatePants(ctx: Ctx) {
    const { s, field, rig } = ctx;
    const g = this.g;
    const k = g.kind;
    const row = g.row;
    const wb = this.waistbandY(ctx);
    this.topY = wb;
    const cargo = CARGO.includes(k);
    const thick = k === "jeans" || cargo ? 0.55 : k === "bikeShorts" ? 0.22 : 0.42;
    const elastic = k === "sweatpants" || k === "shorts" || k === "meshShorts" || k === "bikeShorts" || k === "baseShorts";
    const hipC = row.hipCm ?? s.hip + 10;
    const waistC = row.waistCm ?? s.waist;
    const slim = k === "bikeShorts";
    const aspect = 0.66;
    const aHip = hipC / ellipseFactor(aspect);
    const bodyWaistAtWb = s.waist + (s.hip - s.waist) * clamp((s.waistY - wb) / (s.waistY - s.hipY), 0, 1) * 0.6;
    const wbC = elastic ? Math.min(waistC, bodyWaistAtWb + 2) : Math.max(waistC, bodyWaistAtWb * 0.98);
    const aWb = wbC / ellipseFactor(0.7);
    // pernas
    const hemY = s.crotchY - (row.inseamCm ?? 20);
    this.hemY = hemY;
    const tHem = yToLegT(s, rig, hemY);
    const wide = g.spec.silhouette === "wide";
    // cargo: perna larga e reta (pouco afunilamento até a barra)
    const thighC = slim ? 0 : hipC * (wide ? 0.66 : cargo ? 0.63 : k === "trousers" ? 0.6 : 0.58);
    const kneeC = slim ? 0 : thighC * (wide ? 0.93 : cargo ? 0.86 : k === "trousers" ? 0.74 : 0.66);
    const hemC = slim ? 0 : tHem < 1 ? lerp(thighC, kneeC, tHem) * (wide ? 1.0 : 0.96) : kneeC * (wide ? 1.03 : cargo ? 0.95 : 0.9);
    // bolso lateral com fole: volume na lateral da coxa
    const pocketA = 0.42, pocketB = 0.92;
    const bulge = (t: number) => (cargo ? 1.15 * smoothstep(pocketA, pocketA + 0.06, t) * (1 - smoothstep(pocketB - 0.05, pocketB + 0.01, t)) : 0);
    const shinL = s.kneeY - s.ankleY;
    const crease = k === "trousers" || k === "wideTrousers" ? 0.55 : 0;
    const floorT = (phi: number) => {
      const w = (Math.sin(phi) + 1) / 2; // 1 na frente
      const y = lerp(ctx.hemFloor.back, ctx.hemFloor.front, w);
      return yToLegT(s, rig, y);
    };
    const tStart = -0.14;
    for (let leg = 0; leg < 2; leg++) {
      const L = rig.legs[leg];
      const path = ctx.body.legPaths[leg];
      const lf = ctx.legF[leg];
      const lat = L.side === 1 ? Math.PI : 0;
      const circ = (t: number) => (t <= 0.3 ? thighC : t <= 1 ? lerp(thighC, kneeC, (t - 0.3) / 0.7) : lerp(kneeC, hemC, clamp((t - 1) / Math.max(0.05, tHem - 1), 0, 1)));
      const bounds = (phi: number) => [tStart, Math.min(tHem, floorT(phi))] as const;
      const ts: number[] = [];
      const rows = this.legs[leg].grid.rows;
      const tMax = Math.min(tHem, 2.25);
      for (let i = 0; i < rows; i++) ts.push(lerp(tStart, tMax, i / (rows - 1)));
      const radius2 = (t: number, phi: number) => {
        const base = lf.occR(t, phi);
        let r = Math.max(base + thick, lerp(base + thick, circ(t) / TAU, smoothstep(-0.06, 0.22, t)));
        // vinco frontal e traseiro na alfaiataria
        if (crease) r += crease * (angBump(phi, FRONT, 0.2) + 0.5 * angBump(phi, BACK, 0.2)) * smoothstep(0.2, 0.6, t);
        // pernas largas balançam levemente
        if (wide && !slim) r += 0.35 * Math.sin(5 * phi + leg) * smoothstep(0.8, 1.8, t);
        if (cargo) r += bulge(t) * angBump(phi, lat, 0.5);
        // barra empilhando sobre o calçado
        const fT = floorT(phi);
        const excess = (tHem - fT) * shinL;
        if (excess > 0) {
          const zone = 11 / shinL;
          const dz = fT - t;
          if (dz < zone) {
            const amp = Math.min(2.2, 0.35 + excess * 0.16);
            r += amp * (0.45 + 0.55 * Math.abs(Math.sin((dz * shinL * Math.PI) / 3.2))) * (1 - dz / zone);
          }
        }
        return r;
      };
      this.legs[leg].update(path, L.front, lf, ts, bounds, radius2);
      // registra o raio externo da perna para a envoltória (saias/camisetas longas)
      const out = field.legOuter[leg];
      for (let i = 0; i <= 40; i++) {
        const t = i / 20;
        if (t > tHem) {
          out[i] = 0;
          continue;
        }
        const sec = legSection(s, t);
        const body = (sec.W + (sec.F + sec.B) / 2) / 2;
        out[i] = Math.max(thick, lerp(thick, circ(t) / TAU - body, smoothstep(-0.06, 0.22, t))) + bulge(t);
      }
    }
    field.refreshLegs();

    // pelve depois das pernas: envolve o topo largo das pernas (sem "degrau" nem fresta no gancho)
    field.computeTaut(s.crotchY - 12, wb + 2);
    const radius = (y: number, phi: number) => {
      const occ = field.tautR(y, phi);
      // justa: a pelve segue só a pelve; as pernas da peça cobrem as coxas
      if (slim) return (y < rig.yHJ + 6 ? Math.min(occ, field.pelvisR(y, phi) + 0.3) : occ) + thick;
      const base = occ;
      const minR = base + thick * 0.5;
      let a: number, b: number;
      if (y >= s.hipY) {
        const u = clamp((y - s.hipY) / (wb - s.hipY), 0, 1);
        a = lerp(aHip, aWb, u);
        b = lerp(aHip * aspect, aWb * 0.7, u);
      } else {
        a = aHip;
        b = aHip * aspect;
      }
      const zc = ((field.bodyR(y, FRONT) - field.bodyR(y, BACK)) / 2) * 0.7;
      const gather = elastic ? 0.22 * Math.sin(22 * phi) * smoothstep(wb - 6, wb - 1, y) : 0;
      const E = offsetEllipseR(phi, a, b, zc) + gather;
      // abaixo da articulação do quadril a casca assenta sobre as pernas da peça (sem aba)
      return smax(minR, lerp(E, minR, smoothstep(rig.yHJ, s.crotchY - 1, y)), 1.6);
    };
    // fundo em curva: desce no gancho (frente/trás) e sobe nas laterais, onde as pernas cobrem
    const bottom = (phi: number) => lerp(s.crotchY + 6, slim ? s.crotchY - 1.5 : s.crotchY + 1.5, Math.pow(Math.abs(Math.sin(phi)), 1.5));
    const ys: number[] = [];
    const n = this.main!.grid.rows;
    for (let i = 0; i < n; i++) ys.push(lerp(s.crotchY - 1.5, wb, i / (n - 1)));
    this.main!.update(field, clampedRows(ys, (phi) => [bottom(phi), wb]), radius);


    // cós
    this.waistband!.update(field, spanRows(3, () => [wb - (k === "jeans" || k === "trousers" || k === "wideTrousers" || cargo ? 4 : 3.6), wb + 0.15]), (y, phi) => field.occR(y, phi) + 0.3);

    for (const d of this.details) {
      if (d.d instanceof LimbDecal) {
        const leg = d.leg ?? 0;
        const L = rig.legs[leg];
        const lat = L.side === 1 ? Math.PI : 0;
        if (d.kind === "cargoPocket") d.d.update(ctx.body.legPaths[leg], L.front, ctx.legF[leg], lat, 0.66, pocketA - 0.02, Math.min(pocketB + 0.02, tHem - 0.05), 0.18);
        // faixa lateral (bermuda mesh)
        else d.d.update(ctx.body.legPaths[leg], L.front, ctx.legF[leg], lat, 0.2, -0.05, Math.min(tHem, 2.2) - 0.03, 0.12);
      } else this.placeDetail(ctx, d);
    }
    for (const gfx of this.gfx) {
      if (!(gfx.d instanceof LimbDecal)) continue;
      const L = rig.legs[0];
      const lat = Math.PI; // perna esquerda, lado externo
      if (gfx.layout === "vertical") gfx.d.update(ctx.body.legPaths[0], L.front, ctx.legF[0], lat - 0.15, 0.3, 0.2, Math.min(0.85, tHem), 0.15);
      else if (gfx.layout === "badge") gfx.d.update(ctx.body.legPaths[0], L.front, ctx.legF[0], lat - 0.75, 0.22, tHem - 0.3, tHem - 0.12, 0.15);
      else gfx.d.update(ctx.body.legPaths[0], L.front, ctx.legF[0], lat - 0.6, 0.5, tHem - 0.24, tHem - 0.1, 0.15);
    }
  }

  /* ─────────── saias ─────────── */

  private skirtKeys(ctx: Ctx) {
    const s = ctx.s;
    const row = this.g.row;
    const hipC = row.hipCm ?? s.hip + 4;
    const aspect = 0.68;
    const aHip = hipC / ellipseFactor(aspect);
    const flare = this.g.kind === "midiSkirt" ? 1.32 : 1.04;
    return { aHip, aspect, flare };
  }

  private skirtRadiusRaw(ctx: Ctx, y: number, phi: number) {
    const s = ctx.s;
    const { aHip, aspect, flare } = this.skirtKeys(ctx);
    const field = ctx.field;
    let a = aHip, b = aHip * aspect;
    if (y > s.hipY) {
      const waistC = this.g.row.waistCm ?? s.waist;
      const aW = Math.max(waistC, s.waist * 0.96) / ellipseFactor(0.72);
      const u = clamp((y - s.hipY) / (this.topY - s.hipY), 0, 1);
      a = lerp(aHip, aW, u);
      b = lerp(aHip * aspect, aW * 0.72, u);
    } else {
      const u = clamp((s.hipY - y) / (s.hipY - this.hemY), 0, 1);
      a *= lerp(1, flare, u * u);
      b = a * lerp(aspect, 0.8, u);
    }
    let zc = ((field.bodyR(Math.max(y, s.crotchY + 2), FRONT) - field.bodyR(Math.max(y, s.crotchY + 2), BACK)) / 2) * 0.6;
    let xc = 0;
    if (y < s.crotchY + 2) {
      const [mu, mw] = field.legMid(y);
      const k = smoothstep(s.crotchY + 2, s.crotchY - 18, y);
      xc = mu * k;
      zc = lerp(zc, mw, k);
    }
    const u = clamp((s.hipY - y) / (s.hipY - this.hemY), 0, 1);
    const folds = (this.g.kind === "midiSkirt" ? 1.1 : 0.25) * u * (0.6 * Math.sin(9 * phi + 0.4) + 0.4 * Math.sin(5 * phi + 1.9));
    return offsetEllipseR2(phi, a, b, xc, zc) + folds;
  }

  private updateSkirt(ctx: Ctx) {
    const { s, field } = ctx;
    const thick = this.g.kind === "miniSkirt" ? 0.5 : 0.3;
    const wb = this.topY;
    field.computeTaut(this.hemY - 10, wb + 2);
    const radius = (y: number, phi: number) => smax((y < s.hipY ? field.tautSmooth(y, phi) : field.tautR(y, phi)) + thick, this.skirtRadiusRaw(ctx, y, phi), 1.8);
    const n = this.main!.grid.rows;
    const ys: number[] = [];
    for (let i = 0; i < n; i++) ys.push(lerp(this.hemY, wb, Math.pow(i / (n - 1), 1.15)));
    this.main!.update(field, clampedRows(ys, () => [this.hemY, wb]), radius);
    const h = this.g.kind === "miniSkirt" ? 3.6 : 3;
    this.waistband!.update(field, spanRows(3, () => [wb - h, wb + 0.2]), (y, phi) => field.occR(y, phi) + 0.35);
  }

  dispose() {
    this.shells.forEach((x) => x.dispose());
    this.limbs.forEach((x) => x.dispose());
    this.decals.forEach((x) => x.dispose());
    this.ribbons.forEach((x) => x.dispose());
    this.straps.forEach((x) => x.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.group.removeFromParent();
  }
}

/** Camadas-base neutras (cinza claro) quando top/bottom estão vazios — como na referência. */
export function baseGarment(kind: "sportsBra" | "baseTank" | "bikeShorts" | "baseShorts", s: Shape): EngineGarment {
  const gray = "#B7BCC3";
  const spec = { kind, slot: (kind === "sportsBra" || kind === "baseTank" ? "top" : "bottom") as GarmentSlot, silhouette: "slim" as const, colors: { base: gray, trim: gray }, pattern: "solid" as const, formality: "casual" as const };
  const row: SizeChartRow =
    kind === "sportsBra"
      ? { size: "U", chestCm: s.chest * 0.96, lengthCm: s.neckBaseY + 4.5 - (s.chestY - 8.5) }
      : kind === "baseTank"
        ? { size: "U", chestCm: s.chest + 2, lengthCm: s.neckBaseY + 4.5 - (s.crotchY + 4) }
        : kind === "bikeShorts"
          ? { size: "U", waistCm: s.waist, hipCm: s.hip, inseamCm: s.crotchY * 0.26 }
          : { size: "U", waistCm: s.waist, hipCm: s.hip + 12, inseamCm: s.crotchY * 0.2 };
  return { key: `base-${kind}`, kind, slot: spec.slot, spec: { ...spec, silhouette: kind === "baseShorts" ? "regular" : "slim" }, row };
}
