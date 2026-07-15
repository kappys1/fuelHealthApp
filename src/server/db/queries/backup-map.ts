import * as schema from "../schema";

/*
  Mapeos puros del restore (sin dependencia del cliente de BD) → testeables sin
  conexión. Hoy: la fila de meal_entries, que conserva la base inmutable + cantidad
  (F06) en el round-trip export → restore (AC6).
*/

const n = (v: unknown): number | null =>
  v == null || v === "" ? null : Number(v);
const s = (v: unknown): string | null => (v == null ? null : String(v));
const dt = (v: unknown): Date => (v ? new Date(String(v)) : new Date());

/**
 * Mapea una fila de meal_entries del archivo de export a la fila de inserción,
 * conservando la base inmutable + cantidad (F06). Los campos de base son nullable
 * (aditivos): un export previo a F06 no los trae → quedan null (entrada fija).
 */
export function mealEntryImportRow(r: Record<string, unknown>) {
  return {
    date: String(r.date),
    meal: r.meal as (typeof schema.mealEnum.enumValues)[number],
    name: String(r.name ?? ""),
    kcal: Number(r.kcal ?? 0),
    prot: Number(r.prot ?? 0),
    carb: Number(r.carb ?? 0),
    fat: Number(r.fat ?? 0),
    source: r.source as (typeof schema.mealSourceEnum.enumValues)[number],
    photoUrl: s(r.photoUrl),
    grams: n(r.grams),
    baseG: n(r.baseG),
    baseKcal: n(r.baseKcal),
    baseProt: n(r.baseProt),
    baseCarb: n(r.baseCarb),
    baseFat: n(r.baseFat),
    createdAt: dt(r.createdAt),
  };
}
