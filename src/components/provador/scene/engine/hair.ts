import { Group, IcosahedronGeometry, InstancedMesh, type Material, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import type { HairStyle } from "@/lib/types";
import { Grid } from "./grid";
import { HEAD_SEGS, headShapeR } from "./body";
import type { TrunkField } from "./field";
import { type Rig, headDims } from "./rig";
import type { Shape } from "./shape";
import { type V3, TAU, angBump, clamp, hash, lerp, offsetEllipseR, smoothstep, v3, vcross, vnorm, vortho, vsub } from "./math";
import { type RimUniforms, hairMaterial, plainMaterial } from "./materials";
import { boundary } from "./pieces";

const FRONT = Math.PI / 2;

/** Tubo com raio variável ao longo de uma polilinha (tranças, rabo, cachos longos). */
export class Strand {
  readonly grid: Grid;
  readonly mesh: Mesh;
  private ax = v3();
  private az = v3();
  private t = v3();

  constructor(segs: number, rows: number, mat: Material, parent: Group, name: string) {
    this.grid = new Grid(segs, rows, { capStart: true, capEnd: true });
    this.mesh = new Mesh(this.grid.geometry, mat);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    parent.add(this.mesh);
  }

  /** `pts` em cm (mundo); `radius(i, φ)`; `ref` = direção de referência para a "frente" da seção. */
  update(pts: V3[], radius: (i: number, phi: number) => number, ref: V3) {
    const g = this.grid;
    const n = g.rows;
    const { ax, az, t } = this;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      vsub(t, b, a);
      vnorm(t, t);
      if (i === 0) vortho(az, ref, t);
      else vortho(az, az, t);
      vcross(ax, t, az);
      vnorm(ax, ax);
      const p = pts[i];
      for (let j = 0; j <= g.segs; j++) {
        const phi = (j / g.segs) * TAU;
        const r = radius(i, phi);
        const cs = Math.cos(phi) * r, sn = Math.sin(phi) * r;
        g.set(i, j, p[0] + ax[0] * cs + az[0] * sn, p[1] + ax[1] * cs + az[1] * sn, p[2] + ax[2] * cs + az[2] * sn);
      }
    }
    g.autoCaps();
    g.commit();
  }

  dispose() {
    this.grid.dispose();
  }
}

interface StrandSpec {
  h: number; // altura (fração) na cabeça
  phi: number; // ângulo na cabeça
  len: number; // cm
  step: number;
  r0: number;
  r1: number;
  bead: number; // amplitude de "contas" (tranças)
  forward: number; // viés para frente dos ombros
  flat?: number;
  tie?: boolean;
}

const tmpLocal = { y: 0, phi: 0, d: 0 };

/** Chapéu sobre o cabelo: boné (copa rasa, aba) ou gorro (cobre o topo e achata o volume). */
export type HatKind = "cap" | "beanie";

/** Cabelo procedural para todos os HairStyle. Calota/coque/afro/cachos no espaço da cabeça; mechas no mundo. */
export class Hair {
  readonly style: HairStyle;
  readonly local = new Group();
  readonly world = new Group();
  private readonly mat: Material;
  private readonly tieMat: Material;
  private cap?: Grid;
  private afro?: Grid;
  private curls?: InstancedMesh;
  private curlGeo?: IcosahedronGeometry;
  private bun?: Mesh;
  private bunGeo?: IcosahedronGeometry;
  private strands: Strand[] = [];
  private specs: StrandSpec[] = [];
  private ties: Strand[] = [];
  private curtain?: Grid;
  private meshes: Mesh[] = [];
  private hairline: (phi: number) => number;
  private pts: V3[][] = [];
  /** Cobre as orelhas? (o motor esconde as orelhas) */
  readonly coversEars: boolean;

