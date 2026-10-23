import { Group, type Material, Mesh, Object3D } from "three";
import { Grid } from "./grid";
import { TS, type TrunkField, armBodyR, legBodyR, sectionR, stationAt, trunkAngle } from "./field";

export { armBodyR, legBodyR };
import { type Rig, Chain, headDims, limbFrame } from "./rig";
import type { Shape } from "./shape";
import { type V3, TAU, angBump, lerp, v3, vaddScaled, vnorm, vsub } from "./math";

export const ARM_SEGS = 12;
export const LEG_SEGS = 16;
export const HEAD_SEGS = 24;

/** Amostras t dos anéis dos membros (0 = articulação proximal, 1 = meio, 2 = distal). */
export const ARM_T = [-0.17, -0.12, -0.06, 0.02, 0.1, 0.22, 0.36, 0.5, 0.65, 0.8, 0.92, 1.0, 1.1, 1.22, 1.38, 1.55, 1.72, 1.88, 2.0, 2.1];
export const LEG_T = [-0.14, -0.07, 0, 0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.42, 1.55, 1.7, 1.85, 2.0, 2.12];

/** Subdivisões entre estações do tronco (topologia fixa). */
const TRUNK_SUBDIV = [1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1];

export function mkMesh(grid: Grid, mat: Material, parent: Object3D, name: string) {
  const m = new Mesh(grid.geometry, mat);
  m.name = name;
  m.frustumCulled = false;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Cadeia de um membro com extensão nas pontas, para t ∈ [−0.25, 2.15]. */
export class LimbPath {
  readonly chain = new Chain();
  private p0 = v3();
  private p4 = v3();
  private d = v3();
  joints: V3[] = [v3(), v3(), v3()];
  lens = [1, 1];

  set(a: V3, b: V3, c: V3, tail?: V3, headDir?: V3) {
    this.joints = [a, b, c];
    if (headDir) vnorm(this.d, headDir);
    else {
      vsub(this.d, a, b);
      vnorm(this.d, this.d);
    }
    this.lens = [Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2])];
    vaddScaled(this.p0, a, this.d, this.lens[0] * 0.3);
    if (tail) {
      this.p4[0] = tail[0];
      this.p4[1] = tail[1];
      this.p4[2] = tail[2];
    } else {
      vsub(this.d, c, b);
      vnorm(this.d, this.d);
      vaddScaled(this.p4, c, this.d, this.lens[1] * 0.3);
    }
    this.chain.set([this.p0, a, b, c, this.p4]);
    return this;
  }

  /** Distância ao longo da cadeia para o parâmetro t. */
  dist(t: number) {
    const [l0, l1] = this.lens;
    const head = l0 * 0.3;
    // t < 1: ao longo do primeiro osso (com extensão acima da articulação); t > 2 segue a ponta
    return t <= 1 ? head + t * l0 : head + l0 + (t - 1) * l1;
  }

  at(t: number, o: V3, tangent: V3) {
    return this.chain.at(Math.max(0, this.dist(t)), o, tangent, 5);
  }
}

const tmpC = v3();
const tmpT = v3();
const tmpAx = v3();
const tmpAz = v3();

/**
 * Escreve um membro (corpo ou roupa) numa grade: para cada anel t, centro e
 * referencial na cadeia; raio por coluna via `radius(t, φ)`.
 */
export function writeLimb(grid: Grid, path: LimbPath, ts: number[], front: V3, radius: (t: number, phi: number, ring: number) => number) {
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    path.at(t, tmpC, tmpT);
    limbFrame(tmpT, front, tmpAx, tmpAz);
    for (let j = 0; j <= grid.segs; j++) {
      const phi = (j / grid.segs) * TAU;
      const r = radius(t, phi, i);
      const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
      grid.set(i, j, tmpC[0] + tmpAx[0] * cs + tmpAz[0] * sn, tmpC[1] + tmpAx[1] * cs + tmpAz[1] * sn, tmpC[2] + tmpAx[2] * cs + tmpAz[2] * sn);
    }
  }
  grid.autoCaps();
  grid.commit();
}

