import { BODY_LIMITS, type GarmentKind, type GarmentSpec, type Size, type SizeChartRow } from "@/lib/types";
import type { BodyMeasurements, BodyParams, FitLabel, FitResult, GarmentProduct, WornItem } from "./contract";
import { bodyLandmarks, neckBaseHeight, type BodyLandmarks } from "./landmarks";

/* ───────────────────────── Medidas do corpo ─────────────────────────
 * Modelo antropométrico simples para adulto brasileiro (cm, kg).
 * Referências: feminino 166 cm/IMC 21 → busto 87, cintura 70, quadril 95;
 * masculino 178 cm/IMC 23,4 → tórax 97, cintura 83, quadril 97.
 *   circ = (ref + inclinação × (IMC − IMCref)) × √(altura / alturaRef)
 * (a √ vem de volume ∝ circ² × altura com IMC constante).
 * Inclinações por ponto de IMC: masculino tórax 2,2 · cintura 2,9 · quadril 1,9
 * (cintura cresce mais rápido); feminino busto 2,0 · cintura 2,3 · quadril 2,4
 * (quadril cresce mais rápido). IMC efetivo é comprimido fora de 17–40.
 * Comprimentos: entrepernas = H × (0,452|0,462 + 0,0007 × (H − 170)) — a perna
 * cresce mais que o tronco com a altura; gancho→cintura = 16,8%|15,8% de H;
 * tronco = base do pescoço − cintura (ver landmarks.ts).
 */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function effectiveBmi(bmi: number): number {
  if (bmi > 40) return Math.min(48, 40 + (bmi - 40) * 0.5);
  if (bmi < 17) return Math.max(14, 17 - (17 - bmi) * 0.5);
  return bmi;
}

export function estimateMeasurements(p: BodyParams): BodyMeasurements {
  const H = clamp(p.heightCm, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max);
  const W = clamp(p.weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max);
  const fem = p.body === "feminino";
  const bmi = W / ((H / 100) * (H / 100));
  const b = effectiveBmi(bmi);
  const refH = fem ? 166 : 178;
  const refBmi = fem ? 21 : 23.4;
  const hs = Math.sqrt(H / refH);
  const d = b - refBmi;

  const chestCm = (fem ? 87 + 2.0 * d : 97 + 2.2 * d) * hs;
  const waistCm = (fem ? 70 + 2.3 * d : 83 + 2.9 * d) * hs;
  const hipCm = (fem ? 95 + 2.4 * d : 97 + 1.9 * d) * hs;
  const shoulderCm = (fem ? 0.232 : 0.252) * H + 0.3 * d;
  const headCm = (fem ? 55 : 57) + 0.045 * (H - refH) + 0.06 * d;
  const inseamCm = H * ((fem ? 0.452 : 0.462) + 0.0007 * (H - 170));
  const rise = H * (fem ? 0.168 : 0.158);
  const torsoLengthCm = neckBaseHeight(H, headCm) - (inseamCm + rise);
  const armLengthCm = H * (fem ? 0.33 : 0.338);
  const footCm = H * (fem ? 0.1485 : 0.151) + 0.03 * d;

  return {
    heightCm: H,
    weightKg: W,
    bmi: round1(bmi),
    chestCm: round1(chestCm),
    waistCm: round1(waistCm),
    hipCm: round1(hipCm),
    shoulderCm: round1(shoulderCm),
    torsoLengthCm: round1(torsoLengthCm),
    inseamCm: round1(inseamCm),
    armLengthCm: round1(armLengthCm),
    headCm: round1(headCm),
    footCm: round1(footCm),
  };
}

/* ───────────────────────── Regras de caimento ───────────────────────── */

type Dim = "chest" | "waist" | "hip" | "head" | "foot";

interface DimRule {
  /** Faixa de folga ideal (medida da peça − corpo), cm. */
  ideal: [number, number];
  /** Quanto abaixo do ideal ainda é "justo" (depois vira "apertado"). */
  tight: number;
  /** Quanto acima do ideal ainda é "solto" (depois vira "grande"). */
  loose: number;
  weight: number;
  /** Compara com a cintura baixa do corpo (saias/jeans de cintura baixa). */
  lowWaist?: boolean;
  elastic?: boolean;
}

type FitRules = Partial<Record<Dim, DimRule>>;

const r = (ideal: [number, number], tight: number, loose: number, weight = 1, extra: Partial<DimRule> = {}): DimRule => ({
  ideal,
  tight,
  loose,
  weight,
  ...extra,
});

