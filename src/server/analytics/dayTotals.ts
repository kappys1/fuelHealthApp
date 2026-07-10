/*
  Totales del día (03-DATOS §3): suma de meal_entries por fecha.
  Función pura. El redondeo se hace al MOSTRAR (los totales cuadran con la suma
  visible → 07 §6), no aquí.
*/
import type { Macros, MealKey } from "@/lib/macros";
import { MEAL_ORDER, sumMacros } from "@/lib/macros";

export interface EntryLike extends Macros {
  meal: MealKey;
}

/** Total de macros del día. */
export function dayTotals(entries: readonly EntryLike[]): Macros {
  return sumMacros(entries);
}

/** Subtotales de kcal por comida (para los subtotales del timeline, 09 §3). */
export function subtotalsByMeal(
  entries: readonly EntryLike[],
): Record<MealKey, Macros> {
  const empty = (): Macros => ({ kcal: 0, prot: 0, carb: 0, fat: 0 });
  const out = Object.fromEntries(
    MEAL_ORDER.map((m) => [m, empty()]),
  ) as Record<MealKey, Macros>;
  for (const e of entries) {
    const acc = out[e.meal];
    acc.kcal += e.kcal;
    acc.prot += e.prot;
    acc.carb += e.carb;
    acc.fat += e.fat;
  }
  return out;
}
