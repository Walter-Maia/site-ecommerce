import type { Pose, Shape } from "./shape";
import {
  type V3, lerp, m3apply, m3fromEuler, m3identity, m3mul, smoothstep, v3, vadd, vaddScaled,
  vcopy, vcross, vdist, vnorm, vortho, vset, vsub,
} from "./math";

export interface LegRig {
  side: 1 | -1;
  hip: V3;
  knee: V3;
  ankle: V3;
  front: V3; // direção do joelho (polo)
  toe: V3; // frente do pé (horizontal)
  thighL: number;
  shinL: number;
}

export interface ArmRig {
  side: 1 | -1;
  abd: number;
  shoulder: V3;
  elbow: V3;
  wrist: V3;
  tip: V3;
  front: V3;
  upperL: number;
  foreL: number;
  handL: number;
}

/** Medidas derivadas usadas por várias partes (cm). */
export function headDims(s: Shape) {
  const headH = s.headC * 0.4;
  const headW = s.headC * lerp(0.268, 0.258, s.fem); // largura total
  const headD = s.headC * 0.345; // profundidade total
  return { headH, headW, headD };
}

/**
 * Esqueleto resolvido a cada atualização. Alturas "de repouso" (landmarks) são
 * mapeadas para o mundo pelos referenciais da pelve e do peito (contrapposto).
 */
export class Rig {
  ground = 0;
  drop = 0;
  yHJ = 90;
  hjx = 8;
  pelvisO = v3();
  pelvisR = m3identity();
  chestO = v3();
  chestR = m3identity();
  headR = m3identity();
  headPos = v3();
  neckBase = v3();
  neckTop = v3();
  pivotLocal = v3();
  /** Eixo vertical da pelve (topo das pernas sobe por ele). */
  pelvisUp = v3(0, 1, 0);
  legs: [LegRig, LegRig] = [mkLeg(1), mkLeg(-1)];
  arms: [ArmRig, ArmRig] = [mkArm(1), mkArm(-1)];
  private s!: Shape;
  private t0 = v3();
  private t1 = v3();
  private t2 = v3();
  private t3 = v3();

  solve(s: Shape, p: Pose, ground: number) {
    this.s = s;
    this.ground = ground;
    const rise = s.waistY - s.crotchY;
    this.yHJ = s.crotchY + 0.3 * rise;
    this.hjx = s.hip * lerp(0.086, 0.094, s.fem);
    m3fromEuler(this.pelvisR, 0, p.pelvisTwist, p.pelvisTilt);
    m3fromEuler(this.chestR, p.lean, p.chestTwist, p.chestTilt);

    // Queda da pelve para a perna de apoio ficar estendida com o pé no chão.
    const ankleY = ground + s.ankleY;
    let drop = 0;
    const L = [this.legs[0], this.legs[1]];
    for (const leg of L) {
      leg.thighL = this.yHJ - s.kneeY;
      leg.shinL = s.kneeY - s.ankleY;
      const ax = leg.side === 1 ? p.lAnkleX : p.rAnkleX;
      const az = leg.side === 1 ? p.lAnkleZ : p.rAnkleZ;
      vset(leg.ankle, leg.side * (this.hjx + ax), ankleY, az);
    }
    vset(this.pelvisO, p.pelvisShift, ground + this.yHJ, 0);
    let first = true;
    for (const leg of L) {
      m3apply(this.t0, this.pelvisR, leg.side * this.hjx, 0, 0);
      vadd(this.t0, this.t0, this.pelvisO);
      const len = (leg.thighL + leg.shinL) * 0.996;
      const dx = this.t0[0] - leg.ankle[0];
      const dz = this.t0[2] - leg.ankle[2];
      const hy = leg.ankle[1] + Math.sqrt(Math.max(1, len * len - dx * dx - dz * dz));
      const d = hy - this.t0[1];
      drop = first ? d : Math.min(drop, d);
      first = false;
    }
    this.drop = drop;
    this.pelvisO[1] += drop;
    vset(this.chestO, p.chestShift, ground + s.chestY + drop, 0);
    m3apply(this.pelvisUp, this.pelvisR, 0, 1, 0);

    for (const leg of L) {
      m3apply(leg.hip, this.pelvisR, leg.side * this.hjx, 0, 0);
      vadd(leg.hip, leg.hip, this.pelvisO);
      const toe = leg.side === 1 ? p.lToe : p.rToe;
      vset(leg.toe, leg.side * Math.sin(toe), 0, Math.cos(toe));
      vset(this.t1, leg.side * Math.sin(toe * 0.55), 0, Math.cos(toe * 0.55));
      this.ik(leg.hip, leg.ankle, leg.thighL, leg.shinL, this.t1, leg.knee);
      vcopy(leg.front, this.t1);
    }

    // Pescoço e cabeça
    const { headH, headD } = headDims(s);
    m3apply(this.t0, this.chestR, 0, s.neckBaseY - s.chestY - 2.5, -2.2);
    vadd(this.neckBase, this.chestO, this.t0);
    const pivotY = s.chinY + 0.24 * headH;
    m3apply(this.t0, this.chestR, 0, pivotY - s.chestY, -1.3);
    vadd(this.headPos, this.chestO, this.t0);
    const hr = m3identity();
    m3fromEuler(hr, p.headNod, p.headTurn, p.headTilt);
    m3mul(this.headR, this.chestR, hr);
    vset(this.pivotLocal, 0, 0.24 * headH, -0.04 * headD);
    this.headPoint(0, 0.2 * headH, -0.06 * headD, this.neckTop);
  }

