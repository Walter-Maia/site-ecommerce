import { type BufferGeometry, Group, IcosahedronGeometry, type Material, Mesh, type Texture } from "three";
import type { GarmentSpec } from "@/lib/types";
import { Grid } from "./grid";
import { HEAD_SEGS, headShapeR } from "./body";
import { headDims } from "./rig";
import type { Shape } from "./shape";
import { TAU, clamp, lerp, smoothstep, superR } from "./math";
import { type RimUniforms, decalMaterial, fabricMaterial, plainMaterial } from "./materials";
import { capTexture, graphicTexture, labelTexture, luminance, patternTexture, shade, shoeTexture, vulcSoleTexture } from "./textures";
import { mirrorX } from "./extremities";
import { boundary } from "./pieces";

/* ───────────────────────── Calçados ───────────────────────── */

type Station = [number, number, number]; // z, meia largura, altura do cabedal (unidade = pé)

const SNEAKER: Station[] = [
  [-0.285, 0.07, 0.15],
  [-0.255, 0.128, 0.26],
  [-0.16, 0.148, 0.29],
  [-0.03, 0.152, 0.3],
  [0.1, 0.158, 0.285],
  [0.28, 0.176, 0.215],
  [0.48, 0.196, 0.16],
  [0.64, 0.198, 0.128],
  [0.76, 0.18, 0.106],
  [0.835, 0.15, 0.088],
  [0.875, 0.085, 0.062],
];
const LOAFER: Station[] = [
  [-0.27, 0.06, 0.14],
  [-0.24, 0.12, 0.22],
  [-0.14, 0.142, 0.235],
  [-0.02, 0.146, 0.24],
  [0.14, 0.155, 0.255],
  [0.32, 0.172, 0.2],
  [0.52, 0.186, 0.14],
  [0.68, 0.18, 0.11],
  [0.8, 0.15, 0.085],
  [0.88, 0.09, 0.06],
  [0.915, 0.03, 0.04],
];

/** Tênis de skate vulcanizado: mais largo, cabedal "gordinho", biqueira alta e arredondada. */
const SKATE: Station[] = [
  [-0.29, 0.082, 0.17],
  [-0.262, 0.14, 0.29],
  [-0.17, 0.16, 0.325],
  [-0.04, 0.165, 0.33],
  [0.1, 0.171, 0.305],
  [0.28, 0.19, 0.24],
  [0.47, 0.208, 0.19],
  [0.63, 0.21, 0.165],
  [0.755, 0.196, 0.145],
  [0.845, 0.165, 0.122],
  [0.893, 0.1, 0.088],
  [0.906, 0.04, 0.06],
];

export type ShoeKind = "sneaker" | "loafer" | "skate";

/** Espessura da sola (fração do pé). O corpo sobe exatamente isso: pés sempre no chão. */
export const SOLE: Record<ShoeKind, number> = { sneaker: 0.1, loafer: 0.065, skate: 0.118 };

function shoeUpper(st: Station[], kind: ShoeKind): BufferGeometry {
  const g = new Grid(16, st.length, { capStart: true, capEnd: true, uv: "normalized" });
  const floor = -0.3;
  for (let i = 0; i < st.length; i++) {
    const [z, W, h] = st[i];
    const cy = floor + h / 2;
    for (let j = 0; j <= 16; j++) {
      const phi = (j / 16) * TAU;
      // anel: φ=0 medial (−x), 90° topo, 180° lateral, 270° sola
      // seção quase retangular: laterais retas, topo levemente abaulado (skate: mais redondo)
      const r = superR(phi, W, h / 2, h / 2, Math.sin(phi) < 0 ? 3.4 : kind === "skate" ? 2.25 : 2.6);
      g.set(i, j, -Math.cos(phi) * r, cy + Math.sin(phi) * r, z);
    }
  }
  g.autoCaps();
  g.commit();
  // a tampa da ponta usa a cor da biqueira (sem "listras" de UV no leque)
  const capE = g.cols * g.rows + 1;
  g.uv[capE * 2] = 0.75;
  g.uv[capE * 2 + 1] = 1;
  return g.geometry;
}

