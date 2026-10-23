import type { Shape } from "./shape";
import { type Rig, limbFrame } from "./rig";
import { type V3, TAU, angBump, catmull, clamp, lerp, superR, v3, vdot, vsub } from "./math";

const LEG_HULL = 16;
const HULL_CIRC = 1 / Math.cos(Math.PI / LEG_HULL);

/** Segmentos de todo anel do tronco (corpo e roupas compartilham os mesmos ângulos). */
export const TS = 28;
export const trunkAngle = (j: number) => (j / TS) * TAU;
const FRONT = Math.PI / 2;
const BACK = (3 * Math.PI) / 2;

/** Estação do tronco: seção superelíptica + relevos (cm). */
export interface Station {
  y: number;
  W: number;
  F: number;
  B: number;
  n: number;
  bust: number;
  pec: number;
  glute: number;
  belly: number;
  blade: number;
}
const KEYS: (keyof Station)[] = ["y", "W", "F", "B", "n", "bust", "pec", "glute", "belly", "blade"];

export function sectionR(phi: number, st: Station): number {
  let r = superR(phi, st.W, st.F, st.B, st.n);
  if (st.bust) r += st.bust * (angBump(phi, FRONT - 0.48, 0.4) + angBump(phi, FRONT + 0.48, 0.4));
  if (st.pec) r += st.pec * (angBump(phi, FRONT - 0.6, 0.42) + angBump(phi, FRONT + 0.6, 0.42));
  if (st.glute) r += st.glute * (angBump(phi, BACK - 0.55, 0.5) + angBump(phi, BACK + 0.55, 0.5));
  if (st.belly) r += st.belly * angBump(phi, FRONT, 0.75);
  if (st.blade) r += st.blade * (angBump(phi, BACK - 0.8, 0.38) + angBump(phi, BACK + 0.8, 0.38));
  return r;
}

function perimeter(st: Station): number {
  const N = 56;
  let p = 0;
  let px = 0, pz = 0;
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * TAU;
    const r = sectionR(phi, st);
    const x = r * Math.cos(phi), z = r * Math.sin(phi);
    if (i > 0) p += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return p;
}

/** Ajusta W (mantendo proporções) até o perímetro bater com a circunferência medida. */
function fitCirc(st: Station, C: number): Station {
  const k = (st.F + st.B) / (2 * st.W);
  const ff = st.F / (st.F + st.B);
  for (let it = 0; it < 4; it++) {
    const P = perimeter(st);
    st.W *= C / P;
    st.F = 2 * k * st.W * ff;
    st.B = 2 * k * st.W * (1 - ff);
  }
  return st;
}

function mk(y: number, W: number, k: number, ff: number, n: number, extra: Partial<Station> = {}): Station {
  return { y, W, F: 2 * k * W * ff, B: 2 * k * W * (1 - ff), n, bust: 0, pec: 0, glute: 0, belly: 0, blade: 0, ...extra };
}