/** Raio polar de uma seção elíptica de membro com frente/trás. */
export function limbR(phi: number, W: number, F: number, B: number) {
  const c = Math.cos(phi), s = Math.sin(phi);
  const D = s >= 0 ? F : B;
  return 1 / Math.sqrt((c * c) / (W * W) + (s * s) / (D * D));
}

export class BodyMeshes {
  readonly group = new Group();
  readonly headGroup = new Group();
  /** Filhos em coordenadas locais da cabeça (y = 0 no queixo). */
  readonly headLocal = new Group();
  readonly torso: Grid;
  readonly legs: [Grid, Grid];
  readonly arms: [Grid, Grid];
  readonly neck: Grid;
  readonly head: Grid;
  readonly ears: [Grid, Grid];
  readonly nose: Grid;
  readonly legPaths: [LimbPath, LimbPath] = [new LimbPath(), new LimbPath()];
  readonly armPaths: [LimbPath, LimbPath] = [new LimbPath(), new LimbPath()];
  readonly meshes: Mesh[] = [];
  private readonly trunkRows: number;
  private st = { y: 0, W: 1, F: 1, B: 1, n: 2, bust: 0, pec: 0, glute: 0, belly: 0, blade: 0 };

  constructor(skin: Material) {
    this.group.name = "body";
    this.trunkRows = 1 + TRUNK_SUBDIV.reduce((a, b) => a + b, 0);
    this.torso = new Grid(TS, this.trunkRows, { capStart: true, capEnd: true });
    this.legs = [new Grid(LEG_SEGS, LEG_T.length, { capStart: true, capEnd: true }), new Grid(LEG_SEGS, LEG_T.length, { capStart: true, capEnd: true })];
    this.arms = [new Grid(ARM_SEGS, ARM_T.length, { capStart: true, capEnd: true }), new Grid(ARM_SEGS, ARM_T.length, { capStart: true, capEnd: true })];
    this.neck = new Grid(12, 6, { capStart: true, capEnd: true });
    this.head = new Grid(HEAD_SEGS, HEAD_RINGS.length, { capStart: true, capEnd: true });
    this.ears = [new Grid(6, 4, { capStart: true, capEnd: true }), new Grid(6, 4, { capStart: true, capEnd: true })];
    this.nose = new Grid(4, 5, { capStart: true, capEnd: true });

    this.meshes.push(mkMesh(this.torso, skin, this.group, "torso"));
    this.legs.forEach((g, i) => this.meshes.push(mkMesh(g, skin, this.group, `leg${i}`)));
    this.arms.forEach((g, i) => this.meshes.push(mkMesh(g, skin, this.group, `arm${i}`)));
    this.meshes.push(mkMesh(this.neck, skin, this.group, "neck"));
    this.group.add(this.headGroup);
    this.headGroup.add(this.headLocal);
    this.meshes.push(mkMesh(this.head, skin, this.headLocal, "head"));
    this.ears.forEach((g, i) => this.meshes.push(mkMesh(g, skin, this.headLocal, `ear${i}`)));
    this.meshes.push(mkMesh(this.nose, skin, this.headLocal, "nose"));
  }

  /** Raio do tronco do corpo numa altura de repouso y (usado por tampas e testes). */
  updateTorso(field: TrunkField) {
    const st = field.stations;
    const g = this.torso;
    const c = tmpC, ax = tmpAx, az = tmpAz;
    let i = 0;
    for (let k = 0; k < st.length - 1; k++) {
      const n = TRUNK_SUBDIV[k] ?? 1;
      for (let q = 0; q < n; q++) {
        const y = lerp(st[k].y, st[k + 1].y, q / n);
        this.writeTrunkRing(field, i++, y, c, ax, az);
      }
    }
    this.writeTrunkRing(field, i, st[st.length - 1].y, c, ax, az);
    g.autoCaps();
    g.commit();
  }