  constructor(style: HairStyle, color: string, rim: RimUniforms, headLocal: Group, world: Group) {
    this.style = style;
    this.mat = hairMaterial(color, rim);
    this.tieMat = plainMaterial(style === "maria-chiquinha" ? "#ff3d8e" : "#1a1416", rim, 0.4, 0.1);
    headLocal.add(this.local);
    world.add(this.world);
    this.coversEars = style === "longo-liso" || style === "black-power" || style === "trancas";
    const side = style === "longo-liso" || style === "trancas" || style === "black-power" ? 0.4 : 0.55;
    this.hairline = boundary([[90, 0.8], [50, 0.73], [130, 0.73], [15, side + 0.06], [165, side + 0.06], [0, side], [180, side], [325, 0.32], [215, 0.32], [270, 0.2]]);

    if (style !== "black-power") {
      this.cap = new Grid(HEAD_SEGS, 9, { capEnd: true });
      this.addMesh(this.cap, this.local, "hairCap");
    }
    if (style === "black-power") {
      this.afro = new Grid(HEAD_SEGS, 13, { capEnd: true });
      this.addMesh(this.afro, this.local, "afro");
    }
    if (style === "cacheado-curto" || style === "black-power") {
      this.curlGeo = new IcosahedronGeometry(1, 0);
      this.curls = new InstancedMesh(this.curlGeo, this.mat, style === "black-power" ? 170 : Hair.CURLS);
      this.curls.receiveShadow = true;
      this.curls.castShadow = true;
      this.curls.frustumCulled = false;
      this.local.add(this.curls);
    }
    if (style === "coque") {
      this.bunGeo = new IcosahedronGeometry(1, 1);
      this.bun = new Mesh(this.bunGeo, this.mat);
      this.bun.castShadow = true;
      this.local.add(this.bun);
    }
    if (style === "trancas") {
      for (let k = 0; k < 18; k++) {
        const back = k < 12;
        const phi = back ? lerp(205, 335, k / 11) : [160, 172, 184, 356, 8, 20][k - 12];
        this.specs.push({ h: back ? 0.42 + (k % 2) * 0.1 : 0.5, phi: (phi * Math.PI) / 180, len: back ? 44 + (k % 3) * 3 : 36, step: 3.2, r0: 0.85, r1: 0.6, bead: 0.18, forward: back ? 0 : 0.9 });
      }
    }
    if (style === "maria-chiquinha") {
      for (const side of [1, -1]) this.specs.push({ h: 0.4, phi: side === 1 ? -0.3 : Math.PI + 0.3, len: 38, step: 1.9, r0: 2.2, r1: 1.45, bead: 0.34, forward: 2.2, tie: true });
    }
    if (style === "rabo-de-cavalo") this.specs.push({ h: 0.62, phi: (3 * Math.PI) / 2, len: 36, step: 3, r0: 3.0, r1: 1.0, bead: 0, forward: 0, flat: 1.3, tie: true });
    for (let k = 0; k < this.specs.length; k++) {
      const sp = this.specs[k];
      const rows = Math.max(6, Math.round(sp.len / sp.step) + 1);
      this.strands.push(this.addStrand(new Strand(sp.bead > 0.3 ? 7 : 6, rows, this.mat, this.world, `strand${k}`)));
      this.pts.push(Array.from({ length: rows }, () => v3()));
      if (sp.tie) this.ties.push(this.addStrand(new Strand(8, 3, this.tieMat, this.world, `tie${k}`)));
    }
    if (style === "longo-liso") {
      this.curtain = new Grid(20, 12, { closed: false });
      this.addMesh(this.curtain, this.world, "curtain");
    }
  }

  private addMesh(g: Grid, parent: Group, name: string) {
    const m = new Mesh(g.geometry, this.mat);
    m.name = name;
    m.castShadow = true;
    m.frustumCulled = false;
    parent.add(m);
    this.meshes.push(m);
    return m;
  }

  private addStrand(s: Strand) {
    return s;
  }

