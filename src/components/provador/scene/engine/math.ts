/** Utilitários numéricos do motor (cm, radianos). Sem alocação nos caminhos quentes. */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Amortecimento exponencial independente de FPS. */
export const dampFactor = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

/** Pseudo-aleatório determinístico em [0,1). */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Raio polar de uma superelipse com profundidades frente/trás distintas.
 * φ = 0 → lateral (+ax), φ = π/2 → frente (+az).
 */
export function superR(phi: number, W: number, F: number, B: number, n: number): number {
  const c = Math.abs(Math.cos(phi));
  const s = Math.sin(phi);
  const D = s >= 0 ? F : B;
  const a = Math.pow(c / Math.max(W, 0.01), n) + Math.pow(Math.abs(s) / Math.max(D, 0.01), n);
  return a <= 1e-9 ? Math.max(W, D) : Math.pow(a, -1 / n);
}

/** Perímetro de uma elipse com semieixos 1 e k (Ramanujan). */
export const ellipseFactor = (k: number) => Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k)));

/** Raio polar (a partir da origem) de uma elipse de semieixos (a, b) centrada em (0, zc). */
export function offsetEllipseR(phi: number, a: number, b: number, zc: number): number {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const A = (c * c) / (a * a) + (s * s) / (b * b);
  const Bq = (-2 * s * zc) / (b * b);
  const C = (zc * zc) / (b * b) - 1;
  const disc = Bq * Bq - 4 * A * C;
  if (disc <= 0) return 0;
  return (-Bq + Math.sqrt(disc)) / (2 * A);
}

/** Raio polar de uma elipse (a, b) centrada em (xc, zc). */
export function offsetEllipseR2(phi: number, a: number, b: number, xc: number, zc: number): number {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const A = (c * c) / (a * a) + (s * s) / (b * b);
  const Bq = -2 * ((c * xc) / (a * a) + (s * zc) / (b * b));
  const C = (xc * xc) / (a * a) + (zc * zc) / (b * b) - 1;
  const disc = Bq * Bq - 4 * A * C;
  if (disc <= 0) return 0;
  return (-Bq + Math.sqrt(disc)) / (2 * A);
}

/** Máximo suave (sem vinco onde duas superfícies se cruzam). */
export function smax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Mínimo suave. */
export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Gaussiana angular (diferença circular). */
export function angBump(phi: number, center: number, sigma: number): number {
  let d = phi - center;
  d -= TAU * Math.round(d / TAU);
  const x = (d * d) / (sigma * sigma);
  return x > 9 ? 0 : Math.exp(-x);
}

/** Interpolação Catmull-Rom uniforme para tabelas de estações. */
export function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/* ─────────── Vetores 3D leves (tuplas mutáveis) ─────────── */
export type V3 = [number, number, number];
export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z];
export const vset = (o: V3, x: number, y: number, z: number): V3 => {
  o[0] = x;
  o[1] = y;
  o[2] = z;
  return o;
};
export const vcopy = (o: V3, a: V3): V3 => vset(o, a[0], a[1], a[2]);
export const vadd = (o: V3, a: V3, b: V3): V3 => vset(o, a[0] + b[0], a[1] + b[1], a[2] + b[2]);
export const vsub = (o: V3, a: V3, b: V3): V3 => vset(o, a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const vscale = (o: V3, a: V3, s: number): V3 => vset(o, a[0] * s, a[1] * s, a[2] * s);
export const vaddScaled = (o: V3, a: V3, b: V3, s: number): V3 => vset(o, a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s);
export const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlen = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const vdist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const vcross = (o: V3, a: V3, b: V3): V3 => vset(o, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
export const vnorm = (o: V3, a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return vset(o, a[0] / l, a[1] / l, a[2] / l);
};
export const vlerp = (o: V3, a: V3, b: V3, t: number): V3 => vset(o, lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));

/** Remove de `v` a componente ao longo de `t` (unitário) e normaliza. */
export function vortho(o: V3, v: V3, t: V3): V3 {
  const d = vdot(v, t);
  vset(o, v[0] - t[0] * d, v[1] - t[1] * d, v[2] - t[2] * d);
  return vnorm(o, o);
}

/** Rotaciona `v` em torno do eixo unitário `k` (Rodrigues). */
export function vrotate(o: V3, v: V3, k: V3, ang: number): V3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const d = vdot(k, v) * (1 - c);
  const cx = k[1] * v[2] - k[2] * v[1];
  const cy = k[2] * v[0] - k[0] * v[2];
  const cz = k[0] * v[1] - k[1] * v[0];
  return vset(o, v[0] * c + cx * s + k[0] * d, v[1] * c + cy * s + k[1] * d, v[2] * c + cz * s + k[2] * d);
}

/** Matriz de rotação 3×3 (colunas = eixos x,y,z do referencial). */
export type M3 = [number, number, number, number, number, number, number, number, number];
export const m3identity = (): M3 => [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** R = Ry(yaw) · Rz(roll) · Rx(pitch) — ordem usada para pelve/peito/cabeça. */
export function m3fromEuler(o: M3, pitch: number, yaw: number, roll: number): M3 {
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cz = Math.cos(roll), sz = Math.sin(roll);
  // Rz·Rx
  const a00 = cz, a01 = -sz * cx, a02 = sz * sx;
  const a10 = sz, a11 = cz * cx, a12 = -cz * sx;
  const a20 = 0, a21 = sx, a22 = cx;
  // Ry·(Rz·Rx)
  o[0] = cy * a00 + sy * a20; o[3] = cy * a01 + sy * a21; o[6] = cy * a02 + sy * a22;
  o[1] = a10; o[4] = a11; o[7] = a12;
  o[2] = -sy * a00 + cy * a20; o[5] = -sy * a01 + cy * a21; o[8] = -sy * a02 + cy * a22;
  return o;
}

/** o = R · v (R em colunas: [x0 x1 x2 | y0 y1 y2 | z0 z1 z2] com layout coluna-maior). */
export function m3apply(o: V3, R: M3, x: number, y: number, z: number): V3 {
  return vset(o, R[0] * x + R[3] * y + R[6] * z, R[1] * x + R[4] * y + R[7] * z, R[2] * x + R[5] * y + R[8] * z);
}

export function m3mul(o: M3, A: M3, B: M3): M3 {
  const r = new Array(9) as M3;
  for (let c = 0; c < 3; c++)
    for (let rr = 0; rr < 3; rr++) r[c * 3 + rr] = A[rr] * B[c * 3] + A[3 + rr] * B[c * 3 + 1] + A[6 + rr] * B[c * 3 + 2];
  for (let i = 0; i < 9; i++) o[i] = r[i];
  return o;
}