/** Folga ideal por tipo de peça e silhueta (circunferências, cm). */
export function fitRules(g: Pick<GarmentSpec, "kind" | "silhouette" | "pattern">): FitRules {
  const s = g.silhouette;
  switch (g.kind) {
    case "tee":
    case "longTee":
      return { chest: s === "oversized" ? r([18, 28], 10, 12) : s === "slim" || s === "cropped" ? r([-2, 6], 5, 8) : r([8, 16], 6, 10) };
    case "babyTee":
      return { chest: r([-4, 2], 5, 8) };
    case "ribTank":
      return { chest: g.pattern === "rib" ? r([-12, -4], 6, 8) : r([-4, 2], 5, 8) };
    case "tank":
      return { chest: s === "oversized" ? r([14, 24], 10, 12) : s === "slim" ? r([-4, 4], 5, 8) : r([6, 14], 6, 10) };
    case "jersey":
      return { chest: s === "oversized" ? r([18, 28], 10, 12) : r([10, 18], 6, 10) };
    case "shirt":
      return { chest: s === "oversized" ? r([18, 30], 8, 12) : s === "slim" ? r([4, 10], 4, 8) : r([8, 16], 6, 12) };
    case "hoodie":
    case "zipHoodie":
      return { chest: s === "oversized" ? r([24, 36], 10, 14) : r([16, 26], 8, 12) };
    case "workJacket":
      // jaqueta workwear: veste por cima de camiseta/moletom leve, folga regular de +12 a +18
      return { chest: s === "oversized" ? r([20, 30], 8, 12) : r([12, 18], 6, 10) };
    case "croppedHoodie":
      return { chest: r([16, 28], 8, 12) };
    case "crewneck":
      return { chest: s === "oversized" ? r([24, 36], 10, 14) : r([16, 26], 8, 12) };
    case "varsityJacket":
      return { chest: s === "oversized" ? r([26, 38], 10, 14) : r([18, 28], 8, 12) };
    case "windbreaker":
      return { chest: s === "oversized" ? r([26, 38], 10, 14) : r([18, 28], 8, 12) };
    case "blazer":
      return { chest: s === "oversized" ? r([16, 26], 8, 12) : s === "slim" ? r([6, 10], 3, 8) : r([8, 12], 4, 8) };
    case "sweatpants":
      return { waist: r([-6, 2], 6, 6, 0.5, { elastic: true }), hip: r(s === "wide" ? [12, 30] : [6, 18], 6, 14, 0.5) };
    case "shorts":
    case "meshShorts":
      return { waist: r([-6, 2], 6, 6, 0.5, { elastic: true }), hip: r([8, 26], 6, 14, 0.5) };
    case "jeans":
      return { waist: r([0, 5], 3, 6, 0.7), hip: r(s === "wide" ? [6, 20] : [2, 10], 4, 12, 0.3) };
    case "cargoPants":
    case "cargoShorts":
      // cargo: veste pela cintura (cós com botão) e sobra folga ampla no quadril
      return { waist: r([0, 5], 3, 6, 0.65), hip: r(s === "slim" ? [6, 16] : [12, 30], 5, 14, 0.35) };
    case "trousers":
      return { waist: r([0, 3], 3, 5, 0.7), hip: r([4, 12], 4, 10, 0.3) };
    case "wideTrousers":
      return { waist: r([0, 3], 3, 5, 0.6), hip: r([6, 16], 4, 12, 0.4) };
    case "miniSkirt":
      return { hip: r([0, 6], 4, 6, 0.7), waist: r([-2, 4], 3, 6, 0.3, { lowWaist: true }) };
    case "midiSkirt":
      return { hip: r([2, 12], 4, 10, 0.6), waist: r([-6, 2], 6, 6, 0.4, { elastic: true }) };
    case "dress":
      return { chest: r([18, 30], 8, 12, 0.5), hip: r([10, 30], 6, 14, 0.5) };
    case "slipDress":
      return { chest: r([-2, 6], 4, 6, 0.3), waist: r([0, 8], 4, 8, 0.2), hip: r([0, 6], 4, 6, 0.5) };
    case "cap":
      // Regulagem: da medida − 4 cm até + 2 cm (folga peça − cabeça de −2 a +4).
      return { head: r([-2, 4], 1, 2) };
    case "beanie":
      // Malha canelada elástica: veste de (medida − 3) a (medida + 4) cm de cabeça.
      return { head: r([-4, 3], 2, 3, 1, { elastic: true }) };
    case "sneaker":
    case "loafer":
    case "skateShoe":
      return { foot: r([-0.5, 0.5], 0.5, 0.8) };
    case "skateboard":
      // Objeto segurado: sem medida de corpo (ver PROP_KINDS em evaluateFit).
      return {};
    default: {
      const never: never = g.kind;
      void never;
      return { chest: r([8, 16], 6, 10) };
    }
  }
}