/** Estações do tronco, do gancho à base do pescoço, a partir das medidas. */
export function trunkStations(s: Shape): Station[] {
  const f = s.fem;
  const L = (m: number, w: number) => lerp(m, w, f);
  const fat = Math.max(0, s.bmi - 25);
  const neckR = s.neckC / TAU;
  const mus = s.muscle;
  const belly = fat * 0.32 * (1 - 0.35 * f);
  const underbust = L(s.chest * 0.965, s.chest * 0.835);
  const st: Station[] = [];

  st.push(fitCirc(mk(s.crotchY - 1.2, 10, 0.64, 0.48, 2.1, { glute: L(0.4, 0.8) }), s.hip * 0.56));
  st.push(fitCirc(mk(s.crotchY + 2.5, 14, L(0.62, 0.6), L(0.47, 0.44), 2.15, { glute: L(0.8, 1.5) }), s.hip * L(0.93, 0.97)));
  st.push(fitCirc(mk(s.hipY, 16, L(0.62, 0.6), L(0.46, 0.42), 2.2, { glute: L(1.0, 2.0) }), s.hip));
  const hh = s.hipY + 0.5 * (s.waistY - s.hipY);
  st.push(fitCirc(mk(hh, 15, L(0.66, 0.66), 0.48, 2.05, { glute: L(0.3, 0.6), belly: belly * 0.7 }), lerp(s.hip, s.waist, L(0.55, 0.5))));
  st.push(
    fitCirc(mk(s.waistY, 14, L(0.74, 0.8) + fat * 0.006, L(0.52, 0.5) + fat * 0.005, 2.0, { belly, blade: 0 }), s.waist),
  );
  const ribs = s.waistY + 0.4 * (s.chestY - s.waistY);
  st.push(fitCirc(mk(ribs, 14, L(0.7, 0.74), 0.5, 2.05, { belly: belly * 0.35, blade: 0.2 }), lerp(s.waist, underbust, 0.66)));
  const ub = s.chestY - L(5.5, 5.5);
  st.push(fitCirc(mk(ub, 15, L(0.66, 0.72), 0.48, 2.15, { pec: L(0.5 + mus * 0.5, 0), bust: L(0, 0.9), blade: 0.5 }), underbust * L(1, 1.02)));

  // Linha do peito: no feminino o volume do busto completa a circunferência.
  const chest = mk(s.chestY, 16, L(0.6, 0.68), 0.47, 2.2, { pec: L(1.0 + mus * 0.9, 0.2), blade: 0.7 });
  if (f > 0.01) {
    fitCirc(chest, lerp(s.chest, underbust * 1.03, f));
    // relevo do busto até o perímetro alcançar a medida (secante)
    let a0 = 0, p0 = perimeter(chest);
    let a1 = 3 * f, p1 = 0;
    chest.bust = a1;
    p1 = perimeter(chest);
    for (let it = 0; it < 4 && Math.abs(p1 - s.chest) > 0.05; it++) {
      const a2 = a1 + ((s.chest - p1) * (a1 - a0)) / (p1 - p0 || 1);
      a0 = a1;
      p0 = p1;
      a1 = clamp(a2, 0, 9);
      chest.bust = a1;
      p1 = perimeter(chest);
    }
  } else {
    fitCirc(chest, s.chest);
  }
  st.push(chest);

  const armpitY = s.chestY + 0.45 * (s.shoulderY - s.chestY);
  st.push(
    fitCirc(
      mk(armpitY, 17, L(0.56, 0.62), 0.46, 2.3, { pec: L(0.8 + mus * 0.7, 0), bust: chest.bust * 0.32, blade: L(1.0, 0.7) }),
      L(s.chest * (1.0 + mus * 0.03), s.chest * 0.92),
    ),
  );
  const shW = s.shoulder / 2 - L(4.2, 3.6);
  st.push(mk(s.shoulderY - 1, shW, L(0.44, 0.46), 0.47, 2.5, { blade: 0.3 }));
  const trapW = neckR + L(4.2 + mus * 1.4, 2.4);
  st.push(mk(s.neckBaseY + 2.2, trapW, (neckR * 2.05) / (2 * trapW), 0.4, 2.2));
  st.push(mk(s.neckBaseY + 6.5, neckR * 0.86, 0.98, 0.48, 2));
  return st;
}

/** Interpola estações (Catmull-Rom nos parâmetros) na altura y. */
export function stationAt(st: Station[], y: number, out: Station): Station {
  const n = st.length;
  if (y <= st[0].y) return Object.assign(out, st[0], { y });
  if (y >= st[n - 1].y) return Object.assign(out, st[n - 1], { y });
  let i = 0;
  while (i < n - 2 && y > st[i + 1].y) i++;
  const a = st[Math.max(0, i - 1)], b = st[i], c = st[i + 1], d = st[Math.min(n - 1, i + 2)];
  const t = (y - b.y) / (c.y - b.y || 1);
  for (const k of KEYS) {
    if (k === "y") continue;
    // Catmull-Rom com limite para não "ondular" além dos vizinhos
    const v = catmull(a[k], b[k], c[k], d[k], t);
    const lo = Math.min(b[k], c[k]), hi = Math.max(b[k], c[k]);
    const span = (hi - lo) * 0.35 + 0.05;
    out[k] = clamp(v, lo - span, hi + span);
  }
  out.y = y;
  return out;
}

