import type { GrpKey, PlanVariant, ProductUnit } from "@/lib/macros";

export interface PlanOptionSeedFields {
  name: string;
  grp: GrpKey;
  baseG: number | null;
  unit: ProductUnit;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  variants: PlanVariant[];
}

export interface PlanSeedProduct {
  name: string;
  baseG: number | null;
  baseKcal: number;
  baseProt: number;
  baseCarb: number;
  baseFat: number;
  grupo: GrpKey | null;
  unit: ProductUnit;
}

/**
 * Siembra una opción normal desde una foto del catálogo. Es una copia de valores,
 * no un vínculo persistente. Las opciones con variantes quedan intactas: sus
 * campos planos pertenecen a la primera variante y no admiten esta operación.
 */
export function seedPlanOptionFromProduct(
  current: PlanOptionSeedFields,
  product: PlanSeedProduct,
): PlanOptionSeedFields {
  if (current.variants.length > 0) return current;

  return {
    ...current,
    name: product.name,
    grp: product.grupo ?? current.grp,
    baseG: product.baseG,
    unit: product.unit,
    kcal: product.baseKcal,
    prot: product.baseProt,
    carb: product.baseCarb,
    fat: product.baseFat,
  };
}