  /** Espessura do cabelo sobre o crânio. */
  private thickness(h: number, phi: number, h0: number): number {
    const ramp = smoothstep(h0, h0 + 0.07, h);
    const lat = Math.abs(Math.cos(phi));
    let T: number;
    switch (this.style) {
      case "raspado":
        T = 0.22;
        break;
      case "curto":
        T = (0.65 + 0.9 * smoothstep(0.72, 0.95, h)) * (1 - 0.35 * lat * (1 - smoothstep(0.7, 0.85, h))) + 0.9 * angBump(phi, FRONT, 0.55) * smoothstep(0.76, 0.9, h);
        break;
      case "cacheado-curto":
        T = 0.8 + 0.7 * smoothstep(0.7, 0.95, h);
        break;
      case "longo-liso":
        T = 0.9 + 0.4 * lat;
        break;
      case "maria-chiquinha":
        T = 0.7 + 0.35 * lat * (1 - h);
        break;
      default:
        T = 0.55;
    }
    // risca no meio (penteados com divisão)
    if (this.style === "maria-chiquinha" || this.style === "longo-liso" || this.style === "trancas") {
      const x = Math.abs(Math.cos(phi));
      T -= 0.45 * Math.exp(-(x * x) / 0.004) * smoothstep(0.7, 0.85, h);
    }
    return 0.12 + (T - 0.12) * ramp;
  }

  /** Raio externo do cabelo (para o boné encaixar). */
  outerR(s: Shape, h: number, phi: number) {
    const base = headShapeR(s, h, phi);
    if (this.style === "black-power") return base + 2.2;
    if (this.style === "cacheado-curto") return base + 1.6;
    return base + this.thickness(h, phi, this.hairline(phi));
  }

  /** Raio externo do cabelo na altura local y (cm), já com o volume comprimido pelo chapéu `hat`. */
  hatR(s: Shape, y: number, phi: number, hat: HatKind) {
    const { headH } = headDims(s);
    if (this.style === "black-power") {
      // forma do volume calculada uma vez por quadro (update), não por vértice do gorro
      if (!this.afroHat || this.afroHat.s !== s || this.afroHat.hat !== hat) this.afroHat = { s, hat, A: this.afroShape(s, hat) };
      const A = this.afroHat.A;
      const hr = y < headH ? headShapeR(s, Math.max(0, y / headH), phi) + 0.6 : 0;
      return Math.max(hr, A.r(phi, y) + 0.5);
    }
    if (y >= headH) return 0;
    // a malha comprime o cabelo: topete e cachos achatam sob o gorro
    const h = Math.max(0, y / headH);
    const base = headShapeR(s, h, phi);
    if (this.style === "cacheado-curto") return base + 1.0;
    return base + Math.min(0.75, this.thickness(h, phi, this.hairline(phi)));
  }

  /** Ponto mais alto do cabelo (cm, coordenadas locais da cabeça) com o chapéu `hat`. */
  topY(s: Shape, hat: HatKind | null) {
    const { headH } = headDims(s);
    if (this.style === "black-power") return this.afroShape(s, hat).yTop;
    if (this.style === "cacheado-curto") return headH + (hat === "beanie" ? 1.0 : 1.8);
    if (this.style === "coque" && !hat) return headH + 3.5;
    const T = this.thickness(0.99, Math.PI / 2, this.hairline(Math.PI / 2));
    return headH + (hat === "beanie" ? Math.min(0.75, T) : T);
  }

