import { asc, desc, eq, lte } from "drizzle-orm";
import {
  displayMacro,
  type GrpKey,
  type MealKey,
  MEAL_ORDER,
  type PlanVariant,
} from "@/lib/macros";
import { derivePlanTargets, type DerivedTargets } from "@/server/analytics/planDerived";
import { db, schema } from "@/server/db";

export interface PlanOptionDTO {
  id: number;
  meal: MealKey;
  grp: GrpKey;
  name: string;
  baseG: number | null;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  // Variantes intercambiables (F08). [] = opción normal. Los campos planos de
  // arriba valen los de la 1ª variante (default) cuando hay variantes.
  variants: PlanVariant[];
  sort: number;
}

export interface DietVersionDTO {
  id: number;
  effectiveFrom: string;
  kcalTarget: number;
  protTarget: number;
  carbTarget: number | null;
  fatTarget: number | null;
  note: string | null;
}

export interface EffectiveTargets {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  /** true si carb/fat provienen del derivado del plan (no fijados por el nutri). */
  carbDerived: boolean;
  fatDerived: boolean;
}

export interface PlanContext {
  version: DietVersionDTO;
  options: PlanOptionDTO[];
  optionsByMeal: Record<MealKey, PlanOptionDTO[]>;
  derived: DerivedTargets;
  targets: EffectiveTargets;
}

/** Versión de dieta vigente en una fecha (la de effective_from más reciente ≤ date). */
export async function getVersionForDate(
  date: string,
): Promise<DietVersionDTO | null> {
  const rows = await db
    .select()
    .from(schema.dietVersions)
    .where(lte(schema.dietVersions.effectiveFrom, date))
    .orderBy(desc(schema.dietVersions.effectiveFrom), desc(schema.dietVersions.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Todas las versiones de dieta por effective_from ascendente (Historial, doc 10 B4). */
export async function listAllDietVersions(): Promise<DietVersionDTO[]> {
  return (await db
    .select()
    .from(schema.dietVersions)
    .orderBy(
      asc(schema.dietVersions.effectiveFrom),
      asc(schema.dietVersions.id),
    )) as DietVersionDTO[];
}

function groupByMeal(options: PlanOptionDTO[]): Record<MealKey, PlanOptionDTO[]> {
  const out = Object.fromEntries(
    MEAL_ORDER.map((m) => [m, [] as PlanOptionDTO[]]),
  ) as Record<MealKey, PlanOptionDTO[]>;
  for (const o of options) out[o.meal].push(o);
  return out;
}

export async function getPlanContext(date: string): Promise<PlanContext | null> {
  const version = await getVersionForDate(date);
  if (!version) return null;

  const options = (await db
    .select()
    .from(schema.planOptions)
    .where(eq(schema.planOptions.dietVersionId, version.id))
    .orderBy(asc(schema.planOptions.sort))) as PlanOptionDTO[];

  const derived = derivePlanTargets(options);

  const targets: EffectiveTargets = {
    kcal: version.kcalTarget,
    prot: version.protTarget,
    carb: version.carbTarget ?? displayMacro(derived.carb),
    fat: version.fatTarget ?? displayMacro(derived.fat),
    carbDerived: version.carbTarget == null,
    fatDerived: version.fatTarget == null,
  };

  return { version, options, optionsByMeal: groupByMeal(options), derived, targets };
}
