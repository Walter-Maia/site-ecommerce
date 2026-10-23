import type { BodyMeasurements } from "./contract";

/**
 * Alturas de referência do corpo (cm a partir do chão, sem calçado).
 * Fonte única para o cálculo de caimento (fit.ts) e para o manequim 3D,
 * para que "barra 3 cm abaixo do quadril" no texto seja o que se vê na cena.
 */
export interface BodyLandmarks {
  heightCm: number;
  headHeightCm: number; // queixo → topo
  chinY: number;
  neckBaseY: number; // base do pescoço (fúrcula)
  hpsY: number; // ponto alto do ombro, de onde se mede o comprimento de tops
  shoulderY: number; // acrômio
  chestY: number; // linha do busto/peito
  waistY: number; // cintura natural
  lowWaistY: number; // cintura baixa (cós de saia/jeans de cintura baixa)
  hipY: number; // maior circunferência do quadril
  crotchY: number; // gancho
  kneeY: number; // centro do joelho
  ankleY: number; // centro do tornozelo
}

export const HEAD_HEIGHT_PER_CIRC = 0.4; // altura da cabeça ≈ 40% da circunferência
export const NECK_PER_HEIGHT = 0.052; // pescoço (queixo → fúrcula) ≈ 5,2% da estatura

export function neckBaseHeight(heightCm: number, headCm: number): number {
  return heightCm - headCm * HEAD_HEIGHT_PER_CIRC - NECK_PER_HEIGHT * heightCm;
}

export function bodyLandmarks(m: BodyMeasurements): BodyLandmarks {
  const H = m.heightCm;
  const headH = m.headCm * HEAD_HEIGHT_PER_CIRC;
  const chinY = H - headH;
  const neckBaseY = neckBaseHeight(H, m.headCm);
  const waistY = neckBaseY - m.torsoLengthCm;
  const crotchY = m.inseamCm;
  const rise = waistY - crotchY;
  const ankleY = 0.045 * H;
  return {
    heightCm: H,
    headHeightCm: headH,
    chinY,
    neckBaseY,
    hpsY: neckBaseY + 4.5,
    shoulderY: neckBaseY - 1.5,
    chestY: neckBaseY - 0.45 * m.torsoLengthCm,
    waistY,
    lowWaistY: waistY - 7,
    hipY: crotchY + 0.34 * rise,
    crotchY,
    kneeY: ankleY + 0.555 * (crotchY - ankleY),
    ankleY,
  };
}