  update(s: Shape, rig: Rig, field: TrunkField, hat: HatKind | null, capBand: (phi: number) => number) {
    this.afroHat = null;
    const { headH, headW, headD } = headDims(s);
    const sc = s.headC / 56;
    const capOn = hat !== null;
    this.hat = hat;
    this.band = capBand;
    if (this.cap) {
      const g = this.cap;
      for (let j = 0; j <= HEAD_SEGS; j++) {
        const phi = ((j % HEAD_SEGS) / HEAD_SEGS) * TAU;
        const h0 = this.hairline(phi);
        for (let i = 0; i < g.rows; i++) {
          const u = i / (g.rows - 1);
          const h = lerp(h0, 0.995, Math.pow(u, 0.8));
          let T = this.thickness(h, phi, h0);
          // sob o gorro o cabelo achata (o gorro usa o mesmo limite em hatR)
          if (hat === "beanie" && h > capBand(phi) - 0.08) T = Math.min(T, 0.7);
          const r = headShapeR(s, h, phi) + T;
          g.set(i, j, Math.cos(phi) * r, h * headH, Math.sin(phi) * r);
        }
      }
      g.autoCaps();
      g.commit();
    }
    if (this.afro) this.updateAfro(s, hat, capBand);
    if (this.curls && this.style === "cacheado-curto") this.updateCurls(s, capOn, capBand);
    if (this.bun) {
      if (hat === "beanie") {
        // coque baixo na nuca, saindo por baixo da barra do gorro
        this.bun.position.set(0, 0.27 * headH, -0.6 * headD);
        this.bun.scale.set(4.4 * sc, 3.7 * sc, 4.0 * sc);
        this.bun.rotation.set(0.35, 0.3, 0);
      } else {
        const low = capOn;
        this.bun.position.set(0, (low ? 0.5 : 0.99) * headH, -(low ? 0.56 : 0.3) * headD);
        this.bun.scale.set(5.0 * sc, 4.2 * sc, 4.8 * sc);
        this.bun.rotation.set(low ? 0.2 : -0.5, 0.3, 0);
      }
    }
    for (let k = 0; k < this.specs.length; k++) this.updateStrand(k, s, rig, field, headH, headW, headD);
    if (this.curtain) this.updateCurtain(s, rig, field, headH);
  }

  private hat: HatKind | null = null;
  private afroHat: { s: Shape; hat: HatKind; A: ReturnType<Hair["afroShape"]> } | null = null;
  private band: (phi: number) => number = () => 1;

  /** Volume do black power: elipsoide sobre a cabeça (raio polar por altura local). */
  private afroShape(s: Shape, hat: HatKind | null) {
    const { headH, headW, headD } = headDims(s);
    // sob o gorro o volume achata bastante (a malha comprime); sob o boné, um pouco
    const shrink = hat === "beanie" ? 4.4 : hat === "cap" ? 3 : 0;
    const cy = 0.6 * headH - shrink * 0.4;
    const rx = headW / 2 + 7.4 - shrink, ry = headH * 0.5 + 6.2 - shrink * 1.4, rz = headD / 2 + 5.6 - shrink;
    const cz = -0.16 * headD;
    return {
      cy,
      ry,
      yTop: cy + ry,
      r: (phi: number, y: number) => {
        const q = Math.max(0, 1 - ((y - cy) / ry) ** 2);
        return q > 0 ? offsetEllipseR(phi, rx * Math.sqrt(q), rz * Math.sqrt(q), cz) : 0;
      },
    };
  }

  private updateAfro(s: Shape, hat: HatKind | null, capBand: (phi: number) => number) {
    const capOn = hat !== null;
    const g = this.afro!;
    const { headH } = headDims(s);
    const A = this.afroShape(s, hat);
    for (let j = 0; j <= HEAD_SEGS; j++) {
      const phi = ((j % HEAD_SEGS) / HEAD_SEGS) * TAU;
      const h0 = this.hairline(phi);
      const y0 = h0 * headH;
      for (let i = 0; i < g.rows; i++) {
        let x: number, y: number, z: number;
        if (i === 0) {
          const r = headShapeR(s, h0, phi) + 0.1;
          x = Math.cos(phi) * r;
          z = Math.sin(phi) * r;
          y = y0;
        } else {
          const u = (i - 1) / (g.rows - 2);
          y = lerp(y0 + 0.4, A.yTop, Math.pow(u, 0.75));
          const hr = y < headH ? headShapeR(s, y / headH, phi) + 0.6 : 0;
          // base arredondada: as primeiras linhas saem do couro cabeludo e curvam para fora
          let r = Math.max(hr, lerp(hr, A.r(phi, y), smoothstep(0, 0.18, u)));
          r *= 1 + 0.05 * Math.sin(5 * phi + 2.3 * u) + 0.035 * Math.sin(9 * phi - 4 * u + 1);
          x = Math.cos(phi) * r;
          z = Math.sin(phi) * r;
        }
        g.set(i, j, x, y, z);
      }
    }
    g.autoCaps();
    g.commit();
    if (this.curls) this.updateAfroClumps(s, A, capOn ? capBand : null);
  }

