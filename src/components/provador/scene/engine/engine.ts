import { type BufferGeometry, Group, type Material, type Mesh } from "three";
import type { GarmentSlot, HairStyle, MannequinStyle, SizeChartRow } from "@/lib/types";
import type { Appearance, BodyParams, WornItem } from "@/lib/provador/contract";
import { estimateMeasurements } from "@/lib/provador/fit";
import { ARM_SEGS, BodyMeshes, LEG_SEGS, armBodyR, legBodyR } from "./body";
import { TrunkField } from "./field";
import { Rig, headDims } from "./rig";
import { type Pose, POSE_KEYS, SHAPE_KEYS, type Shape, cloneRecord, dampRecord, poseFor, shapeFromMeasurements } from "./shape";
import { LimbField } from "./pieces";
import { type Ctx, type EngineGarment, GarmentInstance, baseGarment, isPants, isSkirt } from "./garments";
import { Hair, type HatKind } from "./hair";
import { Beanie, Cap, SOLE, Shoes } from "./accessories";
import { DECK, DECK_PROBES, Skateboard, boardFrame, boardOrigin, boardPoint, deckHalfWidth as deckHalfWidthAt } from "./prop";
import { footGeometry, handGeometry, mirrorX, placeBasis, staticMesh } from "./extremities";
import { type RimUniforms, createRimUniforms, skinMaterial } from "./materials";
import { fontsReady } from "./textures";
import { type V3, TAU, clamp, dampFactor, lerp, smoothstep, v3, vcross, vnorm, vortho, vsub } from "./math";

export interface EngineInput {
  bodyParams: BodyParams;
  appearance: Appearance;
  outfit: WornItem[];
}

/** Lado em que o manequim segura o skate: direita do manequim (−x; esquerda de quem olha). */
const PROP_SIDE: 1 | -1 = -1;
const TMP_P = v3();
const TMP_Q = v3();
const BX = v3(), BY = v3(), BZ = v3(), BO = v3();
/** Pontos (locais) e raios do truck e das rodas do nose, para não atravessar a mão. */
const NOSE_TRUCK: [V3, number][] = [
  [v3(-DECK.wheelX, -DECK.axleDrop, DECK.truckZ), DECK.wheelR],
  [v3(DECK.wheelX, -DECK.axleDrop, DECK.truckZ), DECK.wheelR],
  [v3(-4.5, -DECK.axleDrop + 0.5, DECK.truckZ), 1.3],
  [v3(0, -DECK.axleDrop + 0.5, DECK.truckZ), 1.3],
  [v3(4.5, -DECK.axleDrop + 0.5, DECK.truckZ), 1.3],
  [v3(0, -2, DECK.truckZ - 1.2), 1.6],
];

const TUCK_TOPS = new Set(["shirt", "ribTank"]);
const TUCK_BOTTOMS = new Set(["trousers", "wideTrousers", "midiSkirt", "jeans"]);

function rowFor(item: WornItem): SizeChartRow {
  const rows = item.product.sizeChart;
  return rows.find((r) => r.size === item.size) ?? rows[Math.floor(rows.length / 2)] ?? { size: item.size };
}

/**
 * Motor do manequim: estado alvo (corpo, aparência, look) → malhas procedurais.
 * Tudo em centímetros dentro de `root` (escala 0,01 → metros na cena).
 */
export class MannequinEngine {
  readonly root = new Group();
  readonly rim: RimUniforms;
  private skin: Material;
  private body: BodyMeshes;
  private field = new TrunkField();
  private rig = new Rig();
  private armF: [LimbField, LimbField] = [new LimbField(ARM_SEGS), new LimbField(ARM_SEGS)];
  private legF: [LimbField, LimbField] = [new LimbField(LEG_SEGS), new LimbField(LEG_SEGS)];
  private handGeo: BufferGeometry;
  private handGeoR: BufferGeometry;
  private footGeo: BufferGeometry;
  private footGeoR: BufferGeometry;
  private hands: Mesh[];
  private feet: Mesh[];
  private garments = new Map<string, GarmentInstance>();
  private order: GarmentInstance[] = [];
  private hair: Hair | null = null;
  private hairKey = "";
  private cap: Cap | Beanie | null = null;
  private capKey = "";
  private board: Skateboard | null = null;
  private boardKey = "";
  /** 1 = pose informal (mão no nose), 0 = formal (encostado na perna); animado. */
  private propMix = 1;
  private propMixTarget = 1;
  private shoes: Shoes | null = null;
  private shoesKey = "";
  private garmentGroup = new Group();

