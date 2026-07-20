import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { shiftDayKey } from "@/lib/dates";
import {
  sessionKcal,
  trainingWeekSpan,
  type TrainingTipo,
} from "@/lib/training";
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
): Promise<{
  plan: TrainingPlanDTO;
  sessions: TrainingSessionDTO[];
  closedPlanIds: number[];
}> {
  const previousOpen = await db
    .select({ id: schema.trainingPlans.id })
    .from(schema.trainingPlans)
    .where(
      and(
        isNull(schema.trainingPlans.validTo),
        lte(schema.trainingPlans.validFrom, p.validFrom),
      ),
    );
  const closedPlanIds = previousOpen.map((row) => row.id);

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

  try {
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

    // El plan anterior solo se cierra cuando el nuevo ya está completo.
    if (closedPlanIds.length > 0) {
      await db
        .update(schema.trainingPlans)
        .set({ validTo: shiftDayKey(p.validFrom, -1) })
        .where(inArray(schema.trainingPlans.id, closedPlanIds));
    }

    return { plan: plan as TrainingPlanDTO, sessions, closedPlanIds };
  } catch (error) {
    await db.delete(schema.trainingPlans).where(eq(schema.trainingPlans.id, plan.id));
    await restoreTrainingPlans(closedPlanIds);
    throw error;
  }
}

export async function restoreTrainingPlans(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(schema.trainingPlans)
    .set({ validTo: null })
    .where(inArray(schema.trainingPlans.id, ids));
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
  const applied: DayAssignment[] = [];
  try {
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
      applied.push(a);
      assigned++;
    }
  } catch (error) {
    await Promise.all(
      applied.map((a) =>
        db
          .update(schema.days)
          .set({ sessionRef: null, sessionLabel: null, sessionKcal: null })
          .where(
            and(
              eq(schema.days.date, a.date),
              a.sessionRef == null
                ? isNull(schema.days.sessionRef)
                : eq(schema.days.sessionRef, a.sessionRef),
            ),
          ),
      ),
    );
    throw error;
  }
  return { assigned, skipped };
}

export interface TrainingSessionWithDay extends TrainingSessionDTO {
  /** Día al que está asignada esta sesión ('YYYY-MM-DD') o null. */
  assignedDate: string | null;
}

export interface TrainingWeekView {
  plan: TrainingPlanDTO;
  sessions: TrainingSessionWithDay[];
}

/** Semana de entreno para la pestaña «Entrenos»: devuelve el plan que solapa la
 * semana lunes-domingo de `date`. Una semana vacía permanece vacía. */
export async function getTrainingWeekView(
  date: string,
): Promise<TrainingWeekView | null> {
  const span = trainingWeekSpan(date);
  const [plan] = await db
    .select()
    .from(schema.trainingPlans)
    .where(
      and(
        lte(schema.trainingPlans.validFrom, span.validTo),
        or(
          isNull(schema.trainingPlans.validTo),
          gte(schema.trainingPlans.validTo, span.validFrom),
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
    .orderBy(asc(schema.trainingSessions.sort), asc(schema.trainingSessions.id))) as TrainingSessionDTO[];

  const ids = sessions.map((s) => s.id);
  const dayRows = ids.length
    ? await db
        .select({ date: schema.days.date, sessionRef: schema.days.sessionRef })
        .from(schema.days)
        .where(
          and(
            inArray(schema.days.sessionRef, ids),
            gte(schema.days.date, span.validFrom),
            lte(schema.days.date, span.validTo),
          ),
        )
    : [];
  const dateBySession = new Map(
    dayRows.flatMap((r) => (r.sessionRef != null ? [[r.sessionRef, r.date]] : [])),
  );

  return {
    plan: plan as TrainingPlanDTO,
    sessions: sessions.map((s) => ({
      ...s,
      assignedDate: dateBySession.get(s.id) ?? null,
    })),
  };
}

export interface TrainingSessionPatch {
  nombre?: string;
  tipo?: TrainingTipo;
  contenido?: string;
  kcalMin?: number | null;
  kcalMax?: number | null;
  duracionMin?: number | null;
}

export class TrainingAssignmentConflictError extends Error {
  constructor() {
    super("Ese día ya tiene una sesión. Desasígnala antes de mover otra aquí.");
    this.name = "TrainingAssignmentConflictError";
  }
}

/** Edita una sesión y refresca los campos desnormalizados del día asignado (B3b). */
export async function updateTrainingSession(
  id: number,
  patch: TrainingSessionPatch,
): Promise<void> {
  await db
    .update(schema.trainingSessions)
    .set(patch)
    .where(eq(schema.trainingSessions.id, id));
  const [s] = await db
    .select()
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.id, id));
  if (s) {
    await db
      .update(schema.days)
      .set({ sessionLabel: s.nombre, sessionKcal: sessionKcal(s.kcalMin, s.kcalMax) })
      .where(eq(schema.days.sessionRef, id));
  }
}

/** Reasigna una sesión a otro día (o la desasigna con null) — doc 10 B3b. */
export async function reassignTrainingSession(
  sessionId: number,
  newDate: string | null,
): Promise<void> {
  const [s] = await db
    .select()
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.id, sessionId));
  if (!s) return;

  if (newDate) {
    const [destination] = await db
      .select({
        sessionRef: schema.days.sessionRef,
        sessionLabel: schema.days.sessionLabel,
      })
      .from(schema.days)
      .where(eq(schema.days.date, newDate));
    if (
      destination?.sessionLabel &&
      destination.sessionRef !== sessionId
    ) {
      throw new TrainingAssignmentConflictError();
    }
  }

  // Quita la asignación anterior (todas menos el día destino).
  await db
    .update(schema.days)
    .set({ sessionRef: null, sessionLabel: null, sessionKcal: null })
    .where(
      and(
        eq(schema.days.sessionRef, sessionId),
        newDate ? ne(schema.days.date, newDate) : undefined,
      ),
    );

  if (newDate) {
    const kcal = sessionKcal(s.kcalMin, s.kcalMax);
    await db
      .insert(schema.days)
      .values({
        date: newDate,
        sessionRef: sessionId,
        sessionLabel: s.nombre,
        sessionKcal: kcal,
      })
      .onConflictDoUpdate({
        target: schema.days.date,
        set: { sessionRef: sessionId, sessionLabel: s.nombre, sessionKcal: kcal },
      });
  }
}

/** Borra un plan (cascade a sus sesiones; days.session_ref → null por el FK). */
export async function deleteTrainingPlan(id: number): Promise<void> {
  await db.delete(schema.trainingPlans).where(eq(schema.trainingPlans.id, id));
}
