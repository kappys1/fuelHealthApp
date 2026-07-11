import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { HEALTH_FIELDS, type HealthDay } from "@/server/ingest/normalize";
import type { WorkoutRow } from "@/server/ingest/hae-json";
import { getSetting, setSetting } from "./lookups";

/*
  Capa BD de Salud (Fase 3). health_metrics va SEPARADO de days a propósito:
  al fusionar la vista efectiva de un día, health_metrics tiene PRECEDENCIA sobre
  days para las métricas solapadas (peso, agua, % grasa) — principio 6: los datos
  reales machacan a los manuales cuando traen valor.
*/

export const HEALTH_SYNC_KEY = "healthSync";

export interface HealthSyncStatus {
  at: string; // ISO
  source: "endpoint" | "csv";
  imported: number;
}

/** Métricas de days que health puede pisar (para el aviso de la vista previa). */
const MANUAL_OVERLAP: (keyof HealthDay & string)[] = ["weight", "waterL", "bodyFatPct"];

/**
 * Upsert de días de salud con FUSIÓN por campo: una importación que solo trae
 * `steps` no borra el `weight` previo. `updatedAt` se refresca siempre.
 */
export async function applyHealthDays(
  days: HealthDay[],
  source: "endpoint" | "csv",
): Promise<number> {
  let imported = 0;
  for (const d of days) {
    const fields: Record<string, number> = {};
    for (const f of HEALTH_FIELDS) {
      const v = d[f];
      if (v != null) fields[f] = v;
    }
    // Un día sin ninguna métrica (solo fecha) no aporta nada.
    if (Object.keys(fields).length === 0) continue;

    const now = new Date();
    await db
      .insert(schema.healthMetrics)
      .values({ date: d.date, source, updatedAt: now, ...fields })
      .onConflictDoUpdate({
        target: schema.healthMetrics.date,
        set: { source, updatedAt: now, ...fields },
      });
    imported++;
  }
  return imported;
}

/** Inserta workouts (del endpoint). No idempotente por diseño: HAE ya deduplica por Automation. */
export async function insertWorkouts(rows: WorkoutRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db.insert(schema.workouts).values(
    rows.map((w) => ({
      date: w.date,
      type: w.type,
      durationMin: w.durationMin,
      avgHr: w.avgHr,
      activeKcal: w.activeKcal,
    })),
  );
  return rows.length;
}

/**
 * Cuántos de los días entrantes traen una métrica (peso/agua/%grasa) que YA
 * existe manualmente en `days` → la importación la pisará en la vista efectiva.
 */
export async function countManualOverwrites(days: HealthDay[]): Promise<number> {
  const dates = days
    .filter((d) => MANUAL_OVERLAP.some((f) => d[f] != null))
    .map((d) => d.date);
  if (dates.length === 0) return 0;

  const rows = await db
    .select({
      date: schema.days.date,
      weight: schema.days.weight,
      waterL: schema.days.waterL,
      bodyFatPct: schema.days.bodyFatPct,
    })
    .from(schema.days)
    .where(inArray(schema.days.date, dates));

  const manualByDate = new Map(rows.map((r) => [r.date, r]));
  let count = 0;
  for (const d of days) {
    const m = manualByDate.get(d.date);
    if (!m) continue;
    const overlaps =
      (d.weight != null && m.weight != null) ||
      (d.waterL != null && m.waterL != null) ||
      (d.bodyFatPct != null && m.bodyFatPct != null);
    if (overlaps) count++;
  }
  return count;
}

export async function recordHealthSync(
  status: HealthSyncStatus,
): Promise<void> {
  await setSetting(HEALTH_SYNC_KEY, status);
}

export async function getHealthSyncStatus(): Promise<HealthSyncStatus | null> {
  return getSetting<HealthSyncStatus>(HEALTH_SYNC_KEY);
}

/** Más de 2 días sin sincronizar → aviso (07 §4). */
const STALE_MS = 48 * 60 * 60 * 1000;

export interface HealthSyncView {
  source: "endpoint" | "csv";
  ago: string;
  stale: boolean;
}

/** Estado de sincronización listo para pintar (deriva «hace X» fuera del render). */
export async function getHealthSyncView(): Promise<HealthSyncView | null> {
  const s = await getHealthSyncStatus();
  if (!s) return null;
  return {
    source: s.source,
    ago: formatDistanceToNow(new Date(s.at), { addSuffix: true, locale: es }),
    stale: Date.now() - Date.parse(s.at) > STALE_MS,
  };
}