/** Perfil de seção da perna em t ∈ [−0.2, 2.1] (0 quadril, 1 joelho, 2 tornozelo). */
type ProfileTable = [number, number, number, number][];
const legCache = { a: NaN, b: NaN, c: NaN, T: [] as ProfileTable };
const armCache = { a: NaN, b: NaN, c: NaN, d: NaN, T: [] as ProfileTable };

export function legSection(s: Shape, t: number) {
  if (s.hip !== legCache.a || s.fem !== legCache.b || s.muscle !== legCache.c) {
    legCache.a = s.hip;
    legCache.b = s.fem;
    legCache.c = s.muscle;
    legCache.T = legTable(s);
  }
  return profileAt(legCache.T, t);
}

function legTable(s: Shape): ProfileTable {
  const f = s.fem;
  const L = (m: number, w: number) => lerp(m, w, f);
  const thigh = s.hip * L(0.6, 0.62);
  const knee = s.hip * L(0.37, 0.36);
  const calf = s.hip * 0.4 + s.muscle * 1.5;
  const ankle = s.hip * L(0.222, 0.212);
  const T: [number, number, number, number][] = [
    // t, circunferência, profundidade/largura, fração frontal
    [-0.14, thigh * 0.7, 0.9, 0.5],
    [-0.05, thigh * 0.92, 0.93, 0.5],
    [0.05, thigh, 0.95, 0.5],
    [0.22, thigh * 0.95, 0.98, 0.53],
    [0.45, thigh * 0.86, 1.0, 0.54],
    [0.7, thigh * 0.74, 1.0, 0.54],
    [0.88, knee * 1.06, 0.98, 0.53],
    [1.0, knee, 0.9, 0.55],
    [1.1, knee * 0.96, 0.95, 0.5],
    [1.3, calf, 1.06, 0.4],
    [1.55, calf * 0.87, 1.0, 0.43],
    [1.8, ankle * 1.15, 0.95, 0.5],
    [2.0, ankle, 0.85, 0.52],
    [2.12, ankle * 0.96, 0.85, 0.5],
  ];
  return T;
}

export function legBodyR(s: Shape, t: number, phi: number, lat: number, fem: number, pre?: { W: number; F: number; B: number }) {
  const sec = pre ?? legSection(s, t);
  let r = limbRadius(phi, sec.W, sec.F, sec.B);
  // joelho (patela), vasto lateral, curva do quadril feminino, panturrilha (só onde atuam)
  const dk = t - 0.98;
  if (dk * dk < 0.04) r += 0.55 * angBump(phi, Math.PI / 2, 0.45) * Math.exp(-(dk * dk) / 0.004);
  const dv = t - 0.45;
  if (dv * dv < 0.36) r += (0.5 + s.muscle * 0.6) * angBump(phi, lat + (lat === 0 ? 0.35 : -0.35), 0.6) * Math.exp(-(dv * dv) / 0.04);
  const dh = t - 0.08;
  if (fem > 0 && dh * dh < 0.18) r += fem * 0.9 * angBump(phi, lat, 0.7) * Math.exp(-(dh * dh) / 0.02);
  const dc = t - 1.31;
  if (dc * dc < 0.15) {
    r += (0.75 + s.muscle * 0.5) * angBump(phi, (3 * Math.PI) / 2 + (lat === 0 ? 0.9 : -0.9), 0.55) * Math.exp(-((t - 1.32) ** 2) / 0.014);
    r += 0.35 * angBump(phi, lat, 0.5) * Math.exp(-((t - 1.28) ** 2) / 0.01);
  }
  return r;
}

export function armBodyR(s: Shape, t: number, phi: number, lat: number) {
  const sec = armSection(s, t);
  let r = limbRadius(phi, sec.W, sec.F, sec.B);
  const m = s.muscle;
  // deltoide lateral, bíceps (frente), tríceps (trás)
  r += (0.6 + m * 0.9) * angBump(phi, lat, 0.75) * Math.exp(-((t - 0.02) ** 2) / 0.012);
  r += m * 0.7 * angBump(phi, Math.PI / 2, 0.5) * Math.exp(-((t - 0.45) ** 2) / 0.02);
  r += m * 0.5 * angBump(phi, (3 * Math.PI) / 2, 0.6) * Math.exp(-((t - 0.32) ** 2) / 0.02);
  r += m * 0.4 * angBump(phi, lat, 0.6) * Math.exp(-((t - 1.2) ** 2) / 0.01);
  return r;
}

