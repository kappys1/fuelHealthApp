import { asc } from "drizzle-orm";
import { dayKey } from "@/lib/dates";
import type { BloatKey, PhaseKey } from "@/lib/macros";
import type { DailyRecord, DayTarget } from "@/server/analytics/types";
import { db, schema } from "@/server/db";

/*
  Ensamblado de la serie diaria para la pantalla Tendencia (F6). Une days +
  health_metrics + meal_entries + diet_versions en `DailyRecord[]` (orden asc).

  Precedencia health_metrics > days (principio 6) para peso / agua / % grasa. El
  objetivo de cada día es el de su versión de dieta vigente entonces (F1.5). Las
  fórmulas (ma7, déficit, adherencia) son puras y viven en server/analytics; aquí
  solo se leen datos. Usuario único → se cargan todas las filas y se agregan en JS.
*/

export interface TrendData {
  records: DailyRecord[];
  /** Objetivo vigente hoy (para la línea de referencia de ingesta). */
  currentTarget: DayTarget;
  today: string;
}

interface VersionRow {
  effectiveFrom: string;
  kcalTarget: number;
  protTarget: number;
}

/** Versión vigente en una fecha: la de effectiveFrom más reciente ≤ date (o la más antigua). */
function targetForDate(versions: VersionRow[], date: string): DayTarget {
  let chosen: VersionRow | null = null;
  for (const v of versions) {
    if (v.effectiveFrom <= date) chosen = v;
    else break; // versions viene ordenada asc
  }
  const v = chosen ?? versions[0];
  return v ? { kcal: v.kcalTarget, prot: v.protTarget } : { kcal: 1800, prot: 110 };
}

export async function getTrendData(today: string = dayKey()): Promise<TrendData> {
  const [dayRows, healthRows, entryRows, versionRows] = await Promise.all([
    db.select().from(schema.days),
    db.select().from(schema.healthMetrics),
    db
      .select({
        date: schema.mealEntries.date,
        kcal: schema.mealEntries.kcal,
        prot: schema.mealEntries.prot,
        carb: schema.mealEntries.carb,
        fat: schema.mealEntries.fat,
      })
      .from(schema.mealEntries),
    db
      .select({
        effectiveFrom: schema.dietVersions.effectiveFrom,
        kcalTarget: schema.dietVersions.kcalTarget,
        protTarget: schema.dietVersions.protTarget,
      })
      .from(schema.dietVersions)
      .orderBy(asc(schema.dietVersions.effectiveFrom), asc(schema.dietVersions.id)),
  ]);

  const daysByDate = new Map(dayRows.map((d) => [d.date, d]));
  const healthByDate = new Map(healthRows.map((h) => [h.date, h]));

  interface Agg {
    kcal: number;
    prot: number;
    carb: number;
    fat: number;
    n: number;
  }
  const entriesByDate = new Map<string, Agg>();
  for (const e of entryRows) {
    const a = entriesByDate.get(e.date) ?? { kcal: 0, prot: 0, carb: 0, fat: 0, n: 0 };
    a.kcal += e.kcal;
    a.prot += e.prot;
    a.carb += e.carb;
    a.fat += e.fat;
    a.n++;
    entriesByDate.set(e.date, a);
  }

  const allDates = new Set<string>([
    ...daysByDate.keys(),
    ...healthByDate.keys(),
    ...entriesByDate.keys(),
  ]);

  const records: DailyRecord[] = [...allDates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const day = daysByDate.get(date);
      const health = healthByDate.get(date);
      const agg = entriesByDate.get(date);
      return {
        date,
        // Peso/%grasa/agua: tu valor MANUAL (edición del día) manda; la báscula
        // (Apple Health) solo rellena los huecos. Protege el motor de déficit, que
        // vive de pesajes en ayunas consistentes (principio 1). El resto de
        // métricas del reloj no tienen equivalente manual.
        weight: day?.weight ?? health?.weight ?? null,
        phase: (day?.phase as PhaseKey | null) ?? null,
        logged: (agg?.n ?? 0) > 0,
        kcal: agg?.kcal ?? 0,
        prot: agg?.prot ?? 0,
        carb: agg?.carb ?? 0,
        fat: agg?.fat ?? 0,
        target: targetForDate(versionRows, date),
        steps: health?.steps ?? null,
        activeKcal: health?.activeKcal ?? null,
        basalKcal: health?.basalKcal ?? null,
        hrvMs: health?.hrvMs ?? null,
        sleepH: health?.sleepH ?? null,
        restingHr: health?.restingHr ?? null,
        bodyFatPct: day?.bodyFatPct ?? health?.bodyFatPct ?? null,
        waterL: day?.waterL ?? health?.waterL ?? null,
        sessionLabel: day?.sessionLabel ?? null,
        bloat: (day?.bloat as BloatKey | null) ?? null,
        notes: day?.notes ?? null,
      };
    });

  return {
    records,
    currentTarget: targetForDate(versionRows, today),
    today,
  };
}
