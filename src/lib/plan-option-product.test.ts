import { describe, expect, it } from "vitest";
import {
  rescalePlanOptionMacros,
  seedPlanOptionFromProduct,
  type PlanOptionSeedFields,
} from "./plan-option-product";

const current = (overrides: Partial<PlanOptionSeedFields> = {}): PlanOptionSeedFields => ({
  name: "Opción manual",
  grp: "Opción única",
  baseG: 250,
  unit: "g",
  kcal: 60,
  prot: 2,
  carb: 1,
  fat: 6,
  variants: [],
  ...overrides,
});

const product = {
  name: "Bebida de almendras Lidl 0%",
  baseG: 100,
  baseKcal: 16,
  baseProt: 0.7,
  baseCarb: 0,
  baseFat: 1.4,
  grupo: "Otros" as const,
  unit: "ml" as const,
};

describe("seedPlanOptionFromProduct — F19 Fase 2", () => {
  it("AC8: copia nombre, base, unidad, macros y grupo a una opción sin variantes", () => {
    const source = { ...product };
    const seeded = seedPlanOptionFromProduct(current(), source);

    expect(seeded).toMatchObject({
      name: product.name,
      grp: "Otros",
      baseG: 100,
      unit: "ml",
      kcal: 16,
      prot: 0.7,
      carb: 0,
      fat: 1.4,
      variants: [],
    });

    // Es una foto independiente: cambiar el objeto fuente no altera la opción.
    source.baseKcal = 99;
    expect(seeded.kcal).toBe(16);
  });

  it("AC8: producto sin grupo conserva el grupo actual", () => {
    const seeded = seedPlanOptionFromProduct(
      current({ grp: "Proteína" }),
      { ...product, grupo: null },
    );

    expect(seeded.grp).toBe("Proteína");
  });

  it("AC9: una opción con variantes permanece intacta", () => {
    const option = current({
      variants: [
        { nombre: "Pollo", kcal: 231, prot: 46, carb: 0, fat: 5 },
        { nombre: "Pavo", kcal: 225, prot: 47, carb: 0, fat: 4 },
      ],
    });

    expect(seedPlanOptionFromProduct(option, product)).toBe(option);
  });
});

describe("rescalePlanOptionMacros — quick-fix gramos del Plan", () => {
  it("reescalada desde la base estable al cambiar los gramos de una opción normal", () => {
    const basis = {
      baseG: 10,
      kcal: 52,
      prot: 0.4,
      carb: 11,
      fat: 0.1,
    };

    expect(rescalePlanOptionMacros(basis, 20)).toEqual({
      kcal: 104,
      prot: 0.8,
      carb: 22,
      fat: 0.2,
    });
    expect(rescalePlanOptionMacros(basis, 5)).toEqual({
      kcal: 26,
      prot: 0.2,
      carb: 5.5,
      fat: 0.1,
    });
  });

  it("sin una base válida conserva los macros", () => {
    const fixed = { baseG: null, kcal: 52, prot: 0.4, carb: 11, fat: 0.1 };

    expect(rescalePlanOptionMacros(fixed, 20)).toEqual({
      kcal: 52,
      prot: 0.4,
      carb: 11,
      fat: 0.1,
    });
  });
});