  private cur: Shape | null = null;
  private target: Shape | null = null;
  private pose: Pose = poseFor("informal");
  private poseTarget: Pose = poseFor("informal");
  private ground = 0;
  private groundTarget = 0;
  private dirty = true;
  private skinHex = "";
  private tucked = false;
  private disposed = false;
  /** Altura total da figura (cm), para enquadrar a câmera. */
  figureTop = 180;
  figureWidth = 60;

  constructor(rim: RimUniforms = createRimUniforms()) {
    this.rim = rim;
    this.root.name = "mannequin";
    this.root.scale.setScalar(0.01);
    this.skin = skinMaterial("#b57a55", this.rim);
    this.body = new BodyMeshes(this.skin);
    this.root.add(this.body.group);
    this.root.add(this.garmentGroup);
    this.handGeo = handGeometry();
    this.handGeoR = mirrorX(this.handGeo);
    this.footGeo = footGeometry();
    this.footGeoR = mirrorX(this.footGeo);
    this.hands = [staticMesh(this.handGeo, this.skin, this.body.group, "handL"), staticMesh(this.handGeoR, this.skin, this.body.group, "handR")];
    this.feet = [staticMesh(this.footGeo, this.skin, this.body.group, "footL"), staticMesh(this.footGeoR, this.skin, this.body.group, "footR")];
    fontsReady().then(() => {
      if (this.disposed) return;
      for (const g of this.garments.values()) g.refreshGraphics();
      this.dirty = true;
    });
  }

  /** Define o estado alvo; mudanças contínuas (altura/peso/pose) animam, as discretas trocam a malha. */
  setTarget(input: EngineInput) {
    const { bodyParams, appearance, outfit } = input;
    const m = estimateMeasurements(bodyParams);
    const shape = shapeFromMeasurements(m, bodyParams.body);
    this.target = shape;
    if (!this.cur) this.cur = cloneRecord(shape);
    this.poseTarget = poseFor(appearance.style as MannequinStyle);
    this.propMixTarget = appearance.style === "formal" ? 0 : 1;

    if (appearance.skinTone !== this.skinHex) {
      this.skinHex = appearance.skinTone;
      (this.skin as unknown as { color: { set: (c: string) => void } }).color.set(appearance.skinTone);
    }
    this.syncHair(appearance.hairStyle, appearance.hairColor);
    this.syncOutfit(outfit, shape);
    this.dirty = true;
  }

  private syncHair(style: HairStyle, color: string) {
    const key = `${style}|${color}`;
    if (key === this.hairKey) return;
    this.hairKey = key;
    this.hair?.dispose();
    this.hair = new Hair(style, color, this.rim, this.body.headLocal, this.root);
    this.body.ears.forEach((_, i) => {
      const ear = this.body.meshes.find((m) => m.name === `ear${i}`);
      if (ear) ear.visible = !this.hair!.coversEars;
    });
  }

