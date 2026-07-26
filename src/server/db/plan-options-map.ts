import type {
  GrpKey,
  MealKey,
  PlanVariant,
  ProductUnit,
} from "@/lib/macros";

interface PlanOptionValues {
  meal: MealKey;
  grp: GrpKey;
  name: string;
  baseG: number | null;
  unit?: ProductUnit;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  variants?: PlanVariant[];
}

/** Foto completa de una opción al versionar objetivos: no pierde unidad/variantes. */
export function copiedPlanOptionRow(
  option: PlanOptionValues & { sort: number; unit: ProductUnit },
  dietVersionId: number,
) {
  return {
    dietVersionId,
    meal: option.meal,
    grp: option.grp,
    name: option.name,
    baseG: option.baseG,
    unit: option.unit,
    kcal: option.kcal,
    prot: option.prot,
    carb: option.carb,
    fat: option.fat,
    variants: option.variants ?? [],
    sort: option.sort,
  };
}

/** Dieta importada: un payload anterior a F19 mantiene el rótulo histórico en g. */
export function importedPlanOptionRow(
  option: PlanOptionValues,
  dietVersionId: number,
  sort: number,
) {
  return {
    dietVersionId,
    meal: option.meal,
    grp: option.grp,
    name: option.name,
    baseG: option.baseG,
    unit: option.unit ?? "g",
    kcal: option.kcal,
    prot: option.prot,
    carb: option.carb,
    fat: option.fat,
    variants: option.variants ?? [],
    sort,
  };
}

/** Campos de una opción del PoC: ese formato nunca tuvo unidad y equivale a g. */
export function pocPlanOptionValues(option: {
  name: string;
  baseG?: number | null;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}) {
  return {
    name: option.name,
    baseG: option.baseG ?? null,
    unit: "g" as const,
    kcal: Math.round(option.kcal),
    prot: option.prot,
    carb: option.carb,
    fat: option.fat,
  };
}