const TOPS: GarmentKind[] = [
  "tee", "babyTee", "tank", "ribTank", "jersey", "shirt", "hoodie", "croppedHoodie", "crewneck", "varsityJacket", "windbreaker", "blazer",
  "longTee", "zipHoodie", "workJacket",
];
const PANTS: GarmentKind[] = ["sweatpants", "jeans", "trousers", "wideTrousers", "cargoPants"];
const SHORTS: GarmentKind[] = ["shorts", "meshShorts", "cargoShorts"];
const SHOES: GarmentKind[] = ["sneaker", "loafer", "skateShoe"];
/** Objetos segurados (slot "prop"): sem caimento, sempre tamanho único. */
const PROP_KINDS: GarmentKind[] = ["skateboard"];

/** Altura-alvo da barra (cm do chão) para tops e vestidos, por tipo. */
function topHemTarget(kind: GarmentKind, silhouette: GarmentSpec["silhouette"], L: BodyLandmarks): number {
  switch (kind) {
    case "babyTee":
      return L.waistY - 6;
    case "croppedHoodie":
      return L.waistY - 10;
    case "ribTank":
      return L.hipY + 2;
    case "shirt":
      return L.crotchY - 8;
    case "blazer":
      return L.crotchY - 10;
    case "hoodie":
    case "zipHoodie":
    case "crewneck":
    case "varsityJacket":
      return L.crotchY - 2;
    case "workJacket":
      return L.crotchY - 5;
    case "windbreaker":
      return L.crotchY - 4;
    case "dress":
      return L.kneeY + 3;
    case "slipDress":
      return L.kneeY - 18;
    default:
      return silhouette === "oversized" ? L.crotchY - 6 : silhouette === "cropped" ? L.waistY - 6 : L.crotchY + 2;
  }
}

/** Entrepernas ideal da calça em relação à do corpo (cm). */
function inseamAllowance(kind: GarmentKind): number {
  switch (kind) {
    case "jeans":
      return -1;
    case "sweatpants":
      return -4;
    case "wideTrousers":
      return 1;
    case "cargoPants":
      return -1.5;
    default:
      return -3;
  }
}

/* ───────────────────────── Caimento ───────────────────────── */

const fmt = (v: number) => {
  const n = Math.round(v);
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
};
const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");

interface DimEval {
  dim: Dim;
  ease: number;
  z: number; // 0 dentro do ideal; −1 na fronteira justo/apertado; +1 na fronteira solto/grande
  score: number;
  weight: number;
  rule: DimRule;
}

function evalDim(dim: Dim, ease: number, rule: DimRule): DimEval {
  const [lo, hi] = rule.ideal;
  let z = 0;
  let score: number;
  if (ease < lo) {
    z = -(lo - ease) / rule.tight;
    const a = Math.abs(z);
    score = a <= 1 ? 90 - 35 * a : 55 - 30 * (a - 1);
  } else if (ease > hi) {
    z = (ease - hi) / rule.loose;
    score = z <= 1 ? 90 - 30 * z : 60 - 25 * (z - 1);
  } else {
    const c = (lo + hi) / 2;
    const half = Math.max(0.01, (hi - lo) / 2);
    score = 100 - (10 * Math.abs(ease - c)) / half;
  }
  return { dim, ease, z, score: clamp(score, 3, 100), weight: rule.weight, rule };
}

function labelFrom(evals: DimEval[]): FitLabel {
  if (!evals.length) return "ideal";
  if (evals.some((e) => e.z < -1 && e.weight >= 0.3)) return "apertado";
  const wsum = evals.reduce((s, e) => s + e.weight, 0);
  const z = evals.reduce((s, e) => s + e.z * e.weight, 0) / wsum;
  const minZ = Math.min(...evals.map((e) => e.z));
  if (z < -1) return "apertado";
  if (minZ < -0.05 && evals.find((e) => e.z === minZ)!.weight >= 0.3) return "justo";
  if (z < -0.05) return "justo";
  if (z > 1) return "grande";
  if (z > 0.05) return "solto";
  return "ideal";
}