/** Raio polar de uma seção elíptica de membro com frente/trás. */
export function limbRadius(phi: number, W: number, F: number, B: number) {
  const c = Math.cos(phi), s = Math.sin(phi);
  const D = s >= 0 ? F : B;
  return 1 / Math.sqrt((c * c) / (W * W) + (s * s) / (D * D));
}

/** Perfil de seção do braço em t ∈ [−0.2, 2.1] (0 ombro, 1 cotovelo, 2 punho). */
export function armSection(s: Shape, t: number) {
  if (s.chest !== armCache.a || s.fem !== armCache.b || s.muscle !== armCache.c || s.bmi !== armCache.d) {
    armCache.a = s.chest;
    armCache.b = s.fem;
    armCache.c = s.muscle;
    armCache.d = s.bmi;
    armCache.T = armTable(s);
  }
  return profileAt(armCache.T, t);
}

function armTable(s: Shape): ProfileTable {
  const f = s.fem;
  const L = (m: number, w: number) => lerp(m, w, f);
  const ref = s.chest * L(0.33, 0.3) + s.muscle * 2.4 + Math.max(0, s.bmi - 26) * 0.25;
  const T: [number, number, number, number][] = [
    [-0.17, ref * 0.4, 1.0, 0.5],
    [-0.1, ref * L(0.9, 0.84), 1.0, 0.5],
    [0.0, ref * L(1.12, 1.0), 0.98, 0.5],
    [0.14, ref * L(1.06, 0.98), 1.0, 0.5],
    [0.42, ref * 1.0, 1.06, 0.55],
    [0.75, ref * 0.86, 1.0, 0.5],
    [1.0, ref * 0.8, 0.95, 0.5],
    [1.18, ref * 0.84, 1.0, 0.5],
    [1.55, ref * 0.68, 1.1, 0.5],
    [2.0, ref * 0.52, 1.35, 0.5],
    [2.1, ref * 0.48, 1.3, 0.5],
  ];
  return T;
}

const prof = { W: 1, F: 1, B: 1, C: 1 };
function profileAt(T: [number, number, number, number][], t: number) {
  let i = 0;
  while (i < T.length - 2 && t > T[i + 1][0]) i++;
  const a = T[i], b = T[i + 1];
  const u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  const w = u * u * (3 - 2 * u);
  const C = lerp(a[1], b[1], w);
  const k = lerp(a[2], b[2], w);
  const ff = lerp(a[3], b[3], w);
  // perímetro da elipse com semieixos W e kW ≈ π W (3(1+k) − √((3+k)(1+3k)))
  const W = C / (Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k))));
  prof.W = W;
  prof.F = 2 * k * W * ff;
  prof.B = 2 * k * W * (1 - ff);
  prof.C = C;
  return prof;
}

/**
 * Tabela do tronco por altura de repouso (passo 1 cm): referencial do anel,
 * raio polar do corpo e "ocupação" (corpo + camadas já vestidas).
 */
