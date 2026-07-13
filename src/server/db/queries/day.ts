import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";
import type { BloatKey, MealKey, PhaseKey } from "@/lib/macros";
import { dayKey, shiftDayKey } from "@/lib/dates";
import type { TrainingTipo } from "@/lib/training";
import { db, schema } from "@/server/db";

export interface EntryDTO {
  id: number;
  meal: MealKey;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  source: string;
  photoUrl: string | null;
  createdAt: string;
}

export interface DayDTO {
  date: string;
  weight: number | null;
  waterL: number | null;
  bodyFatPct: number | null;
  sessionLabel: string | null;
  sessionKcal: number | null;
  sessionRef: number | null;
  phase: PhaseKey | null;
  bloat: BloatKey | null;
  notes: string | null;
}

/** Detalle de la sesión real del plan asignada al día (doc 10 B3). */
export interface DaySessionInfo {
  id: number;
  key: string;
  nombre: string;
  tipo: TrainingTipo;
  kcalMin: number | null;
  kcalMax: number | null;
}

export interface HealthDTO {
  steps: number | null;
  activeKcal: number | null;
  basalKcal: number | null;
  hrvMs: number | null;
  sleepH: number | null;
  restingHr: number | null;
  vo2max: number | null;
  // Métricas de báscula (para auto-rellenar Peso/%grasa/agua en «Mi día»).
  weight: number | null;
  bodyFatPct: number | null;
  waterL: number | null;
  /** Resto de métricas de Apple Health (masa magra, ejercicio, SpO2, resp, temp…). */
  extra: Record<string, number> | null;
}

export interface DayView {
  date: string;
  day: DayDTO | null;
  health: HealthDTO | null;
  entries: EntryDTO[];
  /** Sesión real del plan asignada al día (doc 10 B3), si `day.sessionRef` apunta a una. */
  session: DaySessionInfo | null;
}

export async function getDayView(date: string): Promise<DayView> {
  const [dayRow] = await db
    .select()
    .from(schema.days)
    .where(eq(schema.days.date, date));

  const [healthRow] = await db
    .select({
      steps: schema.healthMetrics.steps,
      activeKcal: schema.healthMetrics.activeKcal,
      basalKcal: schema.healthMetrics.basalKcal,
      hrvMs: schema.healthMetrics.hrvMs,
      sleepH: schema.healthMetrics.sleepH,
      restingHr: schema.healthMetrics.restingHr,
      vo2max: schema.healthMetrics.vo2max,
      weight: schema.healthMetrics.weight,
      bodyFatPct: schema.healthMetrics.bodyFatPct,
      waterL: schema.healthMetrics.waterL,
      extra: schema.healthMetrics.extra,
    })
    .from(schema.healthMetrics)
    .where(eq(schema.healthMetrics.date, date));

  const rows = await db
    .select()
    .from(schema.mealEntries)
    .where(eq(schema.mealEntries.date, date))
    .orderBy(asc(schema.mealEntries.createdAt), asc(schema.mealEntries.id));

  const entries: EntryDTO[] = rows.map((r) => ({
    id: r.id,
    meal: r.meal as MealKey,
    name: r.name,
    kcal: r.kcal,
    prot: r.prot,
    carb: r.carb,
    fat: r.fat,
    source: r.source,
    photoUrl: r.photoUrl,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));

  // Sesión real del plan (doc 10 B3): si el día apunta a una training_session.
  let session: DaySessionInfo | null = null;
  if (dayRow?.sessionRef != null) {
    const [s] = await db
      .select({
        id: schema.trainingSessions.id,
        key: schema.trainingSessions.key,
        nombre: schema.trainingSessions.nombre,
        tipo: schema.trainingSessions.tipo,
        kcalMin: schema.trainingSessions.kcalMin,
        kcalMax: schema.trainingSessions.kcalMax,
      })
      .from(schema.trainingSessions)
      .where(eq(schema.trainingSessions.id, dayRow.sessionRef));
    session = (s as DaySessionInfo) ?? null;
  }

  return {
    date,
    day: (dayRow as DayDTO) ?? null,
    health: (healthRow as HealthDTO) ?? null,
    entries,
    session,
  };
}

/**
 * Racha de registro: días CONSECUTIVOS con ≥1 comida terminando hoy (o ayer, si
 * hoy aún no tiene registro — la racha sigue viva hasta el final del día). 09 §3.
 */
export async function getStreak(today: string = dayKey()): Promise<number> {
  const rows = await db
    .selectDistinct({ date: schema.mealEntries.date })
    .from(schema.mealEntries)
    .orderBy(desc(schema.mealEntries.date));
  const present = new Set(rows.map((r) => r.date));
  if (present.size === 0) return 0;

  let cursor = today;
  if (!present.has(cursor)) {
    // Si hoy no hay registro aún, la racha se cuenta desde ayer.
    cursor = shiftDayKey(today, -1);
    if (!present.has(cursor)) return 0;
  }
  let streak = 0;
  while (present.has(cursor)) {
    streak++;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/** Último peso conocido en o antes de `date` (para precargar el check-in, 09 §5). */
export async function latestWeightOnOrBefore(date: string): Promise<number | null> {
  const rows = await db
    .select({ weight: schema.days.weight, date: schema.days.date })
    .from(schema.days)
    .where(and(lte(schema.days.date, date), isNotNull(schema.days.weight)))
    .orderBy(desc(schema.days.date))
    .limit(1);
  return rows[0]?.weight ?? null;
}

/** Fase registrada en una fecha (para sugerir la fase de hoy tras un día especial, 09 §5). */
export async function phaseOnDate(date: string): Promise<PhaseKey | null> {
  const [row] = await db
    .select({ phase: schema.days.phase })
    .from(schema.days)
    .where(eq(schema.days.date, date))
    .limit(1);
  return (row?.phase as PhaseKey | null) ?? null;
}

/** Existe la fila days de una fecha (para saber si el día "está empezado"). */
export async function dayExists(date: string): Promise<boolean> {
  const [row] = await db
    .select({ date: schema.days.date })
    .from(schema.days)
    .where(eq(schema.days.date, date))
    .limit(1);
  return !!row;
}

/** Entradas del día anterior (para «Copiar ayer», F2.5). */
export async function entriesForDate(date: string): Promise<EntryDTO[]> {
  return (await getDayView(date)).entries;
}
