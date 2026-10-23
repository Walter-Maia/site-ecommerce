import { type Material, Mesh, type Object3D } from "three";
import { Grid } from "./grid";
import { TS, type TrunkField, trunkAngle } from "./field";
import type { LimbPath } from "./body";
import { limbFrame } from "./rig";
import { type V3, TAU, catmull, clamp, lerp, v3, vcross, vnorm, vsub } from "./math";

const c = v3();
const t = v3();
const ax = v3();
const az = v3();
const p = v3();

function mesh(grid: Grid, mat: Material, parent: Object3D, name: string, shadow = true) {
  const m = new Mesh(grid.geometry, mat);
  m.name = name;
  m.frustumCulled = false;
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Ocupação de um membro por (t, φ): corpo + camadas já vestidas. */
export class LimbField {
  readonly segs: number;
  readonly t0 = -0.3;
  readonly step = 0.05;
  readonly n: number;
  readonly occ: Float32Array;

  constructor(segs: number) {
    this.segs = segs;
    this.n = Math.round((3.3 - this.t0) / this.step) + 1;
    this.occ = new Float32Array(this.n * segs);
  }

  reset(body: (t: number, phi: number) => number) {
    for (let i = 0; i < this.n; i++) {
      const tt = this.t0 + i * this.step;
      for (let j = 0; j < this.segs; j++) this.occ[i * this.segs + j] = body(tt, (j / this.segs) * TAU);
    }
  }

  private idx(tt: number) {
    const x = clamp((tt - this.t0) / this.step, 0, this.n - 1.001);
    const i = Math.floor(x);
    return [i, x - i] as const;
  }

  occR(tt: number, phi: number) {
    const [i, u] = this.idx(tt);
    let x = (phi / TAU) * this.segs;
    x = ((x % this.segs) + this.segs) % this.segs;
    const j0 = Math.floor(x), j1 = (j0 + 1) % this.segs, v = x - j0;
    const S = this.segs, O = this.occ;
    const a = O[i * S + j0] * (1 - v) + O[i * S + j1] * v;
    const b = O[(i + 1) * S + j0] * (1 - v) + O[(i + 1) * S + j1] * v;
    return a + (b - a) * u;
  }

  maxR(tt: number) {
    const [i, u] = this.idx(tt);
    let m = 0;
    for (let j = 0; j < this.segs; j++) {
      const a = this.occ[i * this.segs + j], b = this.occ[(i + 1) * this.segs + j];
      m = Math.max(m, a + (b - a) * u);
    }
    return m;
  }

  writeSpan(j: number, ta: number, ra: number, tb: number, rb: number) {
    if (tb < ta) {
      [ta, tb] = [tb, ta];
      [ra, rb] = [rb, ra];
    }
    const i0 = Math.max(0, Math.ceil((ta - this.t0) / this.step));
    const i1 = Math.min(this.n - 1, Math.floor((tb - this.t0) / this.step));
    const jj = ((j % this.segs) + this.segs) % this.segs;
    for (let i = i0; i <= i1; i++) {
      const tt = this.t0 + i * this.step;
      const r = tb > ta ? lerp(ra, rb, (tt - ta) / (tb - ta)) : Math.max(ra, rb);
      const k = i * this.segs + jj;
      if (r > this.occ[k]) this.occ[k] = r;
    }
  }
}

export type Bounds = (phi: number, j: number) => readonly [number, number];
export type TrunkRadius = (y: number, phi: number, j: number) => number;
export type RowY = (i: number, phi: number, j: number) => number;

/** Linhas em alturas `ys` (compartilhadas) recortadas por coluna em [yb, yt]. */
export function clampedRows(ys: number[], bounds: Bounds): RowY {
  let lastJ = -1;
  let yb = 0, yt = 0;
  return (i, phi, j) => {
    if (j !== lastJ) {
      [yb, yt] = bounds(phi, j);
      lastJ = j;
    }
    return yt <= yb ? yb : clamp(ys[i], yb, yt);
  };
}

/** Linhas distribuídas entre dois limites por coluna (faixas: gola, barra, cós). */
export function spanRows(rows: number, bounds: Bounds, ease: (u: number) => number = (u) => u): RowY {
  let lastJ = -1;
  let yb = 0, yt = 0;
  return (i, phi, j) => {
    if (j !== lastJ) {
      [yb, yt] = bounds(phi, j);
      lastJ = j;
    }
    return yb + (yt - yb) * ease(i / (rows - 1));
  };
}

/** Casca de roupa no tronco: linhas em alturas `ys`, recortadas por coluna em [yb, yt]. */
export class TrunkShell {
  readonly grid: Grid;
  readonly mesh: Mesh;
  private readonly radii: Float32Array;
  private readonly yv: Float32Array;
  private readonly pv: Float32Array;
  /**
   * UV cilíndrico (u = φ·R, v = altura), em cm: listras e xadrez ficam retos e alinhados
   * ao corpo, sem acompanhar a curva da barra. 0 = UV métrico padrão (comprimento de arco).
   */
  cylR = 0;

  constructor(rows: number, mat: Material, parent: Object3D, name: string, shadow = true, capStart = false, smooth = false) {
    this.grid = new Grid(TS, rows, { closed: true, capStart, smooth });
    this.mesh = mesh(this.grid, mat, parent, name, shadow);
    this.radii = new Float32Array(rows * (TS + 1));
    this.yv = new Float32Array(rows * (TS + 1));
    this.pv = new Float32Array(rows * (TS + 1));
  }

  /** `rowY(i, φ, j)` dá a altura de cada linha por coluna (permite golas, barras curvas, decotes). */
  update(field: TrunkField, rowY: RowY, radius: TrunkRadius, write = true) {
    const g = this.grid;
    const rows = g.rows;
    for (let j = 0; j <= TS; j++) {
      const jj = j % TS;
      const phi = trunkAngle(jj);
      for (let i = 0; i < rows; i++) {
        const y = rowY(i, phi, jj);
        const r = radius(y, phi, jj);
        field.point(y, phi, r, p);
        g.set(i, j, p[0], p[1], p[2]);
        this.radii[i * (TS + 1) + j] = r;
        this.yv[i * (TS + 1) + j] = y;
        this.pv[i * (TS + 1) + j] = trunkAngle(j);
      }
    }
    g.autoCaps();
    g.commit();
    this.cylUV();
    if (write) {
      for (let j = 0; j < TS; j++)
        for (let i = 0; i < rows - 1; i++) {
          const a = i * (TS + 1) + j, b = a + TS + 1;
          if (this.yv[b] - this.yv[a] > 0.01) field.writeSpan(j, this.yv[a], this.radii[a], this.yv[b], this.radii[b]);
        }
    }
  }

  /**
   * Casca com a frente aberta (camisa/sobrecamisa desabotoada): as colunas se espalham de
   * FRENTE + gap(y) até FRENTE − gap(y) dando a volta pelas costas. `bounds(φ)` recorta cada
   * coluna em [yb, yt]; a ocupação é gravada na coluna do campo mais próxima de cada vértice.
   */
  updateOpen(field: TrunkField, ys: number[], bounds: (phi: number) => readonly [number, number], radius: (y: number, phi: number) => number, gap: (y: number) => number) {
    const g = this.grid;
    const rows = g.rows;
    const F = Math.PI / 2;
    for (let j = 0; j <= TS; j++) {
      const s = j / TS;
      for (let i = 0; i < rows; i++) {
        let phi = F + gap(ys[i]) + s * (TAU - 2 * gap(ys[i]));
        const [yb, yt] = bounds(phi);
        const y = yt <= yb ? yb : clamp(ys[i], yb, yt);
        phi = F + gap(y) + s * (TAU - 2 * gap(y));
        const r = radius(y, phi);
        field.point(y, phi, r, p);
        g.set(i, j, p[0], p[1], p[2]);
        const k = i * (TS + 1) + j;
        this.radii[k] = r;
        this.yv[k] = y;
        this.pv[k] = phi;
      }
    }
    g.commit();
    this.cylUV();
    for (let j = 0; j <= TS; j++)
      for (let i = 0; i < rows - 1; i++) {
        const a = i * (TS + 1) + j, b = a + TS + 1;
        if (this.yv[b] - this.yv[a] <= 0.01) continue;
        const jf = Math.round((this.pv[a] / TAU) * TS);
        field.writeSpan(jf, this.yv[a], this.radii[a], this.yv[b], this.radii[b]);
      }
  }

  private cylUV() {
    if (!this.cylR) return;
    const g = this.grid;
    const n = g.rows * (TS + 1);
    for (let k = 0; k < n; k++) {
      g.uv[k * 2] = this.pv[k] * this.cylR;
      g.uv[k * 2 + 1] = this.yv[k];
    }
  }

  dispose() {
    this.grid.dispose();
  }
}

export type LimbRadius = (t: number, phi: number, j: number) => number;

/** Casca de roupa num membro (manga, perna da calça). */
export class LimbShell {
  readonly grid: Grid;
  readonly mesh: Mesh;
  private readonly radii: Float32Array;
  private readonly tv: Float32Array;

  /** `capStart`: fecha a ponta de cima (cabeça da manga) — sem anel aberto aparecendo no ombro. */
  constructor(segs: number, rows: number, mat: Material, parent: Object3D, name: string, capStart = false) {
    this.grid = new Grid(segs, rows, { closed: true, capStart });
    this.mesh = mesh(this.grid, mat, parent, name);
    this.radii = new Float32Array(rows * (segs + 1));
    this.tv = new Float32Array(rows * (segs + 1));
  }

  update(path: LimbPath, front: V3, field: LimbField | null, ts: number[], bounds: Bounds, radius: LimbRadius, offset?: (t: number, phi: number, o: V3) => void) {
    const g = this.grid;
    const S = g.segs;
    for (let j = 0; j <= S; j++) {
      const jj = j % S;
      const phi = (jj / S) * TAU;
      const [ta, tb] = bounds(phi, jj);
      for (let i = 0; i < g.rows; i++) {
        const tt = tb <= ta ? ta : clamp(ts[i], ta, tb);
        path.at(tt, c, t);
        limbFrame(t, front, ax, az);
        const r = radius(tt, phi, jj);
        const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
        let x = c[0] + ax[0] * cs + az[0] * sn, y = c[1] + ax[1] * cs + az[1] * sn, z = c[2] + ax[2] * cs + az[2] * sn;
        if (offset) {
          p[0] = 0; p[1] = 0; p[2] = 0;
          offset(tt, phi, p);
          x += p[0]; y += p[1]; z += p[2];
        }
        g.set(i, j, x, y, z);
        this.radii[i * (S + 1) + j] = r;
        this.tv[i * (S + 1) + j] = tt;
      }
    }
    g.autoCaps();
    g.commit();
    if (field) {
      for (let j = 0; j < S; j++)
        for (let i = 0; i < g.rows - 1; i++) {
          const a = i * (S + 1) + j, b = a + S + 1;
          if (Math.abs(this.tv[b] - this.tv[a]) > 1e-4) field.writeSpan(j, this.tv[a], this.radii[a], this.tv[b], this.radii[b]);
        }
    }
  }

  dispose() {
    this.grid.dispose();
  }
}

/** Decalque (estampa, bolso, placa) que segue a superfície já vestida do tronco. */
export class TrunkDecal {
  readonly grid: Grid;
  readonly mesh: Mesh;
  /** Última colocação (ângulo central e faixa de altura), para saber se uma camada de cima o cobre. */
  phiC = 0;
  y0 = 0;
  y1 = 0;

  constructor(mat: Material, parent: Object3D, name: string, sx = 10, sy = 6) {
    this.grid = new Grid(sx, sy, { closed: false, uv: "normalized" });
    this.mesh = mesh(this.grid, mat, parent, name, false);
    this.mesh.renderOrder = 2;
    // u cresce para a esquerda do observador ao longo de φ; invertemos para o texto ler certo
    const g = this.grid;
    for (let i = 0; i < g.rows; i++)
      for (let j = 0; j < g.cols; j++) {
        const k = (i * g.cols + j) * 2;
        g.uv[k] = 1 - j / g.segs;
        g.uv[k + 1] = i / (g.rows - 1);
      }
  }

  /**
   * φc/yc = centro; w/h em cm; `lift` acima da ocupação atual. `phiAt(y)` (opcional)
   * desloca o centro por linha — vistas que acompanham a borda de uma frente aberta.
   */
  update(field: TrunkField, phiC: number, yc: number, w: number, h: number, lift = 0.14, curve = 0, phiAt?: (y: number) => number) {
    const g = this.grid;
    this.phiC = phiC;
    this.y0 = yc - h / 2;
    this.y1 = yc + h / 2;
    const r0 = field.occR(yc, phiC) + lift;
    const dphi = w / 2 / Math.max(1, r0);
    for (let i = 0; i < g.rows; i++) {
      const yRow = yc - h / 2 + (h * i) / (g.rows - 1);
      const pc = phiAt ? phiAt(yRow) : phiC;
      for (let j = 0; j < g.cols; j++) {
        const u = j / g.segs;
        const phi = pc - dphi + 2 * dphi * u;
        // `curve` arqueia a linha (script/varsity em arco)
        const y = yRow + curve * (1 - Math.pow(2 * u - 1, 2));
        const r = field.occR(y, phi) + lift;
        field.point(y, phi, r, p);
        g.set(i, j, p[0], p[1], p[2]);
      }
    }
    const pos = this.grid.geometry.getAttribute("position");
    pos.needsUpdate = true;
  }

  dispose() {
    this.grid.dispose();
  }
}

/** Decalque sobre um membro (texto na perna, faixa lateral). */
export class LimbDecal {
  readonly grid: Grid;
  readonly mesh: Mesh;

  constructor(mat: Material, parent: Object3D, name: string, sx = 6, sy = 8) {
    this.grid = new Grid(sx, sy, { closed: false, uv: "normalized" });
    this.mesh = mesh(this.grid, mat, parent, name, false);
    this.mesh.renderOrder = 2;
    const g = this.grid;
    for (let i = 0; i < g.rows; i++)
      for (let j = 0; j < g.cols; j++) {
        const k = (i * g.cols + j) * 2;
        g.uv[k] = j / g.segs;
        g.uv[k + 1] = 1 - i / (g.rows - 1);
      }
  }

  update(path: LimbPath, front: V3, field: LimbField, phiC: number, dphi: number, ta: number, tb: number, lift = 0.14) {
    const g = this.grid;
    for (let i = 0; i < g.rows; i++) {
      const tt = lerp(ta, tb, i / (g.rows - 1));
      path.at(tt, c, t);
      limbFrame(t, front, ax, az);
      for (let j = 0; j < g.cols; j++) {
        const phi = phiC - dphi + (2 * dphi * j) / g.segs;
        const r = field.occR(tt, phi) + lift;
        const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
        g.set(i, j, c[0] + ax[0] * cs + az[0] * sn, c[1] + ax[1] * cs + az[1] * sn, c[2] + ax[2] * cs + az[2] * sn);
      }
    }
    this.grid.geometry.getAttribute("position").needsUpdate = true;
  }

  dispose() {
    this.grid.dispose();
  }
}

/**
 * Fita (alça, lapela, cadarço do capuz) que percorre pontos (y, φ) sobre o
 * tronco vestido. Seção retangular; material DoubleSide.
 */
export class Ribbon {
  readonly grid: Grid;
  readonly mesh: Mesh;
  private readonly n: number;
  private pts: V3[];
  private nrm: V3[];

  constructor(samples: number, mat: Material, parent: Object3D, name: string) {
    this.n = samples;
    this.grid = new Grid(4, samples, { closed: true });
    this.mesh = mesh(this.grid, mat, parent, name);
    this.pts = Array.from({ length: samples }, () => v3());
    this.nrm = Array.from({ length: samples }, () => v3());
  }

  /** ctrl: pontos de controle (y, φ, lift extra). */
  updateOnTrunk(field: TrunkField, ctrl: [number, number, number][], width: number, thick: number, lift = 0.2) {
    const n = this.n;
    // desdobra φ para interpolar sem salto em 2π
    const un = ctrl.map((q) => [...q] as [number, number, number]);
    for (let k = 1; k < un.length; k++) {
      while (un[k][1] - un[k - 1][1] > Math.PI) un[k][1] -= TAU;
      while (un[k][1] - un[k - 1][1] < -Math.PI) un[k][1] += TAU;
    }
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (un.length - 1);
      const k = Math.min(un.length - 2, Math.floor(x));
      const u = x - k;
      const a = un[Math.max(0, k - 1)], b = un[k], cc = un[k + 1], d = un[Math.min(un.length - 1, k + 2)];
      const y = catmull(a[0], b[0], cc[0], d[0], u);
      const phi = catmull(a[1], b[1], cc[1], d[1], u);
      const extra = lerp(b[2], cc[2], u);
      const r = field.occR(y, phi) + lift + extra;
      field.point(y, phi, r, this.pts[i]);
      field.normal(y, phi, lift + extra, this.nrm[i]);
    }
    this.writeStrip(width, thick);
  }

  /** Pontos livres no mundo (ex.: cordões, tranças achatadas). */
  updateFree(points: V3[], normals: V3[], width: number, thick: number) {
    for (let i = 0; i < this.n; i++) {
      const q = points[Math.min(points.length - 1, i)];
      this.pts[i][0] = q[0]; this.pts[i][1] = q[1]; this.pts[i][2] = q[2];
      const nq = normals[Math.min(normals.length - 1, i)];
      this.nrm[i][0] = nq[0]; this.nrm[i][1] = nq[1]; this.nrm[i][2] = nq[2];
    }
    this.writeStrip(width, thick);
  }

  private writeStrip(width: number, thick: number) {
    const g = this.grid;
    const tan = v3(), bn = v3();
    for (let i = 0; i < this.n; i++) {
      const a = this.pts[Math.max(0, i - 1)], b = this.pts[Math.min(this.n - 1, i + 1)];
      vsub(tan, b, a);
      vnorm(tan, tan);
      const nn = this.nrm[i];
      vcross(bn, tan, nn);
      vnorm(bn, bn);
      const P = this.pts[i];
      const hw = width / 2;
      const corners: [number, number][] = [[hw, thick], [-hw, thick], [-hw, 0], [hw, 0], [hw, thick]];
      for (let j = 0; j <= 4; j++) {
        const [s, h] = corners[j];
        g.set(i, j, P[0] + bn[0] * s + nn[0] * h, P[1] + bn[1] * s + nn[1] * h, P[2] + bn[2] * s + nn[2] * h);
      }
    }
    g.commit();
  }

  dispose() {
    this.grid.dispose();
  }
}