export class TrunkField {
  readonly step = 1;
  y0 = 0;
  levels = 0;
  body = new Float32Array(0);
  occ = new Float32Array(0);
  taut = new Float32Array(0);
  frames = new Float32Array(0);
  stations: Station[] = [];
  shape!: Shape;
  rig!: Rig;
  private tmpSt = mk(0, 1, 1, 0.5, 2);
  private c = v3();
  private ax = v3();
  private az = v3();
  private lax = v3();
  private laz = v3();
  private legLoc: [number, number, number, number][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  /** Contorno real das duas pernas no plano do anel (16 pontos u,w por perna). */
  private legPts = new Float32Array(2 * LEG_HULL * 2);
  /** Ponto médio entre as pernas no anel (u, w) por nível — centro de saias e vestidos. */
  legMidU = new Float32Array(0);
  legMidW = new Float32Array(0);
  /** Raio extra das pernas vestidas (calças), por perna, amostrado em t ∈ [0, 2]. */
  legOuter: [Float32Array, Float32Array] = [new Float32Array(41), new Float32Array(41)];

  build(s: Shape, rig: Rig) {
    this.shape = s;
    this.rig = rig;
    this.stations = trunkStations(s);
    const top = s.neckBaseY + 8;
    const levels = Math.ceil(top / this.step) + 1;
    if (levels !== this.levels) {
      this.levels = levels;
      this.body = new Float32Array(levels * TS);
      this.occ = new Float32Array(levels * TS);
      this.frames = new Float32Array(levels * 9);
      this.legMidU = new Float32Array(levels);
      this.legMidW = new Float32Array(levels);
    }
    this.legMidU.fill(0);
    this.legMidW.fill(0);
    this.legOuter[0].fill(0);
    this.legOuter[1].fill(0);
    const { c, ax, az } = this;
    for (let l = 0; l < levels; l++) {
      const y = this.y0 + l * this.step;
      rig.frameAt(y, c, ax, az);
      const f = l * 9;
      this.frames[f] = c[0]; this.frames[f + 1] = c[1]; this.frames[f + 2] = c[2];
      this.frames[f + 3] = ax[0]; this.frames[f + 4] = ax[1]; this.frames[f + 5] = ax[2];
      this.frames[f + 6] = az[0]; this.frames[f + 7] = az[1]; this.frames[f + 8] = az[2];
      this.computeLevel(l, y, this.body);
    }
    this.occ.set(this.body);
  }

  /** Raio só da pelve/tronco (sem a envoltória das pernas) — fundo das calças. */
  pelvisR(y: number, phi: number) {
    stationAt(this.stations, y, this.tmpSt);
    return sectionR(phi, this.tmpSt);
  }

  /** Raio do corpo na altura y (pelve/tronco acima do gancho, envoltória das pernas abaixo). */
  private computeLevel(l: number, y: number, into: Float32Array, legsOnly = false) {
    const s = this.shape;
    const usePelvis = !legsOnly && y >= s.crotchY - 1.2;
    const useLegs = y < this.rig.yHJ + 6;
    if (usePelvis) stationAt(this.stations, y, this.tmpSt);
    if (useLegs) {
      this.locateLegs(l);
      this.legMidU[l] = (this.legLoc[0][0] + this.legLoc[1][0]) / 2;
      this.legMidW[l] = (this.legLoc[0][1] + this.legLoc[1][1]) / 2;
    }
    for (let j = 0; j < TS; j++) {
      const phi = trunkAngle(j);
      let r = usePelvis ? sectionR(phi, this.tmpSt) : 0;
      if (useLegs) {
        r = Math.max(r, this.hullR(phi));
      }
      into[l * TS + j] = legsOnly ? Math.max(into[l * TS + j], r) : r;
    }
  }

  /** Centro da perna no plano do anel (coordenadas locais) e seu parâmetro t. */
  private locateLegs(l: number) {
    const rig = this.rig;
    const f = l * 9;
    const c: V3 = [this.frames[f], this.frames[f + 1], this.frames[f + 2]];
    const ax: V3 = [this.frames[f + 3], this.frames[f + 4], this.frames[f + 5]];
    const az: V3 = [this.frames[f + 6], this.frames[f + 7], this.frames[f + 8]];
    const up: V3 = [ax[1] * az[2] - ax[2] * az[1], ax[2] * az[0] - ax[0] * az[2], ax[0] * az[1] - ax[1] * az[0]];
    // up = ax × az aponta para baixo (−y); invertemos
    up[0] = -up[0]; up[1] = -up[1]; up[2] = -up[2];
    const d = v3();
    for (let k = 0; k < 2; k++) {
      const leg = rig.legs[k];
      const pts = [leg.hip, leg.knee, leg.ankle];
      const h = pts.map((p) => vdot(vsub(d, p, c), up));
      let t = 0;
      let px = leg.hip[0], py = leg.hip[1], pz = leg.hip[2];
      if (h[0] <= 0) {
        // plano acima do quadril: usa o próprio quadril
        t = Math.max(-0.2, h[0] / 30);
      } else {
        let seg = 0;
        if (h[1] > 0) seg = 1;
        const a = pts[seg], b = pts[seg + 1];
        const ha = h[seg], hb = h[seg + 1];
        const u = clamp(ha / (ha - hb || 1e-6), 0, 1);
        px = a[0] + (b[0] - a[0]) * u;
        py = a[1] + (b[1] - a[1]) * u;
        pz = a[2] + (b[2] - a[2]) * u;
        t = seg + u;
      }
      const dx = px - c[0], dy = py - c[1], dz = pz - c[2];
      const loc = this.legLoc[k];
      loc[0] = dx * ax[0] + dy * ax[1] + dz * ax[2];
      loc[1] = dx * az[0] + dy * az[1] + dz * az[2];
      loc[2] = t;
      const extra = this.legExtra(k, t);
      // contorno exato da seção da perna (com relevos) + roupa, projetado no anel do tronco
      const a = t < 1 ? leg.hip : leg.knee, b = t < 1 ? leg.knee : leg.ankle;
      const tan: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const tl = Math.hypot(tan[0], tan[1], tan[2]) || 1;
      tan[0] /= tl; tan[1] /= tl; tan[2] /= tl;
      limbFrame(tan, leg.front, this.lax, this.laz);
      const lat = leg.side === 1 ? Math.PI : 0;
      let rMax = 0;
      const sec0 = legSection(this.shape, t);
      const sec = { W: sec0.W, F: sec0.F, B: sec0.B };
      const avg = (sec.W + (sec.F + sec.B) / 2) / 2;
      // perna inclinada (contrapposto): o corte do tubo pelo plano do anel é uma elipse
      // esticada — cada ponto da seção desliza ao longo da perna até o plano (projetar
      // ortogonalmente encolheria a seção e a roupa de cima atravessaria a calça)
      const tu = tan[0] * up[0] + tan[1] * up[1] + tan[2] * up[2];
      const tuSafe = Math.abs(tu) < 0.5 ? (tu < 0 ? -0.5 : 0.5) : tu;
      for (let i = 0; i < LEG_HULL; i++) {
        const phi = (i / LEG_HULL) * TAU;
        const body = legBodyR(this.shape, t, phi, lat, this.shape.fem, sec);
        // com calça: o raio da própria perna da calça (≈ circular), nunca menor que o corpo
        // (com calça, o polígono de 16 pontos circunscreve a perna redonda da peça)
        const r = extra > 0 ? Math.max(body + 0.25, avg + extra) * HULL_CIRC : body;
        rMax = Math.max(rMax, r);
        const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
        const ox = this.lax[0] * cs + this.laz[0] * sn;
        const oy = this.lax[1] * cs + this.laz[1] * sn;
        const oz = this.lax[2] * cs + this.laz[2] * sn;
        const sl = -(ox * up[0] + oy * up[1] + oz * up[2]) / tuSafe;
        const qx = dx + ox + tan[0] * sl;
        const qy = dy + oy + tan[1] * sl;
        const qz = dz + oz + tan[2] * sl;
        const o = (k * LEG_HULL + i) * 2;
        this.legPts[o] = qx * ax[0] + qy * ax[1] + qz * ax[2];
        this.legPts[o + 1] = qx * az[0] + qy * az[1] + qz * az[2];
      }
      loc[3] = rMax;
    }
  }

  private legExtra(k: number, t: number) {
    const a = this.legOuter[k];
    const x = clamp(t, 0, 2) * 20;
    const i = Math.floor(x);
    const u = x - i;
    return lerp(a[i], a[Math.min(40, i + 1)], u);
  }

  private hullR(phi: number) {
    const cx = Math.cos(phi), sz = Math.sin(phi);
    let h = 0;
    const P = this.legPts;
    for (let i = 0; i < P.length; i += 2) h = Math.max(h, P[i] * cx + P[i + 1] * sz);
    return h;
  }

  /** Recalcula a envoltória das pernas com as calças vestidas e soma à ocupação. */
  refreshLegs() {
    for (let l = 0; l < this.levels; l++) {
      const y = this.y0 + l * this.step;
      if (y >= this.rig.yHJ + 6) break;
      this.computeLevel(l, y, this.occ, true);
    }
  }

  private lv(y: number) {
    const x = clamp((y - this.y0) / this.step, 0, this.levels - 1.001);
    const l = Math.floor(x);
    return [l, x - l] as const;
  }

  frame(y: number, c: V3, ax: V3, az: V3) {
    const [l, u] = this.lv(y);
    const a = l * 9, b = a + 9, F = this.frames;
    for (let i = 0; i < 3; i++) {
      c[i] = F[a + i] + (F[b + i] - F[a + i]) * u;
      ax[i] = F[a + 3 + i] + (F[b + 3 + i] - F[a + 3 + i]) * u;
      az[i] = F[a + 6 + i] + (F[b + 6 + i] - F[a + 6 + i]) * u;
    }
  }

  private sample(arr: Float32Array, y: number, phi: number) {
    const [l, u] = this.lv(y);
    let x = (phi / TAU) * TS;
    x = ((x % TS) + TS) % TS;
    const j0 = Math.floor(x), j1 = (j0 + 1) % TS, v = x - j0;
    const a = arr[l * TS + j0] * (1 - v) + arr[l * TS + j1] * v;
    const b = arr[(l + 1) * TS + j0] * (1 - v) + arr[(l + 1) * TS + j1] * v;
    return a + (b - a) * u;
  }

  /** Centro entre as pernas (coordenadas do anel) na altura y. */
  legMid(y: number): [number, number] {
    const [l, u] = this.lv(y);
    return [lerp(this.legMidU[l], this.legMidU[l + 1], u), lerp(this.legMidW[l], this.legMidW[l + 1], u)];
  }

  /**
   * Ocupação "esticada": cada coluna recebe um fecho côncavo local (janela de ~7 cm),
   * como um tecido tenso que passa por cima de reentrâncias curtas (virilha, sob o busto)
   * sem perder curvas longas (cintura).
   */
  computeTaut(yMin: number, yMax: number) {
    if (this.taut.length !== this.occ.length) this.taut = new Float32Array(this.occ.length);
    const O = this.occ, T = this.taut;
    T.set(O);
    const W = 7;
    const lMax = Math.min(this.levels - 1, Math.floor((yMax - this.y0) / this.step));
    const lMin = Math.max(1, Math.floor((yMin - this.y0) / this.step));
    for (let j = 0; j < TS; j++) {
      for (let l = lMin; l < lMax; l++) {
        const r0 = O[l * TS + j];
        let best = r0;
        for (let a = 1; a <= W && l - a >= 0; a++) {
          const ra = O[(l - a) * TS + j];
          if (ra <= r0) continue;
          for (let b = 1; b <= W && l + b <= lMax; b++) {
            const rb = O[(l + b) * TS + j];
            if (rb <= r0) continue;
            const v = (ra * b + rb * a) / (a + b);
            if (v > best) best = v;
          }
        }
        T[l * TS + j] = best;
      }
    }
  }

  tautR(y: number, phi: number) {
    return this.sample(this.taut.length ? this.taut : this.occ, y, phi);
  }

  /** Versão esticada + suavizada em ângulo (saias e vestidos entre as pernas). */
  tautSmooth(y: number, phi: number, w = 0.32) {
    const a = this.tautR(y, phi);
    const b = this.tautR(y, phi - w);
    const c = this.tautR(y, phi + w);
    return Math.max(a, 0.5 * (a + Math.max(b, c)));
  }

  /** Ocupação com máximo numa janela angular (tecido que "ponteia" entre as pernas). */
  occSmooth(y: number, phi: number, w = 0.32) {
    const a = this.occR(y, phi);
    const b = this.occR(y, phi - w);
    const c = this.occR(y, phi + w);
    return Math.max(a, 0.5 * (a + Math.max(b, c)));
  }

  bodyR(y: number, phi: number) {
    return this.sample(this.body, y, phi);
  }

  occR(y: number, phi: number) {
    return this.sample(this.occ, y, phi);
  }

  /** Converte um ponto do mundo para (altura de repouso, ângulo polar, distância ao eixo). */
  localOf(P: V3, out: { y: number; phi: number; d: number }) {
    const { c, ax, az } = this;
    let y = P[1] - this.rig.ground - this.rig.drop;
    for (let it = 0; it < 2; it++) {
      this.frame(y, c, ax, az);
      y += P[1] - c[1];
    }
    this.frame(y, c, ax, az);
    const dx = P[0] - c[0], dy = P[1] - c[1], dz = P[2] - c[2];
    const u = dx * ax[0] + dy * ax[1] + dz * ax[2];
    const w = dx * az[0] + dy * az[1] + dz * az[2];
    out.y = y;
    out.phi = Math.atan2(w, u);
    if (out.phi < 0) out.phi += TAU;
    out.d = Math.hypot(u, w);
    return out;
  }

  /** Empurra P radialmente para fora até ficar a `margin` da ocupação atual. */
  pushOut(P: V3, margin: number, tmp: { y: number; phi: number; d: number }) {
    this.localOf(P, tmp);
    if (tmp.y > this.y0 + (this.levels - 2) * this.step) return false;
    const need = this.occR(tmp.y, tmp.phi) + margin;
    if (tmp.d >= need) return false;
    const { c, ax, az } = this;
    const cs = Math.cos(tmp.phi), sn = Math.sin(tmp.phi);
    const k = need - tmp.d;
    P[0] += (ax[0] * cs + az[0] * sn) * k;
    P[1] += (ax[1] * cs + az[1] * sn) * k;
    P[2] += (ax[2] * cs + az[2] * sn) * k;
    void c;
    return true;
  }

  /** Ponto no mundo: anel de altura y, ângulo φ, raio r. */
  point(y: number, phi: number, r: number, o: V3): V3 {
    const { c, ax, az } = this;
    this.frame(y, c, ax, az);
    const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
    o[0] = c[0] + ax[0] * cs + az[0] * sn;
    o[1] = c[1] + ax[1] * cs + az[1] * sn;
    o[2] = c[2] + ax[2] * cs + az[2] * sn;
    return o;
  }

  /** Normal da superfície ocupada (diferenças finitas), útil para alças e fitas. */
  normal(y: number, phi: number, lift: number, out: V3): V3 {
    const a = v3(), b = v3(), c2 = v3(), d = v3();
    const dp = 0.06, dy = 0.8;
    this.point(y, phi + dp, this.occR(y, phi + dp) + lift, a);
    this.point(y, phi - dp, this.occR(y, phi - dp) + lift, b);
    this.point(y + dy, phi, this.occR(y + dy, phi) + lift, c2);
    this.point(y - dy, phi, this.occR(y - dy, phi) + lift, d);
    const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
    const vx = c2[0] - d[0], vy = c2[1] - d[1], vz = c2[2] - d[2];
    // (d/dy) x (d/dphi) aponta para fora
    out[0] = vy * uz - vz * uy;
    out[1] = vz * ux - vx * uz;
    out[2] = vx * uy - vy * ux;
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l;
    out[1] /= l;
    out[2] /= l;
    return out;
  }

  /** Registra uma faixa vertical de casca (coluna j) na ocupação. */
  writeSpan(j: number, ya: number, ra: number, yb: number, rb: number) {
    if (yb < ya) {
      [ya, yb] = [yb, ya];
      [ra, rb] = [rb, ra];
    }
    const l0 = Math.max(0, Math.ceil((ya - this.y0) / this.step));
    const l1 = Math.min(this.levels - 1, Math.floor((yb - this.y0) / this.step));
    const jj = ((j % TS) + TS) % TS;
    for (let l = l0; l <= l1; l++) {
      const y = this.y0 + l * this.step;
      const r = yb > ya ? lerp(ra, rb, (y - ya) / (yb - ya)) : Math.max(ra, rb);
      const k = l * TS + jj;
      if (r > this.occ[k]) this.occ[k] = r;
    }
  }
}