function sole(st: Station[], thick: number, kind: ShoeKind): BufferGeometry {
  // contorno visto de cima, extrudado para baixo
  const segs = 22;
  const rows = 4;
  const g = new Grid(segs, rows, { capStart: true, capEnd: true, uv: "normalized" });
  const z0 = (st[0][0] + st[st.length - 1][0]) / 2;
  const vulc = kind === "skate";
  const half = (st[st.length - 1][0] - st[0][0]) / 2 + (vulc ? 0.02 : 0.012);
  const widthAt = (z: number) => {
    let i = 0;
    while (i < st.length - 2 && z > st[i + 1][0]) i++;
    const u = Math.min(1, Math.max(0, (z - st[i][0]) / (st[i + 1][0] - st[i][0])));
    return lerp(st[i][1], st[i + 1][1], u) + (vulc ? 0.022 : 0.014);
  };
  const floor = -0.3;
  // vulcanizada: parede reta e alta (fita de borracha), sobe um pouco sobre o cabedal
  const ys = vulc ? [floor - thick, floor - thick * 0.8, floor - thick * 0.05, floor + 0.035] : [floor - thick, floor - thick * 0.75, floor - thick * 0.2, floor + 0.01];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * TAU;
      const z = z0 + Math.sin(a) * half;
      const w = Math.max(0.03, widthAt(z));
      const bulge = vulc ? (i === 0 ? 0.985 : 1) : i === 1 || i === 2 ? 1.012 : 1;
      // ordem: o anel cresce em +y (t = +y), frente = +z
      g.set(i, j, Math.cos(a) * w * bulge, ys[i] + (kind === "loafer" && z < 0 && i === 0 ? -0.012 : 0), z);
    }
  }
  g.autoCaps();
  g.commit();
  return g.geometry;
}

export class Shoes {
  readonly group = new Group();
  readonly kind: ShoeKind;
  readonly meshes: Mesh[] = [];
  private geos: BufferGeometry[] = [];
  private mats: Material[] = [];
  private texs: Texture[] = [];

  constructor(spec: GarmentSpec, rim: RimUniforms, parent: Group) {
    this.kind = spec.kind === "loafer" ? "loafer" : spec.kind === "skateShoe" ? "skate" : "sneaker";
    const st = this.kind === "sneaker" ? SNEAKER : this.kind === "skate" ? SKATE : LOAFER;
    const tex = shoeTexture(this.kind, spec.colors.base, spec.colors.secondary, spec.colors.trim);
    this.texs.push(tex);
    const upperMat = fabricMaterial(this.kind === "skate" ? "solid" : "leather", tex, rim);
    (upperMat as unknown as { roughness: number }).roughness = this.kind === "loafer" ? 0.36 : this.kind === "skate" ? 0.93 : 0.55;
    let soleMat: Material;
    if (this.kind === "skate") {
      // sola vulcanizada na cor secundária (branca, goma…); filete escuro
      const rubber = spec.colors.secondary ?? spec.colors.trim ?? "#f1ede4";
      const st2 = vulcSoleTexture(rubber, luminance(rubber) > 0.6 ? "#1d1d1f" : undefined);
      this.texs.push(st2);
      soleMat = fabricMaterial("solid", st2, rim);
      (soleMat as unknown as { roughness: number }).roughness = 0.72;
    } else {
      soleMat = plainMaterial(this.kind === "sneaker" ? spec.colors.trim ?? "#e8dfc9" : shade(spec.colors.base, 0.06), rim, this.kind === "sneaker" ? 0.7 : 0.5);
    }
    this.mats.push(upperMat, soleMat);
    const up = shoeUpper(st, this.kind);
    const so = sole(st, SOLE[this.kind], this.kind);
    const upR = mirrorX(up), soR = mirrorX(so);
    this.geos.push(up, so, upR, soR);
    for (const [geo, mat, name] of [
      [up, upperMat, "shoeL"],
      [so, soleMat, "soleL"],
      [upR, upperMat, "shoeR"],
      [soR, soleMat, "soleR"],
    ] as const) {
      const m = new Mesh(geo, mat);
      m.name = name;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.matrixAutoUpdate = false;
      this.group.add(m);
      this.meshes.push(m);
    }
    parent.add(this.group);
  }

  /** Malhas [cabedal E, sola E, cabedal D, sola D]. */
  get left() {
    return [this.meshes[0], this.meshes[1]];
  }
  get right() {
    return [this.meshes[2], this.meshes[3]];
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.group.removeFromParent();
  }
}

/* ───────────────────────── Boné ───────────────────────── */