  private syncOutfit(outfit: WornItem[], shape: Shape) {
    const bySlot = new Map<GarmentSlot, WornItem>();
    for (const it of outfit) bySlot.set(it.product.garment.slot, it);
    const wanted: EngineGarment[] = [];
    const fem = shape.fem > 0.5;
    const full = bySlot.get("full");
    const top = bySlot.get("top");
    const bottom = bySlot.get("bottom");
    const toEngine = (it: WornItem): EngineGarment => ({
      key: `${it.product.id}:${it.size}`,
      kind: it.product.garment.kind,
      slot: it.product.garment.slot,
      spec: it.product.garment,
      row: rowFor(it),
    });
    if (!full && !bottom) wanted.push(baseGarment(fem ? "bikeShorts" : "baseShorts", shape));
    if (bottom && !full) wanted.push(toEngine(bottom));
    if (!full && !top) wanted.push(baseGarment(fem ? "sportsBra" : "baseTank", shape));
    if (top && !full) wanted.push(toEngine(top));
    if (full) wanted.push(toEngine(full));
    const outer = bySlot.get("outer");
    if (outer) wanted.push(toEngine(outer));
    // camisa social entra na calça; flanela/camisa casual fica para fora
    const tg = top?.product.garment;
    const tuckable = !!tg && TUCK_TOPS.has(tg.kind) && !(tg.kind === "shirt" && (tg.pattern === "plaid" || tg.formality === "casual"));
    this.tucked = tuckable && !!bottom && !full && TUCK_BOTTOMS.has(bottom.product.garment.kind);

    const keys = new Set(wanted.map((w) => w.key));
    for (const [k, inst] of this.garments) {
      if (!keys.has(k)) {
        inst.dispose();
        this.garments.delete(k);
      }
    }
    this.order = wanted.map((w) => {
      let inst = this.garments.get(w.key);
      if (!inst) {
        inst = new GarmentInstance(w, this.rim, this.garmentGroup);
        this.garments.set(w.key, inst);
      }
      return inst;
    });

    // boné/gorro, calçado e objeto na mão
    const head = bySlot.get("head");
    const capKey = head ? head.product.id : "";
    if (capKey !== this.capKey) {
      this.capKey = capKey;
      this.cap?.dispose();
      this.cap = head ? (head.product.garment.kind === "beanie" ? new Beanie(head.product.garment, this.rim, this.body.headLocal) : new Cap(head.product.garment, this.rim, this.body.headLocal)) : null;
    }
    const prop = bySlot.get("prop");
    const boardKey = prop && prop.product.garment.kind === "skateboard" ? prop.product.id : "";
    if (boardKey !== this.boardKey) {
      this.boardKey = boardKey;
      this.board?.dispose();
      this.board = boardKey ? new Skateboard(prop!.product.garment, this.rim, this.root) : null;
    }
    const feet = bySlot.get("feet");
    const shoesKey = feet ? feet.product.id : "";
    if (shoesKey !== this.shoesKey) {
      this.shoesKey = shoesKey;
      this.shoes?.dispose();
      this.shoes = feet ? new Shoes(feet.product.garment, this.rim, this.root) : null;
    }
    this.feet.forEach((f) => (f.visible = !this.shoes));
    this.groundTarget = this.shoes ? SOLE[this.shoes.kind] * shape.foot : 0;
  }

  /**
   * Avança a animação. Retorna true enquanto ainda há transição em curso
   * (o canvas usa frameloop "demand" e só pede quadros nesse caso).
   */
  update(dt: number): boolean {
    if (!this.target || !this.cur) return false;
    const k = dampFactor(7, Math.min(dt, 0.1));
    const ds = dampRecord(this.cur, this.target, SHAPE_KEYS, k);
    const dp = dampRecord(this.pose, this.poseTarget, POSE_KEYS, dampFactor(5, Math.min(dt, 0.1)));
    const dg = Math.abs(this.groundTarget - this.ground);
    this.ground = dg < 0.01 ? this.groundTarget : lerp(this.ground, this.groundTarget, k);
    const dm = Math.abs(this.propMixTarget - this.propMix);
    this.propMix = dm < 0.002 ? this.propMixTarget : lerp(this.propMix, this.propMixTarget, dampFactor(5, Math.min(dt, 0.1)));
    const moving = ds > 0.02 || dp > 0.0008 || dg > 0.01 || (!!this.board && dm > 0.002);
    if (!moving && !this.dirty) return false;
    this.dirty = false;
    this.rebuild();
    return moving;
  }

