import { describe, expect, it } from "vitest";
import {
  copiedPlanOptionRow,
  importedPlanOptionRow,
  pocPlanOptionValues,
} from "./plan-options-map";

const option = {
  meal: "comida" as const,
  grp: "Otros" as const,
  name: "Bebida vegetal",
  baseG: 250,
  unit: "ml" as const,
  kcal: 40,
  prot: 1.8,
  carb: 0,
  fat: 3.5,
  variants: [],
};

describe("mapeos de plan_options — F19 Fase 2", () => {
  it("AC11: cambiar objetivos copia la unidad", () => {
    const row = copiedPlanOptionRow({ ...option, sort: 4 }, 99);

    expect(row.dietVersionId).toBe(99);
    expect(row.unit).toBe("ml");
    expect(row.sort).toBe(4);
  });

  it("AC11: una dieta importada anterior a F19 usa g", () => {
    const legacy = {
      meal: option.meal,
      grp: option.grp,
      name: option.name,
      baseG: option.baseG,
      kcal: option.kcal,
      prot: option.prot,
      carb: option.carb,
      fat: option.fat,
      variants: option.variants,
    };
    expect(importedPlanOptionRow(legacy, 3, 0).unit).toBe("g");
  });

  it("AC10: una opción migrada desde el PoC usa g", () => {
    expect(pocPlanOptionValues(option).unit).toBe("g");
  });
});