  /** Tufos poligonais sobre o volume do afro (o "crespo" facetado da referência). */
  private updateAfroClumps(s: Shape, A: ReturnType<Hair["afroShape"]>, capBand: ((phi: number) => number) | null) {
    const inst = this.curls!;
    const { headH } = headDims(s);
    const sc = s.headC / 56;
    let used = 0;
    let i = 0;
    const rows = 9;
    for (let rI = 0; rI < rows && used < inst.instanceMatrix.count; rI++) {
      const v = rI / (rows - 1);
      const y = lerp(A.cy - A.ry * 0.45, A.yTop - 1.2, v);
      const ring = Math.sqrt(Math.max(0, 1 - ((y - A.cy) / A.ry) ** 2));
      const count = Math.max(4, Math.round(22 * ring));
      for (let c = 0; c < count && used < inst.instanceMatrix.count; c++, i++) {
        const phi = ((c + (rI % 2) * 0.5) / count) * TAU;
        if (y < this.hairline(phi) * headH + 2) continue;
        // com boné: só os tufos que escapam por baixo da faixa
        if (capBand && y > capBand(phi) * headH - 1.5) continue;
        const r = A.r(phi, y) - 0.9;
        if (r <= 0) continue;
        this.v.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
        this.q.setFromAxisAngle(this.sv.set(hash(i * 1.3) - 0.5, hash(i * 2.9) - 0.5, hash(i * 5.1) - 0.5).normalize(), hash(i * 7.3) * TAU);
        const size = (2.5 + 0.9 * hash(i * 3.7)) * sc;
        this.sv.set(size, size * 0.9, size);
        this.m4.compose(this.v, this.q, this.sv);
        inst.setMatrixAt(used++, this.m4);
      }
    }
    inst.count = used;
    inst.instanceMatrix.needsUpdate = true;
  }

  private m4 = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private sv = new Vector3();

  private updateCurls(s: Shape, capOn: boolean, capBand: (phi: number) => number) {
    const inst = this.curls!;
    const { headH } = headDims(s);
    const sc = s.headC / 56;
    const N = Hair.CURLS;
    let used = 0;
    const rowsH = [1.0, 0.94, 0.87, 0.8, 0.73, 0.66, 0.59, 0.52, 0.45, 0.38, 0.31];
    let i = -1;
    for (let rI = 0; rI < rowsH.length && used < N; rI++) {
      const h = rowsH[rI];
      const count = h >= 0.99 ? 1 : Math.max(5, Math.round(17 * Math.sin(Math.acos(Math.min(0.97, (h - 0.5) / 0.52)))));
      for (let c = 0; c < count && used < N; c++) {
        i++;
        const phi = ((c + (rI % 2) * 0.5) / count) * TAU + hash(i * 1.9) * 0.2;
        const h0 = this.hairline(phi);
        if (h < h0 + 0.04) continue;
        if (capOn && h > capBand(phi) - 0.03) continue;
        const top = smoothstep(0.66, 0.95, h);
        const side = 1 - top;
        const r = headShapeR(s, Math.min(h, 0.99), phi);
        const lift = 0.35 + 1.1 * top + hash(i) * 0.35;
        const x = Math.cos(phi) * (r + lift * (1 - top * 0.5));
        const z = Math.sin(phi) * (r + lift * (1 - top * 0.5));
        const y = h * headH + lift * top * 0.9;
        const size = (1.75 + 0.55 * hash(i * 3.7) + 0.55 * top) * sc * (1 - 0.3 * side * Math.abs(Math.cos(phi)));
      this.v.set(x, y, z);
      this.q.setFromAxisAngle(this.sv.set(hash(i * 1.3) - 0.5, hash(i * 2.9) - 0.5, hash(i * 5.1) - 0.5).normalize(), hash(i * 7.3) * TAU);
      this.sv.set(size, size * 0.9, size);
      this.m4.compose(this.v, this.q, this.sv);
      inst.setMatrixAt(used++, this.m4);
      }
    }
    inst.count = used;
    inst.instanceMatrix.needsUpdate = true;
  }