  private rebuild() {
    const s = this.cur!;
    const rig = this.rig;
    const field = this.field;
    const pose = this.pose;
    rig.solve(s, pose, this.ground);
    field.build(s, rig);
    const body = this.body;
    body.updateTorso(field);
    body.updateLegs(s, rig);
    body.updateNeck(s, rig);
    body.updateHead(s, rig);
    const f = s.fem;
    this.legF.forEach((lf, i) => {
      const lat = rig.legs[i].side === 1 ? Math.PI : 0;
      lf.reset((t, phi) => legBodyR(s, t, phi, lat, f));
    });
    this.armF.forEach((af, i) => {
      const lat = rig.arms[i].side === 1 ? Math.PI : 0;
      af.reset((t, phi) => armBodyR(s, t, phi, lat));
    });

    // base dos looks: linhas das peças-base acompanham o corpo atual
    for (const g of this.order) {
      if (!g.g.key.startsWith("base-")) continue;
      const fresh = baseGarment(g.g.kind as "sportsBra", s);
      g.g.row = fresh.row;
    }

    const L = s.foot;
    const shoeK = this.shoes?.kind;
    const ctx: Ctx = {
      s,
      rig,
      field,
      body,
      armF: this.armF,
      legF: this.legF,
      armLimit: () => Infinity,
      hemFloor:
        shoeK === "sneaker"
          ? { front: 0.24 * L, back: 0.1 * L }
          : shoeK === "skate"
            ? { front: 0.27 * L, back: 0.12 * L }
            : shoeK === "loafer"
              ? { front: 0.17 * L, back: 0.08 * L }
              : { front: 0.2 * L, back: 0.4 },
      tucked: false,
      hpsY: s.neckBaseY + 4.5,
      armpitY: s.chestY + 0.45 * (s.shoulderY - s.chestY),
    };

    // 1) alturas de cada peça; 2) partes de baixo (calça/saia)
    for (const g of this.order) {
      ctx.tucked = this.tucked && g.g.slot === "top";
      g.prepare(ctx);
    }
    for (const g of this.order) if (isPants(g.g.kind) || isSkirt(g.g.kind)) g.updateBottom(ctx);

    // 3) braços com folga contra o tronco vestido
    const tops = this.order.filter((g) => !isPants(g.g.kind) && !isSkirt(g.g.kind));
    for (let k = 0; k < 2; k++) {
      const arm = rig.arms[k];
      const baseAbd = arm.side === 1 ? pose.lAbd : pose.rAbd;
      let abd = baseAbd;
      for (let it = 0; it < 48; it++) {
        rig.solveArm(arm, pose, abd);
        if (this.armClear(k, ctx, tops)) break;
        abd += 0.012;
      }
    }
    body.updateArms(s, rig);
    const limits = this.armLimitTable(ctx);
    ctx.armLimit = limits;

    // 4) tops, vestidos e sobreposições (de dentro para fora), depois mangas
    for (const g of tops) {
      ctx.tucked = this.tucked && g.g.slot === "top";
      g.updateTrunk(ctx);
    }
    // skate: posiciona com o tronco já vestido; no informal o braço abre até a mão chegar ao nose
    let boardHalfW = 0;
    if (this.board) {
      boardHalfW = this.placeBoard(ctx);
      if (this.propMix > 0.01 && this.lastPush > 0.2) {
        this.propArm(rig.arms[PROP_SIDE === 1 ? 0 : 1], this.lastPush * this.propMix);
        body.updateArms(s, rig);
        boardHalfW = this.placeBoard(ctx);
      }
    }
    for (const g of tops) g.updateSleeves(ctx);
    // decalques da calça/saia cobertos pela barra de cima não aparecem (evita vazamento)
    const bottoms = this.order.filter((g) => isPants(g.g.kind) || isSkirt(g.g.kind));
    if (bottoms.length) {
      const coverY = (phi: number) => {
        let y = Infinity;
        for (const g of tops) y = Math.min(y, g.hemAt(phi));
        return y;
      };
      for (const g of bottoms) g.coverDecals(coverY);
    }

    // mãos e pés
    for (let k = 0; k < 2; k++) {
      const arm = rig.arms[k];
      const yv = vsub(v3(), arm.wrist, arm.tip);
      vnorm(yv, yv);
      const zv = vortho(v3(), arm.front, yv);
      const xv = vcross(v3(), yv, zv);
      placeBasis(this.hands[k], arm.wrist, xv, yv, zv, arm.handL);
      const leg = rig.legs[k];
      const toe = leg.toe;
      const zf: V3 = [toe[0], 0, toe[2]];
      vnorm(zf, zf);
      const yf: V3 = [0, 1, 0];
      const xf = vcross(v3(), yf, zf);
      placeBasis(this.feet[k], leg.ankle, xf, yf, zf, L);
      if (this.shoes) {
        const pair = k === 0 ? this.shoes.left : this.shoes.right;
        for (const m of pair) placeBasis(m, leg.ankle, xf, yf, zf, L);
      }
    }

    // cabelo e boné/gorro
    const capBand = this.cap ? this.cap.band : () => 2;
    const hat: HatKind | null = this.cap instanceof Beanie ? "beanie" : this.cap ? "cap" : null;
    this.hair?.update(s, rig, field, hat, capBand);
    const { headH } = headDims(s);
    let top = 0;
    if (this.cap instanceof Beanie) {
      const hair = this.hair;
      this.cap.update(s, (y, phi) => (hair ? hair.hatR(s, y, phi, "beanie") : 0), hair ? hair.topY(s, "beanie") : headH);
      top = this.cap.top + 0.5;
    } else if (this.cap) {
      const hair = this.hair;
      this.cap.update(s, (h, phi) => (hair ? hair.outerR(s, h, phi) : 0));
    }

    const crown = rig.headPoint(0, headH, 0, v3());
    const extra = this.hairKey.startsWith("black-power") ? 6.5 : this.hairKey.startsWith("coque") ? 3.5 : this.cap ? 2 : 1;
    this.figureTop = top ? rig.headPoint(0, top, 0, v3())[1] : crown[1] + extra;
    let halfW = Math.max(Math.abs(rig.arms[0].tip[0]), Math.abs(rig.arms[1].tip[0]), s.shoulder / 2);
    halfW = Math.max(halfW, boardHalfW);
    this.figureWidth = 2 * halfW + 16;
  }