const DIM_NAME: Record<Dim, string> = { chest: "no peito", waist: "na cintura", hip: "no quadril", head: "na cabeça", foot: "no pé" };
const SILHOUETTE_NAME: Record<GarmentSpec["silhouette"], string> = { slim: "justa", regular: "regular", oversized: "oversized", wide: "ampla", cropped: "cropped" };
const BUST_KINDS: GarmentKind[] = ["babyTee", "ribTank", "croppedHoodie", "dress", "slipDress"];

function bodyValue(dim: Dim, m: BodyMeasurements, rule: DimRule): number {
  switch (dim) {
    case "chest":
      return m.chestCm;
    case "waist":
      return rule.lowWaist ? m.waistCm + 0.55 * (m.hipCm - m.waistCm) : m.waistCm;
    case "hip":
      return m.hipCm;
    case "head":
      return m.headCm;
    case "foot":
      return m.footCm;
  }
}

function garmentValue(dim: Dim, row: SizeChartRow): number | undefined {
  switch (dim) {
    case "chest":
      return row.chestCm;
    case "waist":
      return row.waistCm;
    case "hip":
      return row.hipCm;
    case "head":
      return row.headCm;
    case "foot":
      return row.footCm;
  }
}

function pickRow(product: GarmentProduct, size: Size): SizeChartRow | undefined {
  const rows = product.sizeChart;
  return rows.find((x) => x.size === size) ?? rows[Math.floor(rows.length / 2)];
}

export function computeFit(product: GarmentProduct, size: Size, m: BodyMeasurements): FitResult {
  return evaluateFit(product, size, m).result;
}

