import type { MannequinBody, MannequinStyle } from "@/lib/types";
import type { BodyMeasurements } from "@/lib/provador/contract";
import { bodyLandmarks } from "@/lib/provador/landmarks";
import { lerp } from "./math";

/**
 * Parâmetros numéricos do corpo (cm). Todos interpoláveis: a transição entre
 * alturas, pesos e até entre corpo feminino e masculino é um lerp destes valores.
 */
export interface Shape {
  H: number;
  fem: number; // 0 masculino → 1 feminino
  bmi: number;
  muscle: number; // definição muscular (masculino atlético da referência)
  chest: number;
  waist: number;
  hip: number;
  shoulder: number;
  arm: number;
  headC: number;
  foot: number;
  neckC: number;
  chinY: number;
  neckBaseY: number;
  shoulderY: number;
  chestY: number;
  waistY: number;
  hipY: number;
  crotchY: number;
  kneeY: number;
  ankleY: number;
}

export const SHAPE_KEYS = [
  "H", "fem", "bmi", "muscle", "chest", "waist", "hip", "shoulder", "arm", "headC", "foot", "neckC",
  "chinY", "neckBaseY", "shoulderY", "chestY", "waistY", "hipY", "crotchY", "kneeY", "ankleY",
] as const satisfies readonly (keyof Shape)[];

export function shapeFromMeasurements(m: BodyMeasurements, body: MannequinBody): Shape {
  const L = bodyLandmarks(m);
  const fem = body === "feminino" ? 1 : 0;
  const refH = fem ? 166 : 178;
  const refBmi = fem ? 21 : 23.4;
  const neckC = (fem ? 30.5 : 37) * Math.sqrt(m.heightCm / refH) + (m.bmi - refBmi) * 0.45;
  // Masculino atlético por padrão; a definição some com IMC alto ou muito baixo.
  const muscle = fem ? 0 : Math.max(0, 1 - Math.abs(m.bmi - 24) / 9);
  return {
    H: m.heightCm,
    fem,
    bmi: m.bmi,
    muscle,
    chest: m.chestCm,
    waist: m.waistCm,
    hip: m.hipCm,
    shoulder: m.shoulderCm,
    arm: m.armLengthCm,
    headC: m.headCm,
    foot: m.footCm,
    neckC,
    chinY: L.chinY,
    neckBaseY: L.neckBaseY,
    shoulderY: L.shoulderY,
    chestY: L.chestY,
    waistY: L.waistY,
    hipY: L.hipY,
    crotchY: L.crotchY,
    kneeY: L.kneeY,
    ankleY: L.ankleY,
  };
}

/** Pose em parâmetros interpoláveis (radianos e cm). Lado L = esquerda do manequim (+x). */
export interface Pose {
  pelvisTilt: number;
  pelvisShift: number;
  pelvisTwist: number;
  chestTilt: number;
  chestShift: number;
  chestTwist: number;
  lean: number;
  headTilt: number;
  headNod: number;
  headTurn: number;
  lAnkleX: number; // afastamento lateral do tornozelo além da articulação do quadril
  lAnkleZ: number;
  rAnkleX: number;
  rAnkleZ: number;
  lToe: number; // abertura do pé (rad)
  rToe: number;
  lAbd: number; // abdução mínima do braço
  rAbd: number;
  lFlex: number;
  rFlex: number;
  lElbow: number;
  rElbow: number;
}

export const POSE_KEYS = [
  "pelvisTilt", "pelvisShift", "pelvisTwist", "chestTilt", "chestShift", "chestTwist", "lean",
  "headTilt", "headNod", "headTurn", "lAnkleX", "lAnkleZ", "rAnkleX", "rAnkleZ", "lToe", "rToe",
  "lAbd", "rAbd", "lFlex", "rFlex", "lElbow", "rElbow",
] as const satisfies readonly (keyof Pose)[];

/** Contrapposto: peso na perna direita, quadril direito alto, ombro esquerdo alto. */
const INFORMAL: Pose = {
  pelvisTilt: -0.065,
  pelvisShift: -2.6,
  pelvisTwist: 0.05,
  chestTilt: 0.05,
  chestShift: -0.6,
  chestTwist: -0.06,
  lean: 0.0,
  headTilt: -0.05,
  headNod: 0.02,
  headTurn: 0.1,
  lAnkleX: 5.5,
  lAnkleZ: 9,
  rAnkleX: -1.5,
  rAnkleZ: -1,
  lToe: 0.38,
  rToe: 0.16,
  lAbd: 0.11,
  rAbd: 0.15,
  lFlex: 0.1,
  rFlex: 0.02,
  lElbow: 0.42,
  rElbow: 0.16,
};

/** Vitrine: ereto, simétrico, queixo levemente alto. */
const FORMAL: Pose = {
  pelvisTilt: 0,
  pelvisShift: 0,
  pelvisTwist: 0,
  chestTilt: 0,
  chestShift: 0,
  chestTwist: 0,
  lean: -0.015,
  headTilt: 0,
  headNod: -0.035,
  headTurn: 0,
  lAnkleX: 0.6,
  lAnkleZ: 0,
  rAnkleX: 0.6,
  rAnkleZ: 0,
  lToe: 0.14,
  rToe: 0.14,
  lAbd: 0.085,
  rAbd: 0.085,
  lFlex: 0.03,
  rFlex: 0.03,
  lElbow: 0.12,
  rElbow: 0.12,
};

export const poseFor = (style: MannequinStyle): Pose => ({ ...(style === "formal" ? FORMAL : INFORMAL) });

export function cloneRecord<T extends object>(o: T): T {
  return { ...o };
}

/** Aproxima `cur` de `target` (in place). Retorna o maior delta restante. */
export function dampRecord<T extends object>(cur: T, target: T, keys: readonly (keyof T)[], k: number): number {
  let maxDelta = 0;
  const c = cur as Record<keyof T, number>;
  const t = target as Record<keyof T, number>;
  for (const key of keys) {
    const d = t[key] - c[key];
    if (Math.abs(d) < 1e-4) c[key] = t[key];
    else c[key] = lerp(c[key], t[key], k);
    maxDelta = Math.max(maxDelta, Math.abs(t[key] - c[key]));
  }
  return maxDelta;
}