  /* ─────────── skate (slot "prop") ─────────── */

  /** Extensão lateral (σ·x máximo, cm) do corpo vestido em torno da altura de mundo y. */
  private outerAt(ctx: Ctx, y: number): number {
    const field = ctx.field;
    const yr = clamp(y - this.rig.ground - this.rig.drop, 0, ctx.s.neckBaseY);
    const lat = PROP_SIDE === 1 ? 0 : Math.PI;
    let m = -Infinity;
    for (const d of [-0.55, -0.28, 0, 0.28, 0.55]) {
      field.point(yr, lat + d, field.occR(yr, lat + d), TMP_P);
      m = Math.max(m, PROP_SIDE * TMP_P[0]);
    }
    return m;
  }

  /** Extensão lateral do calçado/pé do lado do skate. */
  private footOuter(ctx: Ctx): number {
    const leg = this.rig.legs[PROP_SIDE === 1 ? 0 : 1];
    const L = ctx.s.foot;
    const tx = leg.toe[0], tz = leg.toe[2];
    let px = tz, pz = -tx;
    if (PROP_SIDE * px < 0) {
      px = -px;
      pz = -pz;
    }
    void pz;
    let m = -Infinity;
    for (const zf of [-0.25, 0.3, 0.75]) m = Math.max(m, PROP_SIDE * (leg.ankle[0] + tx * zf * L + px * 0.23 * L));
    return m;
  }

  /** Quanto (cm) a folga lateral empurrou o skate para fora na última colocação. */
  private lastPush = 0;

  /**
   * Informal: abre o braço do lado do skate até a palma andar `dx` cm para fora
   * (acompanha o nose quando a roupa larga empurra o skate). Só afasta do corpo.
   */
  private propArm(arm: Rig["arms"][number], dx: number) {
    const palmX = () => PROP_SIDE * lerp(arm.wrist[0], arm.tip[0], 0.3);
    const goal = palmX() + dx;
    let abd = arm.abd;
    for (let it = 0; it < 45 && palmX() < goal; it++) {
      abd += 0.01;
      this.rig.solveArm(arm, this.pose, abd);
    }
  }