/** Largura do shape lida do nome do produto (ex.: 8,25"), com 8,25" como padrão. */
function deckWidthLabel(product: GarmentProduct): string {
  const m = /(\d{1,2}[.,]\d{1,3})\s*(?:"|”|″|pol)/.exec(`${product.name} ${product.shortName}`);
  return m ? m[1].replace(".", ",") : "8,25";
}

function propFit(product: GarmentProduct): FitResult {
  return { size: "U", label: "ideal", score: 100, easeCm: {}, notes: [`Shape ${deckWidthLabel(product)}" — largura versátil para rua e pista`] };
}

function evaluateFit(product: GarmentProduct, size: Size, m: BodyMeasurements): { result: FitResult; raw: number } {
  const g = product.garment;
  if (PROP_KINDS.includes(g.kind) || g.slot === "prop") return { result: propFit(product), raw: 100 };
  const row = pickRow(product, size);
  if (!row) return { result: { size, label: "ideal", score: 70, easeCm: {}, notes: ["Sem tabela de medidas para este tamanho."] }, raw: 70 };

  const L = bodyLandmarks(m);
  const rules = fitRules(g);
  const easeCm: FitResult["easeCm"] = {};
  const evals: DimEval[] = [];
  const notes: string[] = [];

  for (const dim of Object.keys(rules) as Dim[]) {
    const rule = rules[dim]!;
    const gv = garmentValue(dim, row);
    if (gv === undefined) continue;
    const ease = gv - bodyValue(dim, m, rule);
    easeCm[dim] = Math.round(ease * 10) / 10;
    evals.push(evalDim(dim, ease, rule));
  }

  // Boné: regulagem de (medida − 4) a (medida + 2) cm.
  if (g.kind === "cap" && row.headCm) {
    const lo = row.headCm - 4;
    const hi = row.headCm + 2;
    if (m.headCm > hi) notes.push(`Cabeça de ${Math.round(m.headCm)} cm passa da regulagem (${lo}–${hi} cm)`);
    else if (m.headCm < lo) notes.push(`Fica folgado mesmo no ajuste mínimo (${lo} cm)`);
    else notes.push(`Regulagem ${lo}–${hi} cm cobre sua cabeça (${Math.round(m.headCm)} cm)`);
  } else if (g.kind === "beanie" && row.headCm) {
    // Gorro: a malha veste de (medida − 3) a (medida + 4) cm.
    const lo = row.headCm - 3;
    const hi = row.headCm + 4;
    if (m.headCm > hi) notes.push(`Cabeça de ${Math.round(m.headCm)} cm estica demais a malha (até ${hi} cm)`);
    else if (m.headCm < lo) notes.push(`Fica folgado: a malha veste a partir de ${lo} cm`);
    else notes.push(`Malha canelada veste de ${lo} a ${hi} cm (sua cabeça: ${Math.round(m.headCm)} cm)`);
  } else if (SHOES.includes(g.kind) && row.footCm) {
    const e = row.footCm - m.footCm;
    if (Math.abs(e) <= 0.5) notes.push(`Pé de ${fmt1(m.footCm)} cm: encaixe certo (${e >= 0 ? "sobra" : "falta"} ${fmt1(Math.abs(e))} cm)`);
    else if (e > 0) notes.push(`Sobra ${fmt1(e)} cm na ponta — considere um número menor`);
    else notes.push(`Falta ${fmt1(-e)} cm para o pé — considere um número maior`);
  } else {
    const main = [...evals].sort((a, b) => b.weight - a.weight)[0];
    if (main) {
      const name = main.dim === "chest" && BUST_KINDS.includes(g.kind) ? "no busto" : DIM_NAME[main.dim];
      const e = fmt(main.ease);
      if (main.z < -1) notes.push(`Aperta ${name} (folga de ${e} cm)`);
      else if (main.z < 0) notes.push(`Mais justo que o pretendido ${name} (${e} cm)`);
      else if (main.z === 0) notes.push(`Folga ideal ${name} para a modelagem ${SILHOUETTE_NAME[g.silhouette]} (${e} cm)`);
      else if (main.z <= 1) notes.push(`Mais solto ${name} (folga de ${e} cm)`);
      else notes.push(`Grande demais ${name} (folga de ${e} cm)`);
    }
    const elastic = evals.find((e) => e.rule.elastic && e.ease <= -1);
    if (elastic && elastic.z >= -1) notes.push(`Cós elástico estica ${Math.round(-elastic.ease)} cm na cintura`);
    const tightOther = evals.find((e) => e !== main && e.z < -1);
    if (tightOther) notes.push(`Aperta também ${DIM_NAME[tightOther.dim]} (${fmt(tightOther.ease)} cm)`);
  }

  // Comprimento
  let lengthDeltaCm: number | undefined;
  let lengthPenalty = 0;
  if (TOPS.includes(g.kind) || g.kind === "dress" || g.kind === "slipDress") {
    if (row.lengthCm) {
      const hemY = L.hpsY - row.lengthCm;
      const ideal = L.hpsY - topHemTarget(g.kind, g.silhouette, L);
      lengthDeltaCm = round1(row.lengthCm - ideal);
      const tol = g.silhouette === "cropped" || g.kind === "babyTee" ? 3 : 4;
      lengthPenalty = Math.max(0, Math.abs(lengthDeltaCm) - tol) * (lengthDeltaCm < 0 ? 2 : 1.5);
      if (g.kind === "dress" || g.kind === "slipDress") {
        const k = hemY - L.kneeY;
        notes.push(Math.abs(k) <= 2 ? "Barra na altura do joelho" : k > 0 ? `Barra ${Math.round(k)} cm acima do joelho` : `Barra ${Math.round(-k)} cm abaixo do joelho`);
      } else if (hemY > L.hipY + 6) {
        const w = hemY - L.waistY;
        notes.push(Math.abs(w) <= 2 ? "Barra na linha da cintura" : w > 0 ? `Cropped: barra ${Math.round(w)} cm acima da cintura` : `Barra ${Math.round(-w)} cm abaixo da cintura`);
      } else if (hemY >= L.crotchY) {
        const h = L.hipY - hemY;
        notes.push(Math.abs(h) <= 2 ? "Barra na linha do quadril" : h > 0 ? `Barra ${Math.round(h)} cm abaixo do quadril` : `Barra ${Math.round(-h)} cm acima do quadril`);
      } else {
        const c = L.crotchY - hemY;
        notes.push(c <= 12 ? `Cobre o quadril: barra ${Math.round(c)} cm abaixo do gancho` : "Comprimento longo: barra no meio da coxa");
      }
    }
    if (row.sleeveCm && row.sleeveCm >= 45) {
      const drop = g.silhouette === "oversized" && row.chestCm ? Math.max(0, (row.chestCm - m.chestCm - 10) * 0.25) : 0;
      const d = row.sleeveCm + drop - m.armLengthCm;
      if (d > 4) notes.push("Manga cobre parte da mão");
      else if (d < -3) notes.push(`Manga curta: punho ${Math.round(-d)} cm acima do pulso`);
      else notes.push("Manga termina no pulso");
    }
  } else if (PANTS.includes(g.kind) && row.inseamCm) {
    const d = row.inseamCm - m.inseamCm;
    lengthDeltaCm = round1(row.inseamCm - (m.inseamCm + inseamAllowance(g.kind)));
    const tol = g.silhouette === "wide" ? 5 : 4;
    lengthPenalty = Math.max(0, Math.abs(lengthDeltaCm) - tol) * (lengthDeltaCm < 0 ? 4 : 1.5);
    if (d >= 6) notes.push(`Barra empilha sobre o tênis (${fmt(d)} cm)`);
    else if (d >= 2) notes.push("Barra quebra sobre o calçado");
    else if (d >= -5) notes.push("Barra na altura do calçado");
    else if (d >= -9) notes.push("Barra no tornozelo");
    else notes.push(`Fica curta: barra ${Math.round(-d - 5)} cm acima do tornozelo`);
  } else if (SHORTS.includes(g.kind) && row.inseamCm) {
    const hemY = L.crotchY - row.inseamCm;
    const target = g.kind === "cargoShorts" ? L.kneeY - 5 : L.kneeY + (g.kind === "meshShorts" ? 10 : 6);
    lengthDeltaCm = round1(target - hemY);
    lengthPenalty = Math.max(0, Math.abs(lengthDeltaCm) - 6) * 1.5;
    const k = hemY - L.kneeY;
    notes.push(Math.abs(k) <= 3 ? "Barra na altura do joelho" : k > 0 ? `Barra ${Math.round(k)} cm acima do joelho` : `Barra ${Math.round(-k)} cm abaixo do joelho`);
  } else if ((g.kind === "miniSkirt" || g.kind === "midiSkirt") && row.lengthCm) {
    const top = g.kind === "miniSkirt" ? L.lowWaistY : L.waistY;
    const hemY = top - row.lengthCm;
    const target = g.kind === "miniSkirt" ? L.crotchY - 15 : L.kneeY - 21;
    lengthDeltaCm = round1(target - hemY);
    lengthPenalty = Math.max(0, Math.abs(lengthDeltaCm) - 5) * 1.5;
    const k = hemY - L.kneeY;
    if (g.kind === "midiSkirt") notes.push(k < -12 ? "Barra no meio da canela" : k < 0 ? `Barra ${Math.round(-k)} cm abaixo do joelho` : `Barra ${Math.round(k)} cm acima do joelho`);
    else notes.push(hemY > L.crotchY - 8 ? "Bem curta: barra logo abaixo do bumbum" : `Barra ${Math.round(k)} cm acima do joelho`);
  }

  const wsum = evals.reduce((s, e) => s + e.weight, 0);
  const base = wsum ? evals.reduce((s, e) => s + e.score * e.weight, 0) / wsum : 80;
  const raw = clamp(base - Math.min(25, lengthPenalty), 0, 100);
  const label = labelFrom(evals);
  return { result: { size: row.size, label, score: Math.round(raw), easeCm, lengthDeltaCm, notes: notes.slice(0, 3) }, raw };
}

const fitScoreRaw = (product: GarmentProduct, size: Size, m: BodyMeasurements) => evaluateFit(product, size, m).raw;

export function recommendSize(product: GarmentProduct, m: BodyMeasurements): Size {
  const rows = product.sizeChart;
  if (!rows.length || PROP_KINDS.includes(product.garment.kind) || product.garment.slot === "prop") return "U";
  if (rows.length === 1) return rows[0].size;
  // Empate (≤ 1 ponto): menor tamanho para slim/regular/cropped; maior para oversized/wide.
  const preferLarger = product.garment.silhouette === "oversized" || product.garment.silhouette === "wide";
  let best = rows[0].size;
  let bestScore = fitScoreRaw(product, rows[0].size, m);
  for (const row of rows.slice(1)) {
    const s = fitScoreRaw(product, row.size, m);
    if (s > bestScore + 1 || (preferLarger && s >= bestScore - 1)) {
      best = row.size;
      bestScore = Math.max(s, bestScore);
    }
  }
  return best;
}

const SLOT_WEIGHT: Record<string, number> = { head: 0.5, feet: 0.8 };

/** Índice de caimento do look (0–100). Objetos segurados (slot "prop") não entram na conta. */
export function lookFitScore(items: WornItem[]): number {
  let s = 0;
  let w = 0;
  for (const it of items) {
    if (it.product.garment.slot === "prop") continue;
    const k = SLOT_WEIGHT[it.product.garment.slot] ?? 1;
    s += it.fit.score * k;
    w += k;
  }
  return w ? Math.round(s / w) : 0;
}
