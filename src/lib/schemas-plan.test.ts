import { describe, expect, it } from "vitest";
import { dietVersionCreateZ, newEntryZ, optionPatchZ, optionZ } from "./schemas";

const legacyOption = {
  meal: "comida",
  grp: "Otros",
  name: "Bebida vegetal",
  baseG: 250,
  kcal: 40,
  prot: 1.8,
  carb: 0,
  fat: 3.5,
  variants: [],
};

describe("schemas de opciones del plan — F19", () => {
  it("acepta y conserva g/ml/ud", () => {
    expect(optionZ.parse({ ...legacyOption, unit: "ml" }).unit).toBe("ml");
    expect(optionZ.parse({ ...legacyOption, unit: "ud" }).unit).toBe("ud");
  });

  it("AC11: una dieta importada sin unidad usa g", () => {
    const parsed = dietVersionCreateZ.parse({
      effectiveFrom: "2026-07-26",
      kcal: 1800,
      prot: 110,
      carb: null,
      fat: null,
      options: [legacyOption],
    });

    expect(parsed.options[0]?.unit).toBe("g");
  });

  it("PATCH omitido conserva unit y variantes en vez de inyectar defaults", () => {
    expect(optionPatchZ.parse({ name: "Nuevo nombre" })).toEqual({
      name: "Nuevo nombre",
    });
  });

  it("una entrada diaria transporta ml y un cliente anterior cae a g", () => {
    const base = {
      meal: "almuerzo",
      name: "Bebida vegetal",
      kcal: 40,
      prot: 1.8,
      carb: 0,
      fat: 3.5,
      source: "plan",
    };
    expect(newEntryZ.parse({ ...base, unit: "ml" }).unit).toBe("ml");
    expect(newEntryZ.parse(base).unit).toBe("g");
  });
});