/**
 * Alça "pintada" sobre a superfície vestida: a largura é medida na própria
 * superfície (y, φ), então a fita acompanha a curva do ombro sem levantar as bordas.
 */
export class SurfaceStrap {
  readonly grid: Grid;
  readonly mesh: Mesh;
  private readonly n: number;

  constructor(samples: number, mat: Material, parent: Object3D, name: string, smooth = false) {
    this.n = samples;
    // materiais com sombreamento suave exigem normais na geometria
    this.grid = new Grid(2, samples, { closed: false, smooth });
    this.mesh = mesh(this.grid, mat, parent, name);
  }

  /** ctrl: pontos (y, φ) sobre o tronco. */
  update(field: TrunkField, ctrl: [number, number][], width: number, lift: number) {
    const un = ctrl.map((q) => [...q] as [number, number]);
    for (let k = 1; k < un.length; k++) {
      while (un[k][1] - un[k - 1][1] > Math.PI) un[k][1] -= TAU;
      while (un[k][1] - un[k - 1][1] < -Math.PI) un[k][1] += TAU;
    }
    const n = this.n;
    const ys = new Float32Array(n), ps = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (un.length - 1);
      const k = Math.min(un.length - 2, Math.floor(x));
      const u = x - k;
      const a = un[Math.max(0, k - 1)], b = un[k], cc = un[k + 1], d = un[Math.min(un.length - 1, k + 2)];
      ys[i] = catmull(a[0], b[0], cc[0], d[0], u);
      ps[i] = catmull(a[1], b[1], cc[1], d[1], u);
    }
    const g = this.grid;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      const r = Math.max(1, field.occR(ys[i], ps[i]));
      const dy = ys[i1] - ys[i0];
      const dp = (ps[i1] - ps[i0]) * r;
      const l = Math.hypot(dy, dp) || 1;
      // perpendicular no espaço (cm verticais, cm de arco)
      const oy = -dp / l, op = dy / l / r;
      for (let j = 0; j <= 2; j++) {
        const s = ((j - 1) * width) / 2;
        const y = ys[i] + oy * s;
        const phi = ps[i] + op * s;
        field.point(y, phi, field.occR(y, phi) + lift, p);
        g.set(i, j, p[0], p[1], p[2]);
      }
    }
    g.commit();
  }

  dispose() {
    this.grid.dispose();
  }
}

/** Fronteira periódica suave a partir de pontos de controle (graus → altura). */
export function boundary(ctrl: [number, number][]): (phi: number) => number {
  const pts = [...ctrl].sort((a, b) => a[0] - b[0]);
  return (phi: number) => {
    let d = (phi * 180) / Math.PI;
    d = ((d % 360) + 360) % 360;
    let i = pts.length - 1;
    for (let k = 0; k < pts.length; k++) if (pts[k][0] <= d) i = k;
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    let span = b[0] - a[0];
    if (span <= 0) span += 360;
    let x = d - a[0];
    if (x < 0) x += 360;
    const u = clamp(x / span, 0, 1);
    const w = (1 - Math.cos(Math.PI * u)) / 2;
    return a[1] + (b[1] - a[1]) * w;
  };
}
