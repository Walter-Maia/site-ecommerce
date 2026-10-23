import { BufferAttribute, BufferGeometry } from "three";

export interface GridOptions {
  /** Anel fechado (com coluna de costura duplicada para UV). */
  closed?: boolean;
  capStart?: boolean;
  capEnd?: boolean;
  /** UV em cm (tecidos com padrão em escala física) ou normalizado 0–1. */
  uv?: "metric" | "normalized";
  /** Normais suaves (tecidos brilhantes como cetim); o padrão é facetado. */
  smooth?: boolean;
}

/**
 * Malha em grade (anéis × colunas) cujas posições são reescritas a cada
 * atualização, sem realocar. Topologia fixa → deformação em tempo real barata.
 * Enrolamento: vértice v(i,j) = centro_i + r·(cosφ_j·ax + sinφ_j·az), com
 * ax = t × az; triângulos (a, c, b) apontam para fora.
 */
export class Grid {
  readonly segs: number;
  readonly cols: number;
  readonly rows: number;
  readonly closed: boolean;
  readonly geometry = new BufferGeometry();
  readonly pos: Float32Array;
  readonly uv: Float32Array;
  private readonly uvMode: "metric" | "normalized";
  private readonly smooth: boolean;
  private readonly capS: number;
  private readonly capE: number;
  private readonly posAttr: BufferAttribute;
  private readonly uvAttr: BufferAttribute;

  constructor(segs: number, rows: number, opts: GridOptions = {}) {
    this.segs = segs;
    this.rows = rows;
    this.closed = opts.closed ?? true;
    this.cols = segs + 1;
    this.uvMode = opts.uv ?? "metric";
    this.smooth = opts.smooth ?? false;
    const nGrid = this.cols * rows;
    let n = nGrid;
    this.capS = opts.capStart ? n++ : -1;
    this.capE = opts.capEnd ? n++ : -1;
    this.pos = new Float32Array(n * 3);
    this.uv = new Float32Array(n * 2);

    const idx: number[] = [];
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * this.cols + j;
        const b = a + 1;
        const c = a + this.cols;
        const d = c + 1;
        // diagonais alternadas: facetas em "diamante" (menos listras no flat shading)
        if ((i + j) % 2 === 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, c, d, a, d, b);
      }
    }
    if (this.capS >= 0) for (let j = 0; j < segs; j++) idx.push(this.capS, j, j + 1);
    if (this.capE >= 0) {
      const base = (rows - 1) * this.cols;
      for (let j = 0; j < segs; j++) idx.push(this.capE, base + j + 1, base + j);
    }
    this.posAttr = new BufferAttribute(this.pos, 3);
    this.uvAttr = new BufferAttribute(this.uv, 2);
    this.geometry.setAttribute("position", this.posAttr);
    this.geometry.setAttribute("uv", this.uvAttr);
    this.geometry.setIndex(idx);
  }

  set(i: number, j: number, x: number, y: number, z: number) {
    const k = (i * this.cols + j) * 3;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.pos[k + 2] = z;
  }

  get(i: number, j: number, o: [number, number, number]) {
    const k = (i * this.cols + j) * 3;
    o[0] = this.pos[k];
    o[1] = this.pos[k + 1];
    o[2] = this.pos[k + 2];
    return o;
  }

  setCap(which: "start" | "end", x: number, y: number, z: number) {
    const v = which === "start" ? this.capS : this.capE;
    if (v < 0) return;
    this.pos[v * 3] = x;
    this.pos[v * 3 + 1] = y;
    this.pos[v * 3 + 2] = z;
  }

  /** Centro de um anel (média) — útil para tampas. */
  ringCenter(i: number, o: [number, number, number]) {
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < this.segs; j++) {
      const k = (i * this.cols + j) * 3;
      x += this.pos[k];
      y += this.pos[k + 1];
      z += this.pos[k + 2];
    }
    o[0] = x / this.segs;
    o[1] = y / this.segs;
    o[2] = z / this.segs;
    return o;
  }

  /** Fecha as tampas no centro do anel extremo (deslocado `inset` para dentro). */
  autoCaps() {
    const c: [number, number, number] = [0, 0, 0];
    if (this.capS >= 0) {
      this.ringCenter(0, c);
      this.setCap("start", c[0], c[1], c[2]);
    }
    if (this.capE >= 0) {
      this.ringCenter(this.rows - 1, c);
      this.setCap("end", c[0], c[1], c[2]);
    }
  }

  /** Recalcula UV (comprimento de arco em cm, ou 0–1) e sinaliza o envio à GPU. */
  commit() {
    const { cols, rows, pos, uv } = this;
    if (this.uvMode === "normalized") {
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          const k = (i * cols + j) * 2;
          uv[k] = j / this.segs;
          uv[k + 1] = i / Math.max(1, rows - 1);
        }
    } else {
      for (let i = 0; i < rows; i++) {
        let u = 0;
        for (let j = 0; j < cols; j++) {
          const k = i * cols + j;
          if (j > 0) {
            const p = (k - 1) * 3;
            u += Math.hypot(pos[k * 3] - pos[p], pos[k * 3 + 1] - pos[p + 1], pos[k * 3 + 2] - pos[p + 2]);
          }
          uv[k * 2] = u;
        }
      }
      for (let j = 0; j < cols; j++) {
        let v = 0;
        for (let i = 0; i < rows; i++) {
          const k = i * cols + j;
          if (i > 0) {
            const p = (k - cols) * 3;
            v += Math.hypot(pos[k * 3] - pos[p], pos[k * 3 + 1] - pos[p + 1], pos[k * 3 + 2] - pos[p + 2]);
          }
          uv[k * 2 + 1] = v;
        }
      }
    }
    this.posAttr.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
    if (this.smooth) {
      this.geometry.computeVertexNormals();
      // linhas colapsadas geram normais nulas → NaN no shader (e o bloom espalha o preto)
      const nAttr = this.geometry.getAttribute("normal");
      const n = nAttr.array as Float32Array;
      for (let i = 0; i < n.length; i += 3) {
        if (n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2] < 1e-10) {
          n[i] = 0;
          n[i + 1] = 1;
          n[i + 2] = 0;
        }
      }
      nAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.geometry.dispose();
  }
}

/** Ângulo da coluna j numa grade fechada de `segs` segmentos. */
export const colAngle = (j: number, segs: number) => (j / segs) * Math.PI * 2;