export class Cap {
  readonly group = new Group();
  private crown: Grid;
  private brim: Grid;
  private decal?: Grid;
  private button: Mesh;
  private buttonGeo = new IcosahedronGeometry(1, 0);
  private mats: Material[] = [];
  private texs: Texture[] = [];
  private readonly five: boolean;
  private readonly spec: GarmentSpec;
  readonly band = boundary([[90, 0.79], [45, 0.72], [135, 0.72], [0, 0.62], [180, 0.62], [270, 0.5], [225, 0.54], [315, 0.54]]);

  constructor(spec: GarmentSpec, rim: RimUniforms, headLocal: Group) {
    this.spec = spec;
    this.five = spec.silhouette === "slim" || spec.pattern === "nylon";
    const t = capTexture(spec.colors.base, spec.pattern);
    this.texs.push(t);
    const crownMat = fabricMaterial(spec.pattern === "nylon" ? "nylon" : "solid", t, rim);
    const brimMat = plainMaterial(shade(spec.colors.base, -0.04).toString(), rim, 0.75);
    this.mats.push(crownMat, brimMat);
    this.crown = new Grid(HEAD_SEGS, 8, { capEnd: true, uv: "normalized" });
    this.brim = new Grid(12, 4, { closed: false });
    for (const [g, m, n] of [
      [this.crown, crownMat, "capCrown"],
      [this.brim, brimMat, "capBrim"],
    ] as const) {
      const mesh = new Mesh(g.geometry, m);
      mesh.name = n;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    this.button = new Mesh(this.buttonGeo, crownMat);
    this.group.add(this.button);
    if (spec.graphic) {
      const gt = graphicTexture(spec.graphic, spec.graphic.text.length <= 2 ? "badge" : "wide", spec.colors.base);
      this.texs.push(gt);
      const dm = decalMaterial(gt, rim, 0.6);
      this.mats.push(dm);
      this.decal = new Grid(10, 4, { closed: false, uv: "normalized" });
      const d = this.decal;
      for (let i = 0; i < d.rows; i++)
        for (let j = 0; j < d.cols; j++) {
          const k = (i * d.cols + j) * 2;
          d.uv[k] = 1 - j / d.segs;
          d.uv[k + 1] = i / (d.rows - 1);
        }
      const mesh = new Mesh(d.geometry, dm);
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    headLocal.add(this.group);
  }

  /** `hairR(h, φ)` = raio externo do cabelo (o boné assenta sobre ele). */
  update(s: Shape, hairR: (h: number, phi: number) => number) {
    const { headH } = headDims(s);
    const dome = this.five ? 0.9 : 1.6;
    const crownAt = (h: number, phi: number, u: number) => {
      const base = Math.max(hairR(Math.min(h, 0.99), phi), headShapeR(s, Math.min(h, 0.99), phi) + 0.3) + 0.45;
      // five panel: copa mais reta; dad hat: copa baixa e arredondada
      const r = base * (this.five ? lerp(1, 1.06, smoothstep(0.3, 0.8, u)) : 1) + (this.five ? 0.4 : 0.2);
      return r;
    };
    const g = this.crown;
    for (let j = 0; j <= HEAD_SEGS; j++) {
      const phi = ((j % HEAD_SEGS) / HEAD_SEGS) * TAU;
      const hb = this.band(phi);
      for (let i = 0; i < g.rows; i++) {
        const u = i / (g.rows - 1);
        const h = lerp(hb, 1.0, Math.pow(u, 0.85));
        const r = u >= 0.999 ? 0.4 : crownAt(h, phi, u) * (u > 0.75 ? lerp(1, 0.35, (u - 0.75) / 0.25) : 1);
        const y = h * headH + dome * u * u + (this.five ? 0.6 * u : 0);
        g.set(i, j, Math.cos(phi) * r, y, Math.sin(phi) * r);
      }
    }
    g.autoCaps();
    g.commit();
    this.button.position.set(0, headH + dome + (this.five ? 0.6 : 0) + 0.2, 0);
    this.button.scale.setScalar(0.55);

    // aba: arco frontal da faixa projetado para frente e para baixo
    const b = this.brim;
    const len = this.five ? 5.6 : 7.2;
    for (let j = 0; j <= b.segs; j++) {
      const a = Math.PI / 2 + lerp(-0.95, 0.95, j / b.segs);
      const hb = this.band(a);
      const r0 = crownAt(hb, a, 0) - 0.1;
      const x0 = Math.cos(a) * r0, z0 = Math.sin(a) * r0, y0 = hb * headH + 0.1;
      const side = Math.abs(Math.cos(a));
      const dx = Math.cos(a) * 0.45, dz = Math.sin(a) * 0.45 + 0.75;
      const dl = Math.hypot(dx, dz);
      for (let i = 0; i < b.rows; i++) {
        const f = i / (b.rows - 1);
        const reach = len * f * (1 - 0.35 * side * side);
        const curve = this.five ? 0.2 : 1.8 * side * side;
        b.set(i, j, x0 + (dx / dl) * reach, y0 - f * (this.five ? 0.5 : 1.1) - curve * f, z0 + (dz / dl) * reach);
      }
    }
    b.commit();

    if (this.decal) {
      const d = this.decal;
      const w = this.spec.graphic && this.spec.graphic.text.length <= 2 ? 0.32 : 0.62;
      for (let i = 0; i < d.rows; i++) {
        for (let j = 0; j < d.cols; j++) {
          const phi = Math.PI / 2 - w / 2 + (w * j) / d.segs;
          const hb = this.band(phi);
          const h = hb + 0.03 + (i / (d.rows - 1)) * (this.five ? 0.13 : 0.1) * (w < 0.4 ? 1.7 : 1);
          const u = (h - hb) / (1 - hb);
          const r = crownAt(h, phi, u) + 0.12;
          const y = h * headH + dome * u * u + (this.five ? 0.6 * u : 0);
          d.set(i, j, Math.cos(phi) * r, y, Math.sin(phi) * r);
        }
      }
      d.geometry.getAttribute("position").needsUpdate = true;
    }
  }

  dispose() {
    this.crown.dispose();
    this.brim.dispose();
    this.decal?.dispose();
    this.buttonGeo.dispose();
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.group.removeFromParent();
  }
}

/* ───────────────────────── Gorro ───────────────────────── */

/** Linha da barra do gorro (fração da altura da cabeça): testa, topo das orelhas, nuca. */
export const BEANIE_BAND = boundary([[90, 0.72], [50, 0.665], [130, 0.665], [0, 0.5], [180, 0.5], [320, 0.43], [220, 0.43], [270, 0.405]]);

/**
 * Gorro canelado com barra dobrada. A copa veste a cabeça + cabelo (via `hatR`) e fecha
 * num domo levemente folgado; a barra é um anel mais grosso por cima da borda.
 */
export class Beanie {
  readonly group = new Group();
  readonly band = BEANIE_BAND;
  /** Altura da barra dobrada (fração da altura da cabeça, ~3,8 cm). */
  readonly cuffH = 0.165;
  /** Topo do gorro (cm, coordenadas locais da cabeça) — para enquadrar a câmera. */
  top = 0;
  private crown: Grid;
  private cuff: Grid;
  private label?: Grid;
  private mats: Material[] = [];
  private texs: Texture[] = [];
  private readonly labelW: number;

  constructor(spec: GarmentSpec, rim: RimUniforms, headLocal: Group) {
    const rib = patternTexture("rib", spec.colors.base);
    rib.texture.repeat.set(16, 1);
    const ribCuff = rib.texture.clone();
    ribCuff.repeat.set(17, 1);
    this.texs.push(rib.texture, ribCuff);
    const crownMat = fabricMaterial("rib", rib.texture, rim);
    const cuffMat = fabricMaterial("rib", ribCuff, rim);
    this.mats.push(crownMat, cuffMat);
    this.crown = new Grid(HEAD_SEGS, 12, { capEnd: true, uv: "normalized" });
    this.cuff = new Grid(HEAD_SEGS, 5, { uv: "normalized" });
    for (const [g, m, n] of [
      [this.crown, crownMat, "beanieCrown"],
      [this.cuff, cuffMat, "beanieCuff"],
    ] as const) {
      const mesh = new Mesh(g.geometry, m);
      mesh.name = n;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    this.labelW = spec.graphic ? (spec.graphic.text.length <= 3 ? 3.4 : 6.2) : 0;
    if (spec.graphic) {
      // etiqueta tecida: fundo na cor secundária (quando houver)
      const lt = labelTexture(spec.graphic, spec.colors.base, spec.colors.secondary);
      this.texs.push(lt);
      const dm = decalMaterial(lt, rim, 0.7);
      this.mats.push(dm);
      this.label = new Grid(8, 3, { closed: false, uv: "normalized" });
      const d = this.label;
      for (let i = 0; i < d.rows; i++)
        for (let j = 0; j < d.cols; j++) {
          const k = (i * d.cols + j) * 2;
          d.uv[k] = 1 - j / d.segs;
          d.uv[k + 1] = i / (d.rows - 1);
        }
      const mesh = new Mesh(d.geometry, dm);
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    headLocal.add(this.group);
  }

  /**
   * `hatR(y, φ)` = raio externo da cabeça + cabelo na altura local y (cm);
   * `hairTop` = altura local do ponto mais alto do cabelo (cm).
   */
  update(s: Shape, hatR: (y: number, phi: number) => number, hairTop: number) {
    const { headH } = headDims(s);
    const T = 0.62; // espessura da malha
    const slack = 1.5; // folga no topo (o gorro não "cola" no cocuruto)
    const yTop = Math.max(headH, hairTop) + T + slack;
    const y1 = Math.max(0.74 * headH, hairTop - 0.3 * headH);
    const follow = (y: number, phi: number) => Math.max(hatR(y, phi), headShapeR(s, clamp(y / headH, 0, 0.999), phi) + 0.25) + T;
    const hairEnd = Math.max(headH, hairTop);
    const surf = (y: number, phi: number, r1: number) => {
      if (y <= y1) return follow(y, phi);
      // domo elíptico a partir de y1 (topo redondo, com folga); o cabelo alto ainda empurra para fora
      const dome = r1 * Math.sqrt(Math.max(0, 1 - ((y - y1) / (yTop - y1)) ** 2));
      return y < hairEnd ? Math.max(dome, follow(y, phi)) : dome;
    };
    // raio da copa (o mesmo para barra e etiqueta, que assentam por cima dela)
    const crownR = (y: number, phi: number) => surf(y, phi, follow(y1, phi) * 1.015);
    const g = this.crown;
    for (let j = 0; j <= HEAD_SEGS; j++) {
      const phi = ((j % HEAD_SEGS) / HEAD_SEGS) * TAU;
      const yb = this.band(phi) * headH;
      for (let i = 0; i < g.rows; i++) {
        const u = i / (g.rows - 1);
        const y = lerp(yb, yTop, Math.pow(u, 0.85));
        const r = u >= 0.999 ? 0 : crownR(y, phi) * (1 + 0.03 * Math.sin(Math.PI * u));
        g.set(i, j, Math.cos(phi) * r, y, Math.sin(phi) * r);
      }
    }
    g.autoCaps();
    g.commit();
    this.top = yTop;

    // barra dobrada: perfil arredondado em volta da borda da copa
    const prof: [number, number][] = [
      [0.012, 0.02],
      [-0.012, 0.5],
      [0.02, 0.92],
      [this.cuffH - 0.02, 0.84],
      [this.cuffH + 0.006, 0.08],
    ];
    const c = this.cuff;
    for (let j = 0; j <= HEAD_SEGS; j++) {
      const phi = ((j % HEAD_SEGS) / HEAD_SEGS) * TAU;
      const hb = this.band(phi);
      for (let i = 0; i < c.rows; i++) {
        const [dh, off] = prof[i];
        const y = (hb + Math.max(0, dh)) * headH;
        const r = crownR(y, phi) * (1 + 0.03 * Math.sin(Math.PI * Math.max(0, dh) * 0.3)) + off;
        c.set(i, j, Math.cos(phi) * r, (hb + dh) * headH, Math.sin(phi) * r);
      }
    }
    c.commit();

    if (this.label) {
      const d = this.label;
      const hb = this.band(Math.PI / 2);
      const r0 = crownR((hb + 0.08) * headH, Math.PI / 2) + 0.9;
      const half = this.labelW / 2 / r0;
      const lh = (this.labelW / 2.67) / headH;
      for (let i = 0; i < d.rows; i++) {
        for (let j = 0; j < d.cols; j++) {
          const phi = Math.PI / 2 - half + (2 * half * j) / d.segs;
          const h = hb + 0.045 + (lh * i) / (d.rows - 1);
          const r = crownR(h * headH, phi) + 0.98;
          d.set(i, j, Math.cos(phi) * r, h * headH, Math.sin(phi) * r);
        }
      }
      d.geometry.getAttribute("position").needsUpdate = true;
    }
  }

  dispose() {
    this.crown.dispose();
    this.cuff.dispose();
    this.label?.dispose();
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.group.removeFromParent();
  }
}
