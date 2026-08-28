import type { GrpKey, Macros, ProductUnit } from "@/lib/macros";
import type { DietImportValues } from "@/lib/diet-import-reconciliation";
import type { LabelReadResult } from "@/server/ai/schemas";

export interface LabelNutritionChoice {
  basis: "serving" | "main";
  quantity: number | null;
  unit: ProductUnit;
  kcal: number | null;
  prot: number | null;
  carb: number | null;
  fat: number | null;
}

export interface LabelProductSaveState {
  enabled: boolean;
  complete: boolean;
  productId: number | null;
  productName: string;
  basis: LabelNutritionChoice["basis"];
}

export interface LabelProductWrite {
  productId: number | null;
  fields: {
    name: string;
    baseG: number;
    baseKcal: number;
    baseProt: number;
    baseCarb: number;
    baseFat: number;
    grupo: GrpKey;
    source: "etiqueta";
    unit: ProductUnit;
  };
}

const sameQuantity = (left: number, right: number): boolean =>
  Math.abs(left - right) < 0.001;

/**
 * Elige una columna que YA figura en la etiqueta. Si la ración impresa coincide
 * con la cantidad/unidad pautadas, gana completa; en otro caso gana la base
 * principal. No multiplica, divide ni completa ningún valor ausente.
 */
export function selectLabelNutrition(
  label: LabelReadResult,
  targetQuantity: number | null,
  targetUnit: ProductUnit | null,
): LabelNutritionChoice {
  const serving = label.racion;
  if (
    serving &&
    targetQuantity != null &&
    sameQuantity(serving.cantidad, targetQuantity) &&
    (targetUnit == null || serving.unidad === targetUnit)
  ) {
    return {
      basis: "serving",
      quantity: serving.cantidad,
      unit: serving.unidad,
      kcal: serving.kcal,
      prot: serving.proteina_g,
      carb: serving.carbohidratos_g,
      fat: serving.grasa_g,
    };
  }

  return {
    basis: "main",
    quantity: label.base_g,
    unit: label.unidad,
    kcal: label.kcal,
    prot: label.proteina_g,
    carb: label.carbohidratos_g,
    fat: label.grasa_g,
  };
}

/** Una ficha de producto no debe fijar como «etiqueta» valores ausentes. */
export function isCompleteLabelNutrition(
  choice: LabelNutritionChoice,
): choice is LabelNutritionChoice & { quantity: number } & Macros {
  return (
    choice.quantity != null &&
    choice.quantity > 0 &&
    choice.kcal != null &&
    choice.prot != null &&
    choice.carb != null &&
    choice.fat != null
  );
}

/**
 * Aplica la columna leída a una fila plana. Los `null` conservan el dato revisable
 * que ya había en la fila; no se inventan ceros. Las variantes no entran aquí por
 * contrato de F27.
 */
export function applyLabelNutritionToDiet(
  current: DietImportValues,
  label: LabelReadResult,
  choice: LabelNutritionChoice,
  group: GrpKey,
): DietImportValues {
  return {
    ...current,
    name: label.nombre.trim() || current.name,
    grp: group,
    baseG: choice.quantity,
    unit: choice.unit,
    kcal: choice.kcal ?? current.kcal,
    prot: choice.prot ?? current.prot,
    carb: choice.carb ?? current.carb,
    fat: choice.fat ?? current.fat,
    variants: [],
  };
}

/**
 * Segundo destino de la lectura. Solo existe si la fuente de etiqueta sigue
 * aplicada, Alex no desactivó el toggle y la columna leída estaba completa.
 */
export function buildLabelProductWrite(
  values: DietImportValues,
  selectedSourceKey: string,
  save: LabelProductSaveState | null,
): LabelProductWrite | null {
  if (
    selectedSourceKey !== "label-read" ||
    !save?.enabled ||
    !save.complete ||
    values.baseG == null ||
    values.baseG <= 0
  ) {
    return null;
  }
  return {
    productId: save.productId,
    fields: {
      name: values.name.trim(),
      baseG: values.baseG,
      baseKcal: Math.round(values.kcal),
      baseProt: values.prot,
      baseCarb: values.carb,
      baseFat: values.fat,
      grupo: values.grp,
      source: "etiqueta",
      unit: values.unit,
    },
  };
}