  private writeTrunkRing(field: TrunkField, i: number, y: number, c: V3, ax: V3, az: V3) {
    stationAt(field.stations, y, this.st);
    field.frame(y, c, ax, az);
    for (let j = 0; j <= TS; j++) {
      const phi = trunkAngle(j);
      const r = sectionR(phi, this.st);
      const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
      this.torso.set(i, j, c[0] + ax[0] * cs + az[0] * sn, c[1] + ax[1] * cs + az[1] * sn, c[2] + ax[2] * cs + az[2] * sn);
    }
  }

  updateLegs(s: Shape, rig: Rig) {
    for (let k = 0; k < 2; k++) {
      const leg = rig.legs[k];
      const path = this.legPaths[k].set(leg.hip, leg.knee, leg.ankle, undefined, rig.pelvisUp);
      const lat = leg.side === 1 ? Math.PI : 0;
      const f = s.fem;
      writeLimb(this.legs[k], path, LEG_T, leg.front, (t, phi) => legBodyR(s, t, phi, lat, f));
    }
  }

  updateArms(s: Shape, rig: Rig) {
    for (let k = 0; k < 2; k++) {
      const arm = rig.arms[k];
      const path = this.armPaths[k].set(arm.shoulder, arm.elbow, arm.wrist);
      const lat = arm.side === 1 ? Math.PI : 0;
      writeLimb(this.arms[k], path, ARM_T, arm.front, (t, phi) => armBodyR(s, t, phi, lat));
    }
  }

  updateNeck(s: Shape, rig: Rig) {
    const g = this.neck;
    const r = s.neckC / TAU;
    const path = new Chain().set([rig.neckBase, rig.neckTop]);
    const front: V3 = [0, 0, 1];
    for (let i = 0; i < 6; i++) {
      path.at((i / 5) * path.total, tmpC, tmpT);
      limbFrame(tmpT, front, tmpAx, tmpAz);
      // base do pescoço abre em direção ao trapézio (sem "colar" na junção)
      const taper = i === 0 ? 1.3 : i === 1 ? 1.1 : i === 5 ? 0.96 : 1;
      for (let j = 0; j <= 12; j++) {
        const phi = (j / 12) * TAU;
        // pomo de adão discreto no masculino + tendões laterais
        const rr = r * taper * (1 + 0.04 * Math.cos(2 * phi)) + (1 - s.fem) * 0.35 * angBump(phi, Math.PI / 2, 0.35) * (i === 2 || i === 3 ? 1 : 0);
        const cs = Math.cos(phi) * rr, sn = Math.sin(phi) * rr * 1.04;
        g.set(i, j, tmpC[0] + tmpAx[0] * cs + tmpAz[0] * sn, tmpC[1] + tmpAx[1] * cs + tmpAz[1] * sn, tmpC[2] + tmpAx[2] * cs + tmpAz[2] * sn);
      }
    }
    g.autoCaps();
    g.commit();
  }

  /** Cabeça em coordenadas locais + transformação do grupo. */
  updateHead(s: Shape, rig: Rig) {
    buildHead(this.head, s);
    buildEars(this.ears, s);
    buildNose(this.nose, s);
    const R = rig.headR;
    this.headGroup.position.set(rig.headPos[0], rig.headPos[1], rig.headPos[2]);
    // matriz 3×3 (colunas) → quaternion
    const m = this.headGroup.matrix;
    m.set(R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, 0, 0, 0, 1);
    this.headGroup.quaternion.setFromRotationMatrix(m);
    this.headLocal.position.set(-rig.pivotLocal[0], -rig.pivotLocal[1], -rig.pivotLocal[2]);
  }

  dispose() {
    [this.torso, ...this.legs, ...this.arms, this.neck, this.head, this.nose, ...this.ears].forEach((g) => g.dispose());
  }
}

/* ───────────────────────── Cabeça ───────────────────────── */

