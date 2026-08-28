import { describe, expect, it } from "vitest";
import type { LabelReadResult } from "@/server/ai/schemas";
import type { DietImportValues } from "./diet-import-reconciliation";
import { productToEntryFields } from "./macros";
import {
  applyLabelNutritionToDiet,
  buildLabelProductWrite,
  isCompleteLabelNutrition,
  selectLabelNutrition,
} from "./label-nutrition";

const gazpacho: LabelReadResult = {
  nombre: "Gazpacho Lidl",
  unidad: "ml",
  base_g: 100,
  kcal: 37,
  proteina_g: 0.6,
  carbohidratos_g: 3,
  grasa_g: 2.3,
  racion: {
    cantidad: 200,
    unidad: "ml",
    kcal: 75,
    proteina_g: 1.2,
    carbohidratos_g: 6,
    grasa_g: 4.6,
  },
  grupo: "Verdura",
};

const row: DietImportValues = {
  meal: "comida",
  grp: "Verdura",
  name: "Gazpacho",
  baseG: 200,
  unit: "g",
  kcal: 70,
  prot: 1,
  carb: 6,
  fat: 4,
  variants: [],
};

describe("selección pura de columna de etiqueta", () => {
  it("200 sin unidad explícita usa la ración impresa: 75, nunca 74", () => {
    const choice = selectLabelNutrition(gazpacho, 200, null);
    expect(choice).toEqual({
      basis: "serving",
      quantity: 200,
      unit: "ml",
      kcal: 75,
      prot: 1.2,
      carb: 6,
      fat: 4.6,
    });
    expect(applyLabelNutritionToDiet(row, gazpacho, choice, "Verdura")).toMatchObject({
      name: "Gazpacho Lidl",
      baseG: 200,
      unit: "ml",
      kcal: 75,
      prot: 1.2,
      carb: 6,
      fat: 4.6,
    });
  });

  it("otra cantidad o unidad incompatible usa la base principal sin recalcular", () => {
    expect(selectLabelNutrition(gazpacho, 250, "ml")).toMatchObject({
      basis: "main",
      quantity: 100,
      unit: "ml",
      kcal: 37,
    });
    expect(selectLabelNutrition(gazpacho, 200, "g")).toMatchObject({
      basis: "main",
      quantity: 100,
      unit: "ml",
      kcal: 37,
    });
  });

  it("null permanece null y no habilita guardar una ficha falsa", () => {
    const incomplete: LabelReadResult = {
      ...gazpacho,
      proteina_g: null,
      racion: null,
    };
    const choice = selectLabelNutrition(incomplete, 250, "ml");
    expect(choice.prot).toBeNull();
    expect(isCompleteLabelNutrition(choice)).toBe(false);
    expect(applyLabelNutritionToDiet(row, incomplete, choice, "Verdura").prot).toBe(1);
  });

  it("la ración canónica sí es una ficha completa guardable", () => {
    expect(isCompleteLabelNutrition(selectLabelNutrition(gazpacho, 200, "ml"))).toBe(true);
  });

  it("desactivar Mis productos conserva la corrección de fila pero no produce escritura", () => {
    const values = applyLabelNutritionToDiet(
      row,
      gazpacho,
      selectLabelNutrition(gazpacho, 200, null),
      "Verdura",
    );
    const state = {
      enabled: false,
      complete: true,
      productId: 20,
      productName: "Gazpacho Lidl",
      basis: "serving" as const,
    };
    expect(values.kcal).toBe(75);
    expect(buildLabelProductWrite(values, "label-read", state)).toBeNull();
    expect(buildLabelProductWrite(values, "label-read", { ...state, enabled: true })).toMatchObject({
      productId: 20,
      fields: {
        baseG: 200,
        unit: "ml",
        baseKcal: 75,
        baseProt: 1.2,
        baseCarb: 6,
        baseFat: 4.6,
        source: "etiqueta",
      },
    });
  });

  it("guardar la ración impresa hace que futuros registros de 200 ml sigan dando 75 kcal", () => {
    const values = applyLabelNutritionToDiet(
      row,
      gazpacho,
      selectLabelNutrition(gazpacho, 200, null),
      "Verdura",
    );
    const write = buildLabelProductWrite(values, "label-read", {
      enabled: true,
      complete: true,
      productId: 20,
      productName: "Gazpacho Lidl",
      basis: "serving",
    });

    expect(write).not.toBeNull();
    expect(productToEntryFields(write!.fields, 200)).toMatchObject({
      grams: 200,
      kcal: 75,
      prot: 1.2,
      carb: 6,
      fat: 4.6,
    });
  });
});