  /**
   * Skate em pé sobre o tail, grafismo para a frente. Informal: mão apoiada no nose (o
   * skate fica logo atrás da mão, inclinado para trás). Formal: quase vertical, encostado
   * na lateral da coxa, atrás da mão. Nunca entra no corpo vestido nem no calçado.
   * Retorna a meia largura ocupada (para a câmera).
   */
  private placeBoard(ctx: Ctx): number {
    const b = this.board!;
    const rig = this.rig;
    const σ = PROP_SIDE;
    const arm = rig.arms[σ === 1 ? 0 : 1];
    const w = this.propMix;
    const L = DECK.length;
    const half = DECK.width / 2;
    const palm = vlerpTo(v3(), arm.wrist, arm.tip, 0.3);
    // altura do nose: informal = logo abaixo da palma; formal = inclinação fixa encostando na coxa
    const nyI = clamp(arm.wrist[1] - 4, L * Math.cos(0.55), L * Math.cos(0.08));
    const nyF = L * Math.cos(0.12);
    const ny = lerp(nyF, nyI, w);
    // partida: nose sob a mão (informal) / atrás da mão (formal); a folga lateral ajusta depois
    const N = v3(palm[0] + σ * lerp(-4, half * 0.4, w), ny, palm[2] - lerp(7, 3.4, w));
    // informal: o tail vai para trás (de frente o skate parece em pé); formal: deita para o lado
    const h = Math.sqrt(Math.max(0, L * L - ny * ny));
    const dir = v3(σ * lerp(0.92, 0.32, w), 0, -lerp(0.4, 0.95, w));
    vnorm(dir, dir);
    const T = v3(N[0] + dir[0] * h, 0, N[2] + dir[2] * h);
    const hint = v3(σ * lerp(0.5, 0.22, w), 0, 1);
    boardFrame(T, N, hint, BX, BY, BZ);
    boardOrigin(T, BY, BZ, BO);

    // folga lateral: nenhuma borda entra no corpo vestido nem no calçado (formal: encosta)
    const foot = this.footOuter(ctx);
    const shoeTop = ctx.s.foot * 0.42;
    const margin = lerp(0.35, 1.4, w);
    let push = -Infinity;
    for (let zl = -L / 2 + 3; zl <= L / 2 - 2; zl += 6) {
      for (const xs of [-1, 1]) {
        TMP_Q[0] = xs * deckHalfWidthAt(zl);
        TMP_Q[1] = 0.6;
        TMP_Q[2] = zl;
        boardPoint(BO, BX, BY, BZ, TMP_Q, TMP_P);
        const yw = TMP_P[1];
        const lim = yw < shoeTop ? Math.max(foot, this.outerAt(ctx, Math.max(yw, 2))) : this.outerAt(ctx, yw);
        push = Math.max(push, lim + margin - σ * TMP_P[0]);
      }
    }
    // empurra para fora quando encosta; no formal também puxa até encostar na perna (contínuo na transição)
    BO[0] += σ * (push > 0 ? push : push * (1 - smoothstep(0.3, 0.7, w)));
    this.lastPush = Math.max(0, push);
    // mão × trucks: se a mão alcança o truck do nose, o skate recua
    for (let it = 0; it < 12 && this.handHitsTruck(arm); it++) BO[2] -= 1.5;
    // apoia no chão: o ponto mais baixo encosta em y = 0
    let minY = Infinity;
    let maxX = 0;
    for (const p of DECK_PROBES) {
      boardPoint(BO, BX, BY, BZ, p, TMP_P);
      minY = Math.min(minY, TMP_P[1]);
      maxX = Math.max(maxX, Math.abs(TMP_P[0]));
    }
    BO[1] -= minY;
    b.place(BO, BX, BY, BZ);
    return maxX;
  }

  /** A mão (punho → ponta dos dedos) encosta no truck/rodas do nose do skate? */
  private handHitsTruck(arm: Rig["arms"][number]): boolean {
    for (const [p, r] of NOSE_TRUCK) {
      boardPoint(BO, BX, BY, BZ, p, TMP_P);
      for (let u = 0; u <= 1; u += 0.25) {
        vlerpTo(TMP_Q, arm.wrist, arm.tip, u);
        const d = Math.hypot(TMP_P[0] - TMP_Q[0], TMP_P[1] - TMP_Q[1], TMP_P[2] - TMP_Q[2]);
        if (d < r + 2.4) return true;
      }
    }
    return false;
  }

