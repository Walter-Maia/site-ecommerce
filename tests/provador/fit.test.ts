import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/catalog";
import type { GarmentProduct } from "@/lib/provador/contract";
import { computeFit, estimateMeasurements, fitRules, lookFitScore, recommendSize } from "@/lib/provador/fit";
import { bodyLandmarks } from "@/lib/provador/landmarks";
import { dressItem } from "@/lib/provador/outfit";

/** Produtos pelo id (estável) — os slugs mudam quando a marca é renomeada. */
const P = (id: string): GarmentProduct => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`produto ausente: ${id}`);
  return p;
};

const kaue = estimateMeasurements({ body: "masculino", heightCm: 178, weightKg: 74 });
const mia = estimateMeasurements({ body: "feminino", heightCm: 166, weightKg: 58 });
const big = estimateMeasurements({ body: "masculino", heightCm: 190, weightKg: 120 });
const petite = estimateMeasurements({ body: "feminino", heightCm: 150, weightKg: 45 });
const tall = estimateMeasurements({ body: "masculino", heightCm: 195, weightKg: 90 });

describe("estimateMeasurements", () => {
  it("gera medidas plausíveis para adulto masculino médio", () => {
    expect(kaue.chestCm).toBeGreaterThan(92);
    expect(kaue.chestCm).toBeLessThan(102);
    expect(kaue.waistCm).toBeGreaterThan(78);
    expect(kaue.waistCm).toBeLessThan(88);
    expect(kaue.inseamCm).toBeGreaterThan(79);
    expect(kaue.inseamCm).toBeLessThan(87);
    expect(kaue.footCm).toBeGreaterThan(26);
    expect(kaue.footCm).toBeLessThan(28);
    expect(kaue.headCm).toBeGreaterThan(55);
    expect(kaue.headCm).toBeLessThan(60);
  });

  it("feminino tem quadril maior que busto e cintura marcada", () => {
    expect(mia.hipCm).toBeGreaterThan(mia.chestCm);
    expect(mia.waistCm).toBeLessThan(mia.chestCm - 12);
    expect(mia.bmi).toBeCloseTo(21, 0);
  });

  it("IMC alto: no masculino a cintura cresce mais rápido; no feminino o quadril", () => {
    const m1 = estimateMeasurements({ body: "masculino", heightCm: 175, weightKg: 70 });
    const m2 = estimateMeasurements({ body: "masculino", heightCm: 175, weightKg: 100 });
    const f1 = estimateMeasurements({ body: "feminino", heightCm: 165, weightKg: 60 });
    const f2 = estimateMeasurements({ body: "feminino", heightCm: 165, weightKg: 90 });
    expect(m2.waistCm - m1.waistCm).toBeGreaterThan(m2.chestCm - m1.chestCm);
    expect(m2.waistCm - m1.waistCm).toBeGreaterThan(m2.hipCm - m1.hipCm);
    expect(f2.hipCm - f1.hipCm).toBeGreaterThan(f2.chestCm - f1.chestCm);
  });

  it("pernas crescem proporcionalmente mais que o tronco com a altura", () => {
    const short = estimateMeasurements({ body: "masculino", heightCm: 160, weightKg: 60 });
    const longer = estimateMeasurements({ body: "masculino", heightCm: 200, weightKg: 94 });
    expect(longer.inseamCm / longer.heightCm).toBeGreaterThan(short.inseamCm / short.heightCm);
    expect(longer.inseamCm - short.inseamCm).toBeGreaterThan(longer.torsoLengthCm - short.torsoLengthCm);
  });

  it("respeita BODY_LIMITS", () => {
    const m = estimateMeasurements({ body: "feminino", heightCm: 120, weightKg: 300 });
    expect(m.heightCm).toBe(145);
    expect(m.weightKg).toBe(150);
    expect(Number.isFinite(m.chestCm)).toBe(true);
  });

  it("marcos verticais em ordem anatômica", () => {
    for (const m of [kaue, mia, big, petite, tall]) {
      const L = bodyLandmarks(m);
      expect(L.ankleY).toBeLessThan(L.kneeY);
      expect(L.kneeY).toBeLessThan(L.crotchY);
      expect(L.crotchY).toBeLessThan(L.hipY);
      expect(L.hipY).toBeLessThan(L.waistY);
      expect(L.waistY).toBeLessThan(L.chestY);
      expect(L.chestY).toBeLessThan(L.neckBaseY);
      expect(L.neckBaseY).toBeLessThan(L.chinY);
      const rise = L.waistY - L.crotchY;
      expect(rise).toBeGreaterThan(20);
      expect(rise).toBeLessThan(36);
    }
  });
});