/** h (fração da altura), W, F, B (frações), n */
export const HEAD_RINGS: [number, number, number, number, number][] = [
  [0.0, 0.22, 0.5, 0.1, 2],
  [0.05, 0.42, 0.72, 0.24, 2.1],
  [0.12, 0.6, 0.82, 0.42, 2.2],
  [0.2, 0.71, 0.87, 0.58, 2.3],
  [0.28, 0.79, 0.9, 0.74, 2.3],
  [0.36, 0.86, 0.9, 0.85, 2.3],
  [0.44, 0.91, 0.88, 0.93, 2.3],
  [0.52, 0.94, 0.88, 0.98, 2.3],
  [0.6, 0.96, 0.92, 1.0, 2.25],
  [0.7, 0.97, 0.88, 1.0, 2.2],
  [0.8, 0.92, 0.77, 0.95, 2.1],
  [0.89, 0.78, 0.6, 0.8, 2.05],
  [0.95, 0.55, 0.4, 0.56, 2],
  [1.0, 0.16, 0.12, 0.16, 2],
];

/** Relevos do rosto por anel: deslocamento (cm, cabeça de 56 cm) para |coluna − frente| = 0..4. */
const FACE: Record<number, number[]> = {
  1: [0.45, 0.2, 0, 0, 0],
  2: [0.2, 0.1, 0, 0, 0],
  3: [0.15, 0.08, -0.05, 0.05, 0],
  4: [0.22, 0.1, 0.05, 0.2, 0.1],
  5: [0.2, 0.12, 0.25, 0.45, 0.28],
  6: [0.15, 0.02, 0.1, 0.42, 0.3],
  7: [0.12, -0.04, 0.0, 0.1, 0.06],
  8: [0.16, 0.2, 0.22, 0.12, 0],
  9: [0.06, 0.04, 0.02, 0, 0],
};

export function headSurfaceR(s: Shape, ring: number) {
  const { headW, headD } = headDims(s);
  const [, w, f, b, n] = HEAD_RINGS[ring];
  let W = (headW / 2) * w;
  const male = 1 - s.fem;
  if (ring >= 1 && ring <= 3) W *= lerp(1.05, 0.93, s.fem); // mandíbula
  return { W, F: 0.52 * headD * f, B: 0.48 * headD * b, n, male };
}

function headR(s: Shape, ring: number, j: number) {
  const phi = (j / HEAD_SEGS) * TAU;
  const { W, F, B, n, male } = headSurfaceR(s, ring);
  let r = superRLocal(phi, W, F, B, n);
  const sc = s.headC / 56;
  const face = FACE[ring];
  if (face) {
    let d = Math.abs(j - HEAD_SEGS / 4);
    d = Math.min(d, HEAD_SEGS - d);
    if (d <= 4) {
      let off = face[d];
      if (ring === 8) off *= 1 + male * 0.6; // arco da sobrancelha
      r += off * sc;
    }
  }
  // ângulo da mandíbula masculina
  if (ring === 2 || ring === 3) r += male * 0.55 * sc * (angBump(phi, 0.35, 0.3) + angBump(phi, Math.PI - 0.35, 0.3));
  return r;
}

/** Raio da superfície do crânio (sem relevos do rosto) na fração de altura h ∈ [0, 1]. */
export function headShapeR(s: Shape, h: number, phi: number) {
  const R = HEAD_RINGS;
  let i = 0;
  while (i < R.length - 2 && h > R[i + 1][0]) i++;
  const u = Math.min(1, Math.max(0, (h - R[i][0]) / (R[i + 1][0] - R[i][0])));
  const a = headSurfaceR(s, i);
  const b = headSurfaceR(s, i + 1);
  return superRLocal(phi, lerp(a.W, b.W, u), lerp(a.F, b.F, u), lerp(a.B, b.B, u), lerp(a.n, b.n, u));
}

function superRLocal(phi: number, W: number, F: number, B: number, n: number) {
  const c = Math.abs(Math.cos(phi));
  const s = Math.sin(phi);
  const D = s >= 0 ? F : B;
  return Math.pow(Math.pow(c / W, n) + Math.pow(Math.abs(s) / D, n), -1 / n);
}