  /** Ponto em coordenadas locais da cabeça (y=0 no queixo, z=0 no eixo das orelhas) → mundo. */
  headPoint(x: number, y: number, z: number, o: V3): V3 {
    m3apply(o, this.headR, x - this.pivotLocal[0], y - this.pivotLocal[1], z - this.pivotLocal[2]);
    return vadd(o, o, this.headPos);
  }

  /** Braços: abdução final vem do teste de folga contra o tronco vestido. */
  solveArm(arm: ArmRig, p: Pose, abd: number) {
    const s = this.s;
    arm.abd = abd;
    const side = arm.side;
    const sjx = s.shoulder / 2 - lerp(4.7, 4.1, s.fem);
    const sjy = s.shoulderY - lerp(4.2, 3.6, s.fem);
    m3apply(arm.shoulder, this.chestR, side * sjx, sjy - s.chestY, -0.9);
    vadd(arm.shoulder, arm.shoulder, this.chestO);
    arm.upperL = s.arm * 0.545;
    arm.foreL = s.arm * 0.455;
    arm.handL = s.H * 0.106;
    const flex = side === 1 ? p.lFlex : p.rFlex;
    const elbow = side === 1 ? p.lElbow : p.rElbow;
    // braço: (0,-1,0) abduzido em z e flexionado para frente
    const sa = Math.sin(abd), ca = Math.cos(abd);
    const x = side * sa, y = -ca;
    const dir = this.t0;
    m3apply(dir, this.chestR, x, y * Math.cos(flex), -y * Math.sin(flex));
    vnorm(dir, dir);
    vaddScaled(arm.elbow, arm.shoulder, dir, arm.upperL);
    m3apply(this.t1, this.chestR, -side * 0.12, 0, 1);
    vortho(arm.front, this.t1, dir);
    // antebraço dobra para frente e levemente para dentro
    const fore = this.t2;
    vset(fore, dir[0] * Math.cos(elbow) + arm.front[0] * Math.sin(elbow), dir[1] * Math.cos(elbow) + arm.front[1] * Math.sin(elbow), dir[2] * Math.cos(elbow) + arm.front[2] * Math.sin(elbow));
    fore[0] -= side * 0.03;
    vnorm(fore, fore);
    vaddScaled(arm.wrist, arm.elbow, fore, arm.foreL);
    const hand = this.t3;
    vaddScaled(hand, fore, arm.front, 0.08);
    vnorm(hand, hand);
    vaddScaled(arm.tip, arm.wrist, hand, arm.handL);
  }