describe("recommendSize", () => {
  it("178 cm / 74 kg masculino → M ou G na tee oversized", () => {
    expect(["M", "G"]).toContain(recommendSize(P("p01"), kaue));
  });

  it("166 cm / 58 kg feminino → P ou M na baby tee", () => {
    expect(["P", "M"]).toContain(recommendSize(P("p17"), mia));
  });

  it("190 cm / 120 kg → XGG na tee e no moletom oversized", () => {
    expect(recommendSize(P("p01"), big)).toBe("XGG");
    expect(recommendSize(P("p06"), big)).toBe("XGG");
  });

  it("150 cm / 45 kg feminino → menores tamanhos", () => {
    expect(["PP", "P"]).toContain(recommendSize(P("p23"), petite));
    expect(["PP", "P"]).toContain(recommendSize(P("p22"), petite));
  });

  it("calçado pelo comprimento do pé", () => {
    expect(["40", "41"]).toContain(recommendSize(P("p27"), kaue));
    expect(["37", "38"]).toContain(recommendSize(P("p28"), mia));
  });

  it("alfaiataria regular pela cintura", () => {
    expect(["M", "G"]).toContain(recommendSize(P("p15"), kaue));
    expect(["M", "G"]).toContain(recommendSize(P("p16"), kaue));
  });

  it("boné tamanho único", () => {
    expect(recommendSize(P("p25"), kaue)).toBe("U");
  });
});

describe("computeFit", () => {
  const tee = P("p01");

  it("tamanho maior fica mais solto e menor mais justo", () => {
    const pp = computeFit(tee, "P", big);
    const xg = computeFit(tee, "XGG", kaue);
    expect(["apertado", "justo"]).toContain(pp.label);
    expect(["solto", "grande"]).toContain(xg.label);
    expect(xg.easeCm.chest!).toBeGreaterThan(30);
    expect(pp.easeCm.chest!).toBeLessThan(10);
    const ideal = computeFit(tee, "M", kaue);
    expect(ideal.label).toBe("ideal");
    expect(ideal.score).toBeGreaterThan(pp.score);
    expect(ideal.score).toBeGreaterThan(xg.score);
  });

  it("score entre 0 e 100 e notas curtas em pt-BR", () => {
    for (const p of PRODUCTS) {
      for (const row of p.sizeChart) {
        const f = computeFit(p, row.size, kaue);
        expect(f.score).toBeGreaterThanOrEqual(0);
        expect(f.score).toBeLessThanOrEqual(100);
        expect(f.notes.length).toBeGreaterThan(0);
        for (const n of f.notes) expect(n.length).toBeLessThan(80);
      }
    }
  });

  it("slim canelado aceita folga negativa pela elasticidade", () => {
    const f = computeFit(P("p18"), "M", mia);
    expect(f.easeCm.chest!).toBeLessThan(0);
    expect(["ideal", "justo"]).toContain(f.label);
  });

  it("calça empilha quando a entrepernas da peça passa da perna + 6 cm", () => {
    const jeans = P("p13");
    const f = computeFit(jeans, "P", petite);
    expect(f.lengthDeltaCm!).toBeGreaterThan(6);
    expect(f.notes.join(" ")).toMatch(/empilha/);
  });

  it("calça fica curta numa perna longa", () => {
    const pants = P("p12");
    const f = computeFit(pants, "P", tall);
    expect(f.lengthDeltaCm!).toBeLessThan(-5);
    expect(f.notes.join(" ")).toMatch(/curta|tornozelo/);
  });

  it("cós elástico do moletom tolera cintura um pouco maior", () => {
    const pants = P("p12");
    const f = computeFit(pants, "M", kaue);
    expect(f.easeCm.waist!).toBeLessThan(0);
    expect(f.easeCm.waist!).toBeGreaterThan(-6);
    expect(["ideal", "solto"]).toContain(f.label);
  });

  it("saia e slip pelo quadril", () => {
    const slip = computeFit(P("p22"), "PP", big);
    expect(slip.label).toBe("apertado");
    const midi = computeFit(P("p19"), "M", mia);
    expect(midi.easeCm.hip).toBeDefined();
    expect(midi.notes.join(" ")).toMatch(/canela|joelho/);
  });

  it("tee oversized: barra mais longa num corpo baixo", () => {
    const a = computeFit(tee, "M", petite);
    const b = computeFit(tee, "M", tall);
    expect(a.lengthDeltaCm!).toBeGreaterThan(b.lengthDeltaCm!);
  });

  it("boné pela regulagem e tênis ±0,5 cm", () => {
    const cap = computeFit(P("p25"), "U", kaue);
    expect(cap.label).toBe("ideal");
    const shoe = P("p27");
    const ok = computeFit(shoe, recommendSize(shoe, kaue), kaue);
    expect(ok.label).toBe("ideal");
    expect(Math.abs(ok.easeCm.foot!)).toBeLessThanOrEqual(0.5);
    expect(computeFit(shoe, "37", kaue).label).toBe("apertado");
  });
});