/** Cabeça facetada de manequim (coordenadas locais: y=0 no queixo, z=0 no eixo das orelhas). */
export function buildHead(g: Grid, s: Shape) {
  const { headH } = headDims(s);
  for (let i = 0; i < HEAD_RINGS.length; i++) {
    const y = HEAD_RINGS[i][0] * headH;
    // o rosto avança um pouco na parte de baixo (queixo)
    const zOff = i <= 2 ? 0.6 * (1 - i / 3) : 0;
    for (let j = 0; j <= HEAD_SEGS; j++) {
      const phi = (j / HEAD_SEGS) * TAU;
      const r = headR(s, i, j % HEAD_SEGS);
      g.set(i, j, Math.cos(phi) * r, y, Math.sin(phi) * r + zOff);
    }
  }
  g.autoCaps();
  g.commit();
}

/**
 * Nariz de manequim: prisma triangular facetado (ponte → ponta → base),
 * como na folha de referência — dois planos laterais e uma aresta frontal.
 */
function buildNose(g: Grid, s: Shape) {
  const { headH } = headDims(s);
  const sc = s.headC / 56;
  const big = lerp(1.08, 0.9, s.fem);
  // h, meia largura, projeção da aresta, recuo da base
  const R: [number, number, number][] = [
    [0.53, 0.38, 0.2],
    [0.45, 0.62, 0.8],
    [0.36, 0.86, 1.5],
    [0.315, 0.98, 1.72],
    [0.29, 0.6, 0.55],
  ];
  for (let i = 0; i < R.length; i++) {
    const [h, w, p] = R[i];
    const y = h * headH - (i === R.length - 1 ? 0.25 : 0);
    const face = headShapeR(s, h, Math.PI / 2) + 0.05;
    const W = w * sc * big, P = p * sc * big;
    // 4 colunas na ordem de φ do Grid (anéis descendo): −x, aresta frontal, +x, fundo
    const pts: [number, number][] = [
      [-W, face - 0.25],
      [0, face + P],
      [W, face - 0.25],
      [0, face - 1.4],
    ];
    for (let j = 0; j <= 4; j++) {
      const [x, z] = pts[j % 4];
      g.set(i, j, x, y, z);
    }
  }
  g.autoCaps();
  g.commit();
}

function buildEars(ears: [Grid, Grid], s: Shape) {
  const { headH, headW, headD } = headDims(s);
  for (let k = 0; k < 2; k++) {
    const side = k === 0 ? 1 : -1;
    const g = ears[k];
    const x0 = side * (headW / 2) * 0.9;
    for (let i = 0; i < 4; i++) {
      const h = lerp(0.34, 0.56, i / 3);
      const y = h * headH;
      const z = -0.06 * headD - (i / 3) * 0.6;
      const len = [0.5, 1.15, 1.2, 0.7][i];
      const thick = [0.25, 0.5, 0.5, 0.3][i];
      for (let j = 0; j <= 6; j++) {
        const phi = (j / 6) * TAU;
        const px = Math.cos(phi) * thick * (Math.cos(phi) * side > 0 ? 1 : 0.4);
        const pz = Math.sin(phi) * len * (s.headC / 56);
        g.set(i, j, x0 + px, y, z + pz);
      }
    }
    // a orelha direita é espelhada: inverte a ordem para manter as faces para fora
    if (side === -1) flipX(g);
    g.autoCaps();
    g.commit();
  }
}

/** Para geometrias construídas no lado esquerdo e espelhadas, mantém o enrolamento coerente. */
function flipX(g: Grid) {
  // A orelha é quase simétrica em z; reordenar colunas inverte o enrolamento.
  const tmp = new Float32Array(g.pos.length);
  tmp.set(g.pos);
  for (let i = 0; i < g.rows; i++)
    for (let j = 0; j <= g.segs; j++) {
      const src = (i * g.cols + (g.segs - j)) * 3;
      const dst = (i * g.cols + j) * 3;
      g.pos[dst] = tmp[src];
      g.pos[dst + 1] = tmp[src + 1];
      g.pos[dst + 2] = tmp[src + 2];
    }
}