  static readonly CURLS = 120;

  private updateStrand(k: number, s: Shape, rig: Rig, field: TrunkField, headH: number, headW: number, headD: number) {
    const sp = this.specs[k];
    const pts = this.pts[k];
    const n = pts.length;
    // sob o gorro as mechas saem por baixo da barra (rabo e tranças descem para a nuca)
    const h0 = this.hat === "beanie" ? Math.min(sp.h, this.band(sp.phi) - 0.07) : sp.h;
    const hr = headShapeR(s, h0, sp.phi) + (sp.tie ? 0.9 : 0.4);
    const p0 = rig.headPoint(Math.cos(sp.phi) * hr, h0 * headH, Math.sin(sp.phi) * hr, v3());
    const hc = rig.headPoint(0, 0.55 * headH, -0.04 * headD, v3());
    const headRad = 0.5 * Math.max(headW, headD) + 0.9;
    const out = v3(p0[0] - hc[0], 0, p0[2] - hc[2]);
    vnorm(out, out);
    const ponytail = this.style === "rabo-de-cavalo";
    pts[0][0] = p0[0];
    pts[0][1] = p0[1];
    pts[0][2] = p0[2];
    const step = (sp.len / (n - 1)) * (ponytail ? 1 : 1);
    for (let i = 1; i < n; i++) {
      const prev = pts[i - 1];
      const p = pts[i];
      const early = clamp(1 - i / 5, 0, 1);
      let dx = out[0] * (0.55 * early + 0.08);
      let dz = out[2] * (0.55 * early + 0.08) + sp.forward * 0.55 * clamp(1 - i / 11, 0, 1);
      let dy = -1;
      if (ponytail && i <= 1) {
        dy = -0.35;
        dz -= 0.9;
      } else if (ponytail) dz += 0.22; // cai rente à nuca e às costas
      const l = Math.hypot(dx, dy, dz);
      dx /= l;
      dy /= l;
      dz /= l;
      p[0] = prev[0] + dx * step;
      p[1] = prev[1] + dy * step;
      p[2] = prev[2] + dz * step;
      // fora da cabeça
      const hx = p[0] - hc[0], hy = (p[1] - hc[1]) * 0.85, hz = p[2] - hc[2];
      const hd = Math.hypot(hx, hy, hz);
      const need = headRad + sp.r0 * 0.6;
      if (hd < need && p[1] > hc[1] - headH * 0.9) {
        const k2 = need / Math.max(0.01, hd);
        p[0] = hc[0] + hx * k2;
        p[2] = hc[2] + hz * k2;
      }
      // fora do tronco vestido
      field.pushOut(p, sp.r0 * 0.8 + 0.5, tmpLocal);
      // mantém o comprimento do segmento
      const sx = p[0] - prev[0], sy = p[1] - prev[1], sz = p[2] - prev[2];
      const sl = Math.hypot(sx, sy, sz) || 1;
      p[0] = prev[0] + (sx / sl) * step;
      p[1] = prev[1] + (sy / sl) * step;
      p[2] = prev[2] + (sz / sl) * step;
    }
    const ref = v3(0, 0, 1);
    const beads = sp.bead;
    const strand = this.strands[k];
    strand.update(
      pts,
      (i, phi) => {
        const u = i / (n - 1);
        let r = lerp(sp.r0, sp.r1, u);
        if (beads) r *= 1 - beads * (i % 2 === 1 ? 1 : 0);
        if (ponytail) r *= (i === 0 ? 0.55 : 1) * (1 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 1.6))) * (u > 0.8 ? lerp(1, 0.3, (u - 0.8) / 0.2) : 1);
        if (!ponytail && i >= n - 2) r *= i === n - 1 ? 0.25 : 0.75;
        if (sp.flat) r *= Math.abs(Math.cos(phi)) * (sp.flat - 1 / sp.flat) + 1 / sp.flat;
        return r;
      },
      ref,
    );
    if (sp.tie) {
      const tie = this.ties[this.specs.filter((x, idx) => x.tie && idx < k).length];
      if (tie) {
        // laço no início (rabo) ou perto da ponta (tranças)
        const at = ponytail ? 0 : n - 3;
        const a = pts[at], b = pts[at + 1];
        const tp = [v3(a[0], a[1], a[2]), v3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), v3(lerp(a[0], b[0], 0.7), lerp(a[1], b[1], 0.7), lerp(a[2], b[2], 0.7))];
        if (ponytail) {
          tp[0] = v3(lerp(pts[0][0], pts[1][0], 0.15), lerp(pts[0][1], pts[1][1], 0.15), lerp(pts[0][2], pts[1][2], 0.15));
          tp[1] = v3(lerp(pts[0][0], pts[1][0], 0.3), lerp(pts[0][1], pts[1][1], 0.3), lerp(pts[0][2], pts[1][2], 0.3));
          tp[2] = v3(lerp(pts[0][0], pts[1][0], 0.45), lerp(pts[0][1], pts[1][1], 0.45), lerp(pts[0][2], pts[1][2], 0.45));
        }
        const rt = ponytail ? sp.r0 * 0.75 : sp.r1 * 0.95;
        tie.update(tp, () => rt, ref);
      }
    }
  }

  private updateCurtain(s: Shape, rig: Rig, field: TrunkField, headH: number) {
    const g = this.curtain!;
    const { headD } = headDims(s);
    const hc = rig.headPoint(0, 0.55 * headH, -0.04 * headD, v3());
    const P = v3();
    const R = rig.headR;
    const yEndBack = rig.ground + rig.drop + s.chestY - 6;
    const yEndFront = rig.ground + rig.drop + s.chestY + 3;
    for (let j = 0; j <= g.segs; j++) {
      const th = ((160 + (j / g.segs) * 220) * Math.PI) / 180;
      // com gorro, o cabelo liso nasce na barra (cai por baixo dela)
      const h0 = this.hat === "beanie" ? Math.max(this.hairline(th) + 0.02, this.band(th) - 0.02) : this.hairline(th) + 0.02;
      const r0 = headShapeR(s, h0, th) + this.thickness(h0, th, h0 - 0.1) - 0.15;
      const top = rig.headPoint(Math.cos(th) * r0, h0 * headH, Math.sin(th) * r0, v3());
      // direção horizontal no referencial da cabeça (só guinada)
      let dx = R[0] * Math.cos(th) + R[6] * Math.sin(th);
      let dz = R[2] * Math.cos(th) + R[8] * Math.sin(th);
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl;
      dz /= dl;
      const frontness = Math.max(0, Math.sin(th));
      const yEnd = lerp(yEndBack, yEndFront, frontness) + (j % 2 ? 2.2 : -1.2);
      const wide = headShapeR(s, 0.62, th) + 1.4;
      for (let i = 0; i < g.rows; i++) {
        if (i === 0) {
          g.set(0, j, top[0], top[1], top[2]);
          continue;
        }
        const u = i / (g.rows - 1);
        const y = lerp(top[1], yEnd, Math.pow(u, 0.85));
        const below = clamp((top[1] - y) / 8, 0, 1);
        const rr = lerp(r0, wide, Math.min(1, below * 1.6)) + below * 0.6;
        P[0] = hc[0] + dx * rr;
        P[1] = y;
        P[2] = hc[2] + dz * rr;
        field.pushOut(P, 1.1, tmpLocal);
        g.set(i, j, P[0], P[1], P[2]);
      }
    }
    g.commit();
  }

  dispose() {
    this.cap?.dispose();
    this.afro?.dispose();
    this.curtain?.dispose();
    this.curlGeo?.dispose();
    this.bunGeo?.dispose();
    this.curls?.dispose();
    this.strands.forEach((s) => s.dispose());
    this.ties.forEach((s) => s.dispose());
    this.mat.dispose();
    this.tieMat.dispose();
    this.local.removeFromParent();
    this.world.removeFromParent();
  }
}