describe("lookFitScore", () => {
  it("média ponderada do look e 0 sem peças", () => {
    expect(lookFitScore([])).toBe(0);
    const items = ["p01", "p10", "p25", "p27"].map((s) =>
      dressItem(P(s), kaue),
    );
    const s = lookFitScore(items);
    expect(s).toBeGreaterThan(80);
    expect(s).toBeLessThanOrEqual(100);
  });
});

/* ───────────── Linha skate / workwear ───────────── */

describe("linha skate: regras de folga", () => {
  it("toda peça do catálogo tem regra (inclusive os tipos novos) e notas curtas", () => {
    for (const p of PRODUCTS) {
      const rules = fitRules(p.garment);
      expect(rules).toBeTypeOf("object");
      const f = computeFit(p, recommendSize(p, mia), mia);
      expect(f.notes.length).toBeGreaterThan(0);
      for (const n of f.notes) expect(n.length).toBeLessThan(80);
    }
  });

  it("manga longa veste como camiseta e avisa onde termina a manga", () => {
    const longTee = P("p30");
    expect(fitRules(longTee.garment)).toEqual(fitRules({ ...longTee.garment, kind: "tee" }));
    const f = computeFit(longTee, recommendSize(longTee, kaue), kaue);
    expect(f.notes.join(" ")).toMatch(/[Mm]anga/);
    expect(["ideal", "solto", "justo"]).toContain(f.label);
  });

  it("moletom com zíper segue a folga do moletom canguru", () => {
    const zip = P("p31");
    expect(fitRules(zip.garment)).toEqual(fitRules({ ...zip.garment, kind: "hoodie" }));
    expect(recommendSize(zip, big)).toBe("XGG");
  });

  it("jaqueta workwear regular: folga ideal de +12 a +18 no peito", () => {
    const rule = fitRules({ kind: "workJacket", silhouette: "regular", pattern: "canvas" }).chest!;
    expect(rule.ideal).toEqual([12, 18]);
    const jacket = P("p33");
    const row = jacket.sizeChart.find((r) => r.chestCm! - big.chestCm >= 12 && r.chestCm! - big.chestCm <= 18);
    if (row) expect(computeFit(jacket, row.size, big).label).toBe("ideal");
  });

  it("cargo veste pela cintura e aceita folga ampla no quadril", () => {
    const cargo = P("p34");
    const size = recommendSize(cargo, kaue);
    const f = computeFit(cargo, size, kaue);
    expect(Math.abs(f.easeCm.waist!)).toBeLessThanOrEqual(5);
    expect(f.easeCm.hip!).toBeGreaterThan(10);
    expect(f.label).toBe("ideal");
    expect(f.notes.join(" ")).toMatch(/[Bb]arra/);
  });

  it("bermuda cargo mede a barra em relação ao joelho", () => {
    const shorts = P("p36");
    const f = computeFit(shorts, recommendSize(shorts, kaue), kaue);
    expect(f.lengthDeltaCm).toBeDefined();
    expect(f.notes.join(" ")).toMatch(/joelho/);
  });

  it("gorro: malha elástica pela cabeça", () => {
    const beanie = P("p37");
    expect(recommendSize(beanie, kaue)).toBe("U");
    const f = computeFit(beanie, "U", kaue);
    expect(f.label).toBe("ideal");
    expect(f.notes[0]).toMatch(/Malha canelada veste de \d+ a \d+ cm/);
    expect(computeFit(beanie, "U", big).label).not.toBe("apertado");
  });

  it("tênis de skate: pelo comprimento do pé, ±0,5 cm", () => {
    for (const id of ["p38", "p39"]) {
      const shoe = P(id);
      const size = recommendSize(shoe, kaue);
      const f = computeFit(shoe, size, kaue);
      expect(f.label).toBe("ideal");
      expect(Math.abs(f.easeCm.foot!)).toBeLessThanOrEqual(0.5);
      expect(computeFit(shoe, "37", kaue).label).toBe("apertado");
    }
  });
});

describe("skate (slot prop)", () => {
  const board = P("p40");

  it("sempre ideal, nota 100, tamanho único, nota curta sobre o shape", () => {
    for (const m of [kaue, mia, big, petite, tall]) {
      expect(recommendSize(board, m)).toBe("U");
      const f = computeFit(board, "U", m);
      expect(f).toMatchObject({ size: "U", label: "ideal", score: 100 });
      expect(f.notes).toHaveLength(1);
      expect(f.notes[0]).toMatch(/^Shape 8,25" — /);
      expect(f.notes[0].length).toBeLessThan(80);
    }
  });

  it("qualquer tamanho pedido vira U", () => {
    expect(computeFit(board, "M", kaue).size).toBe("U");
  });

  it("lookFitScore ignora o prop", () => {
    const look = ["p37", "p29", "p34", "p38"].map((id) => dressItem(P(id), kaue));
    const withBoard = [...look, dressItem(board, kaue)];
    expect(lookFitScore(withBoard)).toBe(lookFitScore(look));
    expect(lookFitScore([dressItem(board, kaue)])).toBe(0);
  });
});
