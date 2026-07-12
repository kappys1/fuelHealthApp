import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { shiftDayKey } from "@/lib/dates";
import type { TrainingTipo } from "@/lib/training";
import { db, schema } from "@/server/db";

/*
  Queries del plan de entrenamiento (doc 10 Fase B1). Molde: plan.ts (versiones de
  dieta) + mutations.ts (createDietVersionFull). El plan vigente para una fecha es
  el que la cubre por [valid_from, valid_to] (valid_to null = abierta).
*/

export type TrainingSource = "pdf" | "foto" | "texto";

export interface TrainingSessionDTO {
  id: number;
  planId: number;
  key: string;
  nombre: string;
  tipo: TrainingTipo;
  contenido: string;
  kcalMin: number | null;
  kcalMax: number | null;
  duracionMin: number | null;
  sort: number;
}

export interface TrainingPlanDTO {
  id: number;
  importedAt: Date;
  programa: string;
  etiqueta: string;
  validFrom: string;
  validTo: string | null;
  source: TrainingSource;
}

export interface TrainingPlanContext {
  plan: TrainingPlanDTO;
  sessions: TrainingSessionDTO[];
}

/** Plan que cubre `date` (valid_from ≤ date AND (valid_to null OR ≥ date)), + sesiones. */
export async function getTrainingPlanContext(
  date: string,
): Promise<TrainingPlanContext | null> {
  const [plan] = await db
    .select()
    .from(schema.trainingPlans)
    .where(
      and(
        lte(schema.trainingPlans.validFrom, date),
        or(
          isNull(schema.trainingPlans.validTo),
          gte(schema.trainingPlans.validTo, date),
        ),
      ),
    )
    .orderBy(desc(schema.trainingPlans.validFrom), desc(schema.trainingPlans.id))
    .limit(1);
  if (!plan) return null;

  const sessions = (await db
    .select()
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.planId, plan.id))
    .orderBy(
      asc(schema.trainingSessions.sort),
      asc(schema.trainingSessions.id),
    )) as TrainingSessionDTO[];

  return { plan: plan as TrainingPlanDTO, sessions };
}

export interface TrainingPlanSummary extends TrainingPlanDTO {
  sessionCount: number;
}

/** Todos los planes (más reciente primero) con su nº de sesiones — Historial (B4). */
export async function listAllTrainingPlans(): Promise<TrainingPlanSummary[]> {
  const plans = (await db
    .select()
    .from(schema.trainingPlans)
    .orderBy(
      desc(schema.trainingPlans.validFrom),
      desc(schema.trainingPlans.id),
    )) as TrainingPlanDTO[];

  const counts = await db
    .select({
      planId: schema.trainingSessions.planId,
      c: sql<number>`count(*)::int`,
    })
    .from(schema.trainingSessions)
    .groupBy(schema.trainingSessions.planId);
  const countMap = new Map(counts.map((r) => [r.planId, Number(r.c)]));

  return plans.map((p) => ({ ...p, sessionCount: countMap.get(p.id) ?? 0 }));
}

export interface ImportedTrainingSession {
  key: string;
  nombre: string;
  tipo: TrainingTipo;
  contenido: string;
  kcalMin: number | null;
  kcalMax: number | null;
  duracionMin: number | null;
}

export interface ImportedTrainingPlan {
  programa: string;
  etiqueta: string;
  source: TrainingSource;
  validFrom: string;
  validTo: string | null;
  sessions: ImportedTrainingSession[];
}

/**
 * Crea un plan de entreno COMPLETO desde una importación (F-IA-10): inserta el plan
 * + sus sesiones. Cierra el plan abierto anterior que solape (valid_to = día previo
 * a valid_from) para que no haya dos planes vigentes a la vez. Nada se persiste
 * hasta que el usuario confirma la vista previa.
 */
export async function createTrainingPlanFull(
  p: ImportedTrainingPlan,
): Promise<{ plan: TrainingPlanDTO; sessions: TrainingSessionDTO[] }> {
  // Cierra planes abiertos anteriores que empezaron antes del nuevo valid_from.
  await db
    .update(schema.trainingPlans)
    .set({ validTo: shiftDayKey(p.validFrom, -1) })
    .where(
      and(
        isNull(schema.trainingPlans.validTo),
        lte(schema.trainingPlans.validFrom, p.validFrom),
      ),
    );

  const [plan] = await db
    .insert(schema.trainingPlans)
    .values({
      programa: p.programa,
      etiqueta: p.etiqueta,
      source: p.source,
      validFrom: p.validFrom,
      validTo: p.validTo,
    })
    .returning();
  if (!plan) throw new Error("No se pudo crear el plan de entreno.");

  let sessions: TrainingSessionDTO[] = [];
  if (p.sessions.length > 0) {
    sessions = (await db
      .insert(schema.trainingSessions)
      .values(
        p.sessions.map((s, i) => ({
          planId: plan.id,
          key: s.key,
          nombre: s.nombre,
          tipo: s.tipo,
          contenido: s.contenido,
          kcalMin: s.kcalMin,
          kcalMax: s.kcalMax,
          duracionMin: s.duracionMin,
          sort: i,
        })),
      )
      .returning()) as TrainingSessionDTO[];
  }

  return { plan: plan as TrainingPlanDTO, sessions };
}

export interface DayAssignment {
  date: string;
  sessionRef: number | null;
  sessionLabel: string;
  sessionKcal: number | null;
}

/**
 * Asigna sesiones a días (upsert de days.sessionRef/-Label/-Kcal) SIN pisar los
 * días que ya tienen una sesión registrada (doc 10 B2: "sin pisar días ya
 * registrados manualmente"). Secuencial (neon-http sin transacción interactiva).
 */
export async function assignSessionsToDays(
  assignments: DayAssignment[],
): Promise<{ assigned: number; skipped: number }> {
  let assigned = 0;
  let skipped = 0;
  for (const a of assignments) {
    const [existing] = await db
      .select({ sessionLabel: schema.days.sessionLabel })
      .from(schema.days)
      .where(eq(schema.days.date, a.date));
    if (existing?.sessionLabel) {
      skipped++;
      continue;
    }
    await db
      .insert(schema.days)
      .values({
        date: a.date,
        sessionRef: a.sessionRef,
        sessionLabel: a.sessionLabel,
        sessionKcal: a.sessionKcal,
      })
      .onConflictDoUpdate({
        target: schema.days.date,
        set: {
          sessionRef: a.sessionRef,
          sessionLabel: a.sessionLabel,
          sessionKcal: a.sessionKcal,
        },
      });
    assigned++;
  }
  return { assigned, skipped };
}