  /** Referencial do anel do tronco na altura de repouso y. Retorna o fator de mistura pelve→peito. */
  frameAt(y: number, c: V3, ax: V3, az: V3): number {
    const s = this.s;
    const b = smoothstep(s.hipY + 2, s.chestY - 2, y);
    const t0 = this.t0, t1 = this.t1;
    m3apply(t0, this.pelvisR, 0, y - this.yHJ, 0);
    vadd(t0, t0, this.pelvisO);
    m3apply(t1, this.chestR, 0, y - s.chestY, 0);
    vadd(t1, t1, this.chestO);
    c[0] = lerp(t0[0], t1[0], b);
    c[1] = lerp(t0[1], t1[1], b);
    c[2] = lerp(t0[2], t1[2], b);
    const P = this.pelvisR, C = this.chestR;
    vset(ax, lerp(P[0], C[0], b), lerp(P[1], C[1], b), lerp(P[2], C[2], b));
    vnorm(ax, ax);
    vset(az, lerp(P[6], C[6], b), lerp(P[7], C[7], b), lerp(P[8], C[8], b));
    vortho(az, az, ax);
    return b;
  }

  /** IK de dois ossos no plano definido pelo polo. */
  private ik(a: V3, target: V3, l1: number, l2: number, pole: V3, outKnee: V3) {
    const d0 = vdist(a, target);
    const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 0.1), l1 + l2 - 0.05);
    const dir = vsub(this.t2, target, a);
    vnorm(dir, dir);
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const perp = vortho(this.t3, pole, dir);
    vaddScaled(outKnee, a, dir, along);
    vaddScaled(outKnee, outKnee, perp, h);
  }
}

function mkLeg(side: 1 | -1): LegRig {
  return { side, hip: v3(), knee: v3(), ankle: v3(), front: v3(0, 0, 1), toe: v3(0, 0, 1), thighL: 40, shinL: 40 };
}

function mkArm(side: 1 | -1): ArmRig {
  return { side, abd: 0.1, shoulder: v3(), elbow: v3(), wrist: v3(), tip: v3(), front: v3(0, 0, 1), upperL: 30, foreL: 25, handL: 18 };
}

/** Ponto e tangente ao longo de uma cadeia (polilinha) suavizada nas articulações. */
export class Chain {
  pts: V3[] = [];
  lens: number[] = [];
  total = 0;
  private tmp = v3();
  private tmp2 = v3();

  set(points: V3[]) {
    this.pts = points;
    this.lens = [];
    this.total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const l = vdist(points[i], points[i + 1]);
      this.lens.push(l);
      this.total += l;
    }
    return this;
  }

  /** Posição na distância `d` ao longo da cadeia (extrapola nas pontas). */
  at(d: number, o: V3, tangent?: V3, smooth = 4): V3 {
    const { pts, lens } = this;
    let i = 0;
    let acc = 0;
    while (i < lens.length - 1 && d > acc + lens[i]) {
      acc += lens[i];
      i++;
    }
    const t = (d - acc) / (lens[i] || 1);
    o[0] = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
    o[1] = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
    o[2] = pts[i][2] + (pts[i + 1][2] - pts[i][2]) * t;
    if (tangent) {
      this.segDir(i, tangent);
      // suaviza a tangente perto das juntas
      const local = d - acc;
      if (i > 0 && local < smooth) {
        this.segDir(i - 1, this.tmp);
        const w = 0.5 * (1 - local / smooth);
        blendDir(tangent, this.tmp, w, this.tmp2);
      } else if (i < lens.length - 1 && lens[i] - local < smooth) {
        this.segDir(i + 1, this.tmp);
        const w = 0.5 * (1 - (lens[i] - local) / smooth);
        blendDir(tangent, this.tmp, w, this.tmp2);
      }
    }
    return o;
  }

  segDir(i: number, o: V3) {
    vsub(o, this.pts[i + 1], this.pts[i]);
    return vnorm(o, o);
  }
}

function blendDir(t: V3, other: V3, w: number, tmp: V3) {
  vset(tmp, t[0] * (1 - w) + other[0] * w, t[1] * (1 - w) + other[1] * w, t[2] * (1 - w) + other[2] * w);
  vnorm(t, tmp);
}

/** Referencial de anel ao longo de um membro: az = frente ortogonalizada; ax = t × az. */
export function limbFrame(t: V3, front: V3, ax: V3, az: V3) {
  vortho(az, front, t);
  vcross(ax, t, az);
  vnorm(ax, ax);
}
