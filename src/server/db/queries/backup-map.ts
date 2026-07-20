import type { PlanVariant } from "@/lib/macros";
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
/**
 * Normaliza el jsonb `variants` de una fila de plan_options del export (F08). Un
 * export previo a F08 no lo trae → []; nunca inventa. Coerciona macros por si el
 * archivo las trae como string. Cada variante lleva sus macros a los gramos
 * pautados de la opción (base_g).
 */
export function variantsFromRow(v: unknown): PlanVariant[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      nombre: String(o.nombre ?? ""),
      kcal: Number(o.kcal ?? 0),
      prot: Number(o.prot ?? 0),
      carb: Number(o.carb ?? 0),
      fat: Number(o.fat ?? 0),
    };
  });
}

/**
 * Mapea una fila de plan_options del archivo de export a la fila de inserción,
 * conservando las variantes (F08) en el round-trip. `dietVersionId` ya viene
 * remapeado por el llamador (el restore reasigna ids de diet_versions).
 */
export function planOptionImportRow(
  r: Record<string, unknown>,
  dietVersionId: number,
) {
  return {
    dietVersionId,
    meal: r.meal as (typeof schema.mealEnum.enumValues)[number],
    grp: r.grp as (typeof schema.grpEnum.enumValues)[number],
    name: String(r.name ?? ""),
    baseG: n(r.baseG),
    kcal: Number(r.kcal ?? 0),
    prot: Number(r.prot ?? 0),
    carb: Number(r.carb ?? 0),
    fat: Number(r.fat ?? 0),
    variants: variantsFromRow(r.variants),
    sort: Number(r.sort ?? 0),
  };
}

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

/** Mapea el marcador temporal sin inventar hora para exports antiguos. */
export function bloatEventImportRow(r: Record<string, unknown>) {
  return {
    date: String(r.date),
    severity: r.severity as (typeof schema.bloatEnum.enumValues)[number],
    occurredAt: String(r.occurredAt),
    createdAt: dt(r.createdAt),
  };
}
