import { describe, expect, it } from "vitest";
import { PLAN } from "@/server/db/plan-seed";
import { derivePlanTargets, type DerivedInputOption } from "./planDerived";

describe("derivePlanTargets — fixture pequeño (valores exactos a mano)", () => {
  // Almuerzo (elegir 1): media de las 2 opciones.
  // Comida (1 por grupo): 1 grupo Hidratos con 2 opciones (media) + 1 Proteína.
  // Merienda (conjunto): suma de las 2.
  const fixture: DerivedInputOption[] = [
    { meal: "almuerzo", grp: "Opción única", kcal: 100, prot: 2, carb: 20, fat: 1 },
    { meal: "almuerzo", grp: "Opción única", kcal: 200, prot: 4, carb: 40, fat: 3 },
    { meal: "comida", grp: "Hidratos", kcal: 150, prot: 4, carb: 30, fat: 1 },
    { meal: "comida", grp: "Hidratos", kcal: 250, prot: 6, carb: 50, fat: 3 },
    { meal: "comida", grp: "Proteína", kcal: 200, prot: 40, carb: 0, fat: 5 },
    { meal: "merienda", grp: "Otros", kcal: 160, prot: 5, carb: 31, fat: 1 },
    { meal: "merienda", grp: "Otros", kcal: 40, prot: 0, carb: 2, fat: 0 },
  ];

  it("calcula kcal/macros y rango kmin/kmax", () => {
    const d = derivePlanTargets(fixture);
    // almuerzo mean kcal = (100+200)/2 = 150 ; kmin 100, kmax 200
    // comida = Hidratos mean (150+250)/2=200 + Proteína 200 = 400 ; kmin 150+200=350, kmax 250+200=450
    // merienda sum = 200 ; kmin=kmax=200
    expect(d.kcal).toBe(150 + 400 + 200); // 750
    expect(d.kmin).toBe(100 + 350 + 200); // 650
    expect(d.kmax).toBe(200 + 450 + 200); // 850
    // prot: almuerzo (2+4)/2=3 ; comida Hidratos (4+6)/2=5 + Prot 40 = 45 ; merienda 5+0=5
    expect(d.prot).toBe(3 + 45 + 5); // 53
    // carb: almuerzo (20+40)/2=30 ; comida Hidr (30+50)/2=40 + Prot 0 = 40 ; merienda 31+2=33
    expect(d.carb).toBe(30 + 40 + 33); // 103
    // fat: almuerzo (1+3)/2=2 ; comida Hidr (1+3)/2=2 + Prot 5 = 7 ; merienda 1+0=1
    expect(d.fat).toBe(2 + 7 + 1); // 10
  });

  it("ignora las opciones de 'extra'", () => {
    const withExtra: DerivedInputOption[] = [
      ...fixture,
      { meal: "extra", grp: "Otros", kcal: 999, prot: 99, carb: 99, fat: 99 },
    ];
    expect(derivePlanTargets(withExtra)).toEqual(derivePlanTargets(fixture));
  });
});

describe("derivePlanTargets — plan semilla Regenera (valores exactos)", () => {
  const d = derivePlanTargets(PLAN);

  it("reproduce el derivado exacto del seed", () => {
    // Calculado a mano desde plan-seed.ts:
    //   almuerzo mean kcal 132.5 · comida 610.25 · merienda 288 · cena 594.75
    expect(d.kcal).toBeCloseTo(1625.5, 5);
    expect(d.prot).toBeCloseTo(104.625, 5);
    expect(d.carb).toBeCloseTo(150, 5);
    expect(d.fat).toBeCloseTo(66.875, 5);
    expect(d.kmin).toBe(1270); // 50 + 465 + 288 + 467
    expect(d.kmax).toBe(2013); // 230 + 765 + 288 + 730
  });

  it("cae en el orden de magnitud del AC (F1.4): medio ~1.700-1.800, rango ~1.550-1.950", () => {
    // El AC es aproximado; el seed da ~1.626 medio y 1.270-2.013 de rango.
    expect(d.kcal).toBeGreaterThan(1500);
    expect(d.kcal).toBeLessThan(1900);
    expect(d.kmin).toBeGreaterThan(1100);
    expect(d.kmax).toBeLessThan(2100);
  });
});
