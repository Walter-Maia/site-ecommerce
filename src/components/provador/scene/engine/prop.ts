import { BoxGeometry, type BufferGeometry, CylinderGeometry, Group, type Material, Matrix4, Mesh, type Texture } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GarmentSpec } from "@/lib/types";
import { Grid } from "./grid";
import { type V3, lerp, v3, vcross, vnorm, vortho } from "./math";
import { type RimUniforms, fabricMaterial, plainMaterial } from "./materials";
import { deckBottomTexture, gripTexture } from "./textures";

/**
 * Skate completo procedural (cm). Referencial local: x = largura, y = normal da lixa
 * (para cima com o skate no chão), z = comprimento (nose em +z). Origem no centro da
 * face de baixo do shape. Geometria estática: só a matriz muda a cada pose.
 */

/** Shape 8,25" × 32": largura, comprimento ponta a ponta, espessura, concave, kicks. */
export const DECK = {
  width: 21,
  length: 81,
  thick: 1.15,
  concave: 0.55,
  kick: 5.2, // quanto as pontas sobem
  kickStart: 25, // |z| onde o kick começa
  truckZ: 19.5, // eixo dos trucks
  axleDrop: 5.4, // da face de baixo até o eixo
  wheelR: 2.65, // roda 53 mm
  wheelW: 3.1,
  wheelX: 8.6,
} as const;

/** Altura (y local) da face de baixo do shape em z (kick nas pontas). */
export function deckRise(z: number) {
  const a = Math.abs(z) - DECK.kickStart;
  if (a <= 0) return 0;
  const span = DECK.length / 2 - DECK.kickStart;
  const u = a / span;
  // curva suave que termina inclinada (~20°)
  return DECK.kick * (0.55 * u * u + 0.45 * u);
}

/** Meia largura do contorno "popsicle" em z (pontas semicirculares). */
export function deckHalfWidth(z: number) {
  const R = DECK.width / 2;
  const a = Math.abs(z) - (DECK.length / 2 - R);
  if (a <= 0) return R;
  return R * Math.sqrt(Math.max(0, 1 - (a / R) ** 2));
}

/** Linhas ao longo do comprimento: densas nas pontas (contorno redondo). */
function deckRows(): number[] {
  const H = DECK.length / 2;
  const R = DECK.width / 2;
  const tip = [H, H - 0.4, H - 1.4, H - 3, H - 5.2, H - 7.8, H - R];
  const mid: number[] = [];
  for (let k = 1; k < 8; k++) mid.push(lerp(H - R, -(H - R), k / 8));
  const rows = [...tip.map((z) => -z), ...mid.reverse().map((z) => -z), ...tip.slice().reverse()];
  // ordena de −H (tail) a +H (nose)
  return rows.sort((a, b) => a - b);
}

const COLS = 8;

function surface(rows: number[], top: boolean): BufferGeometry {
  const g = new Grid(COLS, rows.length, { closed: false, uv: "normalized" });
  const y0 = top ? DECK.thick : 0;
  for (let i = 0; i < rows.length; i++) {
    const z = rows[i];
    const hw = Math.max(0.01, deckHalfWidth(z));
    for (let j = 0; j <= COLS; j++) {
      const u = j / COLS;
      // face de cima: da borda +x para −x; de baixo: o contrário (normais para fora)
      const x = top ? lerp(hw, -hw, u) : lerp(-hw, hw, u);
      const cv = DECK.concave * (x / (DECK.width / 2)) ** 2;
      g.set(i, j, x, y0 + cv + deckRise(z), z);
    }
  }
  g.commit();
  // UV: u = largura (0 = borda −x), v = comprimento (0 = tail)
  for (let i = 0; i < rows.length; i++)
    for (let j = 0; j <= COLS; j++) {
      const k = (i * g.cols + j) * 2;
      const hw = Math.max(0.01, deckHalfWidth(rows[i]));
      const x = top ? lerp(hw, -hw, j / COLS) : lerp(-hw, hw, j / COLS);
      g.uv[k] = 0.5 + x / DECK.width;
      g.uv[k + 1] = (rows[i] + DECK.length / 2) / DECK.length;
    }
  return g.geometry;
}

/** Borda (laminado) ligando as faces de cima e de baixo ao longo do contorno. */
function edge(rows: number[]): BufferGeometry {
  const ring: [number, number][] = [];
  for (const z of rows) ring.push([deckHalfWidth(z), z]);
  for (let k = rows.length - 1; k >= 0; k--) ring.push([-deckHalfWidth(rows[k]), rows[k]]);
  const g = new Grid(ring.length, 2, { closed: true, uv: "normalized" });
  for (let j = 0; j <= ring.length; j++) {
    const [x, z] = ring[j % ring.length];
    const cv = DECK.concave * (x / (DECK.width / 2)) ** 2;
    const y = cv + deckRise(z);
    g.set(0, j, x, y, z);
    g.set(1, j, x, y + DECK.thick, z);
  }
  g.commit();
  return g.geometry;
}