  /** Testa se o braço k passa livre do tronco vestido (com folga). */
  private armClear(k: number, ctx: Ctx, tops: GarmentInstance[]): boolean {
    const arm = this.rig.arms[k];
    const s = ctx.s;
    const field = ctx.field;
    const P = v3();
    const tmp = { y: 0, phi: 0, d: 0 };
    const samples = [0.55, 0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.35, 2.7];
    for (const t of samples) {
      // ponto na cadeia ombro → cotovelo → punho → ponta
      if (t <= 1) vlerpTo(P, arm.shoulder, arm.elbow, t);
      else if (t <= 2) vlerpTo(P, arm.elbow, arm.wrist, t - 1);
      else vlerpTo(P, arm.wrist, arm.tip, (t - 2) / 0.9);
      field.localOf(P, tmp);
      if (tmp.y > ctx.armpitY - 3) continue;
      let rArm: number;
      if (t <= 2.05) {
        let sl = 0;
        for (const g of tops) sl = Math.max(sl, g.sleeveOuter(s, t));
        rArm = Math.max(this.armF[k].maxR(t), sl);
      } else rArm = 1.7;
      let thick = 0;
      for (const g of tops) thick += g.clearanceThick(tmp.y);
      let need = Math.max(field.occR(tmp.y, tmp.phi), field.bodyR(tmp.y, tmp.phi) + thick);
      if (tmp.y < s.hipY + 2) for (const g of tops) need = Math.max(need, g.lowDrape(ctx, tmp.y, tmp.phi));
      if (tmp.d - rArm < need + 0.6) return false;
    }
    return true;
  }

  /** Tabela por altura com a posição dos braços no anel do tronco (para a roupa "ceder" ao braço). */
  private armLimitTable(ctx: Ctx): (y: number, phi: number) => number {
    const s = ctx.s;
    const field = ctx.field;
    const rig = this.rig;
    const y0 = Math.max(0, s.crotchY - 30);
    const y1 = ctx.armpitY + 2;
    const n = Math.ceil(y1 - y0) + 1;
    const tab = new Float32Array(n * 6).fill(NaN);
    const tmp = { y: 0, phi: 0, d: 0 };
    const P = v3();
    for (let k = 0; k < 2; k++) {
      const arm = rig.arms[k];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 2.7;
        if (t <= 1) vlerpTo(P, arm.shoulder, arm.elbow, t);
        else if (t <= 2) vlerpTo(P, arm.elbow, arm.wrist, t - 1);
        else vlerpTo(P, arm.wrist, arm.tip, (t - 2) / 0.9);
        field.localOf(P, tmp);
        const l = Math.round(tmp.y - y0);
        if (l < 0 || l >= n) continue;
        const r = t <= 2.05 ? this.armF[k].maxR(t) : 1.7;
        tab[l * 6 + k * 3] = Math.cos(tmp.phi) * tmp.d;
        tab[l * 6 + k * 3 + 1] = Math.sin(tmp.phi) * tmp.d;
        tab[l * 6 + k * 3 + 2] = r;
      }
    }
    return (y: number, phi: number) => {
      const l = Math.round(y - y0);
      if (l < 0 || l >= n) return Infinity;
      let lim = Infinity;
      const c = Math.cos(phi), sn = Math.sin(phi);
      for (let k = 0; k < 2; k++) {
        const u = tab[l * 6 + k * 3];
        if (Number.isNaN(u)) continue;
        const w = tab[l * 6 + k * 3 + 1];
        const R = tab[l * 6 + k * 3 + 2] + 1.6;
        const proj = u * c + w * sn;
        const perp = Math.abs(-u * sn + w * c);
        if (proj > 0 && perp < R) lim = Math.min(lim, proj - Math.sqrt(R * R - perp * perp) + 1.2);
      }
      return lim;
    };
  }

  /** Força recálculo no próximo quadro (ex.: fontes carregadas). */
  invalidate() {
    this.dirty = true;
  }

  dispose() {
    this.disposed = true;
    for (const g of this.garments.values()) g.dispose();
    this.garments.clear();
    this.hair?.dispose();
    this.cap?.dispose();
    this.shoes?.dispose();
    this.board?.dispose();
    this.body.dispose();
    this.handGeo.dispose();
    this.handGeoR.dispose();
    this.footGeo.dispose();
    this.footGeoR.dispose();
    this.skin.dispose();
    this.root.removeFromParent();
  }
}

function vlerpTo(o: V3, a: V3, b: V3, t: number) {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
  return o;
}

export { TAU, clamp };
