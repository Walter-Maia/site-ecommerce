import { type BufferGeometry, type Material, Matrix4, Mesh, type Object3D, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Grid } from "./grid";
import { limbR } from "./body";
import { type V3, TAU, lerp, v3, vcross, vnorm, vortho, vsub } from "./math";

/**
 * Mãos e pés estáticos (unidade = comprimento da mão/pé); posicionados por matriz.
 * Construídos para o lado esquerdo (+x) e espelhados para o direito.
 */

function tube(points: V3[], radius: (i: number, phi: number) => number, segs: number, ref: V3 = v3(0, 0, 1)): BufferGeometry {
  const n = points.length;
  const g = new Grid(segs, n, { capStart: true, capEnd: true, uv: "normalized" });
  const t = v3(), ax = v3(), az = v3();
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    vsub(t, b, a);
    vnorm(t, t);
    if (i === 0) vortho(az, ref, t);
    else vortho(az, az, t);
    vcross(ax, t, az);
    vnorm(ax, ax);
    const p = points[i];
    for (let j = 0; j <= segs; j++) {
      const phi = (j / segs) * TAU;
      const r = radius(i, phi);
      const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
      g.set(i, j, p[0] + ax[0] * cs + az[0] * sn, p[1] + ax[1] * cs + az[1] * sn, p[2] + ax[2] * cs + az[2] * sn);
    }
  }
  g.autoCaps();
  g.commit();
  return g.geometry;
}

function path(start: V3, dirs: V3[], len: number, steps: number[]): V3[] {
  const pts: V3[] = [[...start] as V3];
  let p: V3 = [...start] as V3;
  let acc = 0;
  for (let k = 0; k < steps.length; k++) {
    const d = dirs[Math.min(dirs.length - 1, k)];
    const l = Math.hypot(d[0], d[1], d[2]);
    const s = (steps[k] - acc) * len;
    acc = steps[k];
    p = [p[0] + (d[0] / l) * s, p[1] + (d[1] / l) * s, p[2] + (d[2] / l) * s];
    pts.push(p);
  }
  return pts;
}

/** Mão relaxada, palma voltada para −x (lado medial da mão esquerda), polegar para +z. */
export function handGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const palm: [number, number, number, number, number][] = [
    [0, 0.072, 0.14, 0.14, 0],
    [-0.1, 0.082, 0.19, 0.17, 0.01],
    [-0.25, 0.076, 0.21, 0.2, 0.015],
    [-0.4, 0.064, 0.21, 0.2, 0.01],
    [-0.47, 0.048, 0.2, 0.19, 0.01],
  ];
  parts.push(
    tube(
      palm.map((r) => v3(0, r[0], r[4])),
      (i, phi) => limbR(phi, palm[i][1], palm[i][2], palm[i][3]),
      8,
    ),
  );
  const fingers: [number, number, number][] = [
    [0.135, 0.4, 0.01],
    [0.047, 0.445, 0.0],
    [-0.04, 0.415, -0.006],
    [-0.122, 0.335, -0.015],
  ];
  for (const [z, len, spread] of fingers) {
    const pts = path(v3(-0.004, -0.43, z), [v3(-0.12, -1, spread), v3(-0.4, -1, spread), v3(-0.7, -1, spread)], len, [0.4, 0.72, 1]);
    parts.push(tube(pts, (i) => lerp(0.047, 0.031, i / (pts.length - 1)) * (i === pts.length - 1 ? 0.7 : 1), 5, v3(1, 0, 0)));
  }
  const thumb = path(v3(-0.035, -0.07, 0.14), [v3(-0.4, -0.75, 0.5), v3(-0.35, -0.9, 0.22), v3(-0.3, -1, 0.1)], 0.37, [0.38, 0.72, 1]);
  parts.push(tube(thumb, (i) => lerp(0.066, 0.042, i / (thumb.length - 1)) * (i === thumb.length - 1 ? 0.75 : 1), 6, v3(1, 0, 0)));
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Pé descalço (tornozelo na origem, chão em y = −0.3, ponta para +z, medial = −x). */
export function footGeometry(): BufferGeometry {
  const st: [number, number, number, number, number][] = [
    // z, meia largura, topo, base (acima do chão), deslocamento x
    [-0.24, 0.05, 0.13, 0.03, 0],
    [-0.21, 0.105, 0.21, 0.0, 0],
    [-0.13, 0.125, 0.3, 0.0, 0],
    [-0.02, 0.13, 0.36, 0.0, 0],
    [0.1, 0.14, 0.31, 0.0, -0.005],
    [0.28, 0.16, 0.22, 0.0, -0.012],
    [0.48, 0.18, 0.15, 0.0, -0.02],
    [0.6, 0.185, 0.12, 0.0, -0.025],
    [0.7, 0.17, 0.095, 0.0, -0.03],
    [0.76, 0.13, 0.075, 0.005, -0.035],
    [0.79, 0.05, 0.05, 0.012, -0.035],
  ];
  const floor = -0.3;
  const pts = st.map(([z, , top, bot, xo]) => v3(xo, floor + (top + bot) / 2, z));
  return tube(
    pts,
    (i, phi) => {
      const [, W, top, bot] = st[i];
      const h = (top - bot) / 2;
      let r = limbR(phi, W, h, h);
      // dedos (só no topo da frente)
      if (i >= 7 && i <= 9 && Math.sin(phi) > 0.2) r += 0.006 * Math.cos(10 * phi);
      return r;
    },
    12,
    v3(0, 1, 0),
  );
}

/** Espelha em x invertendo o enrolamento (lado direito). */
export function mirrorX(src: BufferGeometry): BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setX(i, -pos.getX(i));
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
  }
  return g;
}

const mx = new Matrix4();
const vx = new Vector3(), vy = new Vector3(), vz = new Vector3();

/** Posiciona uma malha estática por base ortonormal (colunas x,y,z) + escala uniforme. */
export function placeBasis(mesh: Object3D, pos: V3, x: V3, y: V3, z: V3, scale: number) {
  vx.set(x[0], x[1], x[2]).multiplyScalar(scale);
  vy.set(y[0], y[1], y[2]).multiplyScalar(scale);
  vz.set(z[0], z[1], z[2]).multiplyScalar(scale);
  mx.makeBasis(vx, vy, vz);
  mx.setPosition(pos[0], pos[1], pos[2]);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(mx);
  mesh.matrixWorldNeedsUpdate = true;
}

export function staticMesh(geo: BufferGeometry, mat: Material, parent: Object3D, name: string) {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  parent.add(m);
  return m;
}