function trucks(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const zs of [-1, 1]) {
    const z = zs * DECK.truckZ;
    const zb = z - zs * 1.2; // base levemente para dentro do eixo
    const base = new BoxGeometry(5.6, 0.9, 7.4);
    base.translate(0, -0.45, zb);
    parts.push(base);
    const neck = new BoxGeometry(2.6, 2.4, 3.2);
    neck.translate(0, -2.0, zb + zs * 0.6);
    parts.push(neck);
    const bush = new CylinderGeometry(1.3, 1.3, 2.2, 7);
    bush.translate(0, -2.1, zb - zs * 1.4);
    parts.push(bush);
    const hanger = new BoxGeometry(12.5, 1.8, 2.6);
    hanger.translate(0, -DECK.axleDrop + 0.5, z);
    parts.push(hanger);
    const axle = new CylinderGeometry(0.42, 0.42, 2 * (DECK.wheelX + DECK.wheelW / 2 + 0.4), 6);
    axle.rotateZ(Math.PI / 2);
    axle.translate(0, -DECK.axleDrop, z);
    parts.push(axle);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

function wheels(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const zs of [-1, 1])
    for (const xs of [-1, 1]) {
      const w = new CylinderGeometry(DECK.wheelR, DECK.wheelR, DECK.wheelW, 12, 1);
      // borda levemente chanfrada: encolhe o anel externo
      w.rotateZ(Math.PI / 2);
      w.translate(xs * DECK.wheelX, -DECK.axleDrop, zs * DECK.truckZ);
      parts.push(w.toNonIndexed());
      w.dispose();
    }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Pontos de controle (local) usados para apoiar o skate no chão e testar colisões. */
export const DECK_PROBES: V3[] = (() => {
  const pts: V3[] = [];
  for (const z of [-DECK.length / 2, -DECK.length / 2 + 2, -DECK.length / 2 + 5, DECK.length / 2 - 2, DECK.length / 2]) {
    const hw = deckHalfWidth(z);
    for (const x of [-hw, 0, hw]) for (const y of [0, DECK.thick]) pts.push(v3(x, y + deckRise(z) + DECK.concave * (x / (DECK.width / 2)) ** 2, z));
  }
  for (const zs of [-1, 1]) for (const xs of [-1, 1]) pts.push(v3(xs * DECK.wheelX, -DECK.axleDrop - DECK.wheelR, zs * DECK.truckZ));
  return pts;
})();

export class Skateboard {
  readonly group = new Group();
  readonly meshes: Mesh[] = [];
  private geos: BufferGeometry[] = [];
  private mats: Material[] = [];
  private texs: Texture[] = [];
  private m = new Matrix4();

  constructor(spec: GarmentSpec, rim: RimUniforms, parent: Group) {
    const rows = deckRows();
    const gripT = gripTexture();
    const bottomT = deckBottomTexture(spec.colors.base, spec.colors.secondary, spec.colors.trim, spec.graphic);
    this.texs.push(gripT, bottomT);
    const gripM = fabricMaterial("solid", gripT, rim);
    (gripM as unknown as { roughness: number }).roughness = 0.97;
    const bottomM = fabricMaterial("solid", bottomT, rim);
    (bottomM as unknown as { roughness: number }).roughness = 0.5;
    const plyM = plainMaterial("#d8b98a", rim, 0.7);
    const metalM = plainMaterial("#b4b9c0", rim, 0.32, 0.65);
    // rodas de uretano off-white (o spec não define cor de roda)
    const wheelM = plainMaterial("#f1ece0", rim, 0.45);
    this.mats.push(gripM, bottomM, plyM, metalM, wheelM);
    const parts: [BufferGeometry, Material, string][] = [
      [surface(rows, true), gripM, "deckGrip"],
      [surface(rows, false), bottomM, "deckBottom"],
      [edge(rows), plyM, "deckEdge"],
      [trucks(), metalM, "trucks"],
      [wheels(), wheelM, "wheels"],
    ];
    for (const [geo, mat, name] of parts) {
      geo.computeBoundingSphere();
      const mesh = new Mesh(geo, mat);
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      this.geos.push(geo);
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.group.name = "skateboard";
    parent.add(this.group);
  }

  /** Posiciona pelo referencial (colunas X, Y, Z) e pela origem O, em cm. */
  place(O: V3, X: V3, Y: V3, Z: V3) {
    this.m.set(X[0], Y[0], Z[0], O[0], X[1], Y[1], Z[1], O[1], X[2], Y[2], Z[2], O[2], 0, 0, 0, 1);
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(this.m);
    this.group.matrixWorldNeedsUpdate = true;
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.group.removeFromParent();
  }
}

/** Referencial do skate em pé: eixo Z da ponta do tail à ponta do nose; Y = lixa. */
export function boardFrame(tail: V3, nose: V3, bottomHint: V3, X: V3, Y: V3, Z: V3) {
  Z[0] = nose[0] - tail[0];
  Z[1] = nose[1] - tail[1];
  Z[2] = nose[2] - tail[2];
  vnorm(Z, Z);
  // a lixa aponta para o lado oposto à base (grafismo)
  vortho(Y, [-bottomHint[0], -bottomHint[1], -bottomHint[2]], Z);
  vcross(X, Y, Z);
  vnorm(X, X);
}

/** Origem local a partir da ponta do tail no chão (o tail toca o chão na ponta). */
export function boardOrigin(tail: V3, Y: V3, Z: V3, O: V3) {
  const k = deckRise(-DECK.length / 2);
  O[0] = tail[0] - Y[0] * k + Z[0] * (DECK.length / 2);
  O[1] = tail[1] - Y[1] * k + Z[1] * (DECK.length / 2);
  O[2] = tail[2] - Y[2] * k + Z[2] * (DECK.length / 2);
  return O;
}

/** Ponto local → mundo. */
export function boardPoint(O: V3, X: V3, Y: V3, Z: V3, p: V3, o: V3) {
  o[0] = O[0] + X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2];
  o[1] = O[1] + X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2];
  o[2] = O[2] + X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2];
  return o;
}
