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
import type { BatchItem } from "drizzle-orm/batch";
import { shiftDayKey } from "@/lib/dates";
import {
  buildCanonicalTrainingWrite,
  type CanonicalSessionState,
  type CanonicalTrainingInput,
  type CanonicalTrainingUndo,
  type CanonicalTrainingWrite,
} from "@/lib/training-persistence";
import {
  sessionKcal,
  trainingWeekSpan,
  type TrainingTipo,
} from "@/lib/training";
import type { SessionFranja } from "@/lib/training-slot";
import { db, schema } from "@/server/db";
import { getAthleteProfile } from "./lookups";

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
  franja: SessionFranja | null;
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
  importRequestId: string | null;
  importFingerprint: string | null;
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
  franja?: SessionFranja | null;
}

export interface ImportedTrainingPlan {
  programa: string;
  etiqueta: string;
  source: TrainingSource;
  validFrom: string;
  validTo: string | null;
  sessions: ImportedTrainingSession[];
}

export interface ImportedTrainingAssignment {
  sessionIndex: number;
  date: string;
  franja: SessionFranja;
}

interface AtomicTrainingResult {
  plan: TrainingPlanDTO;
  sessions: TrainingSessionDTO[];
  assigned: number;
  skipped: number;
  replayed: boolean;
}

export class TrainingPlanOverlapError extends Error {
  constructor() {
    super("Ya existe un plan para esa semana. Elimínalo antes de importar otro.");
    this.name = "TrainingPlanOverlapError";
  }
}

async function hasPlanForWeek(validFrom: string): Promise<boolean> {
  const [plan] = await db
    .select({ id: schema.trainingPlans.id })
    .from(schema.trainingPlans)
    .where(eq(schema.trainingPlans.validFrom, validFrom));
  return Boolean(plan);
}

async function trainingImportResult(
  requestId: string,
  fingerprint: string,
  requestedAssignments: number,
  replayed: boolean,
): Promise<AtomicTrainingResult | null> {
  const [plan] = await db
    .select()
    .from(schema.trainingPlans)
    .where(eq(schema.trainingPlans.importRequestId, requestId));
  if (!plan) return null;
  if (plan.importFingerprint !== fingerprint) {
    throw new Error("El identificador de importación pertenece a otra vista previa.");
  }
  const sessions = (await db
    .select()
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.planId, plan.id))
    .orderBy(asc(schema.trainingSessions.sort))) as TrainingSessionDTO[];
  const ids = sessions.map((session) => session.id);
  const assignedRows = ids.length
    ? await db
        .select({ date: schema.days.date })
        .from(schema.days)
        .where(inArray(schema.days.sessionRef, ids))
    : [];
  const assigned = Math.min(requestedAssignments, assignedRows.length);
  return {
    plan: plan as TrainingPlanDTO,
    sessions,
    assigned,
    skipped: Math.max(0, requestedAssignments - assigned),
    replayed,
  };
}

/** Plan, sesiones, cierre del anterior y asignaciones: una sola transacción HTTP. */
export async function createTrainingPlanAtomic(
  p: ImportedTrainingPlan,
  assignments: ImportedTrainingAssignment[],
  requestId: string,
  fingerprint: string,
): Promise<AtomicTrainingResult> {
  const existing = await trainingImportResult(
    requestId,
    fingerprint,
    assignments.length,
    true,
  );
  if (existing) return existing;

  const [[planIdRow], sessionIdRows] = await Promise.all([
    db
      .select({
        id: sql<number>`nextval(pg_get_serial_sequence('training_plans', 'id'))::int`,
      })
      .from(sql`(select 1) as allocation`),
    db
      .select({
        id: sql<number>`nextval(pg_get_serial_sequence('training_sessions', 'id'))::int`,
      })
      .from(sql`generate_series(1, ${p.sessions.length})`),
  ]);
  if (!planIdRow || sessionIdRows.length !== p.sessions.length) {
    throw new Error("No se pudieron reservar los ids de la semana.");
  }
  const planId = Number(planIdRow.id);
  const sessionIds = sessionIdRows.map((row) => Number(row.id));

  const queries: BatchItem<"pg">[] = [
    db.execute(
      sql`select pg_advisory_xact_lock(hashtext('fuelboard:training-import'))`,
    ),
    db.execute(sql`
      select 1 / case
        when exists (
          select 1
          from ${schema.trainingPlans}
          where ${schema.trainingPlans.validFrom} = ${p.validFrom}
        ) then 0
        else 1
      end
    `),
    db
      .insert(schema.trainingPlans)
      .overridingSystemValue()
      .values({
        id: planId,
        programa: p.programa,
        etiqueta: p.etiqueta,
        source: p.source,
        validFrom: p.validFrom,
        validTo: p.validTo,
        importRequestId: requestId,
        importFingerprint: fingerprint,
      }),
    db
      .insert(schema.trainingSessions)
      .overridingSystemValue()
      .values(
        p.sessions.map((session, index) => ({
          id: sessionIds[index]!,
          planId,
          key: session.key,
          nombre: session.nombre,
          tipo: session.tipo,
          contenido: session.contenido,
          kcalMin: session.kcalMin,
          kcalMax: session.kcalMax,
          duracionMin: session.duracionMin,
          franja:
            assignments.find((assignment) => assignment.sessionIndex === index)
              ?.franja ?? null,
          sort: index,
        })),
      ),
  ];
  queries.push(
    db
      .update(schema.trainingPlans)
      .set({ validTo: shiftDayKey(p.validFrom, -1) })
      .where(
        and(
          ne(schema.trainingPlans.id, planId),
          isNull(schema.trainingPlans.validTo),
          lte(schema.trainingPlans.validFrom, p.validFrom),
        ),
      ),
  );
  for (const assignment of assignments) {
    const session = p.sessions[assignment.sessionIndex];
    const sessionRef = sessionIds[assignment.sessionIndex];
    if (!session || sessionRef == null) {
      throw new Error("La asignación apunta a una sesión inexistente.");
    }
    queries.push(
      db
        .insert(schema.days)
        .values({
          date: assignment.date,
          sessionRef,
          sessionLabel: session.nombre,
          sessionKcal: sessionKcal(session.kcalMin, session.kcalMax),
        })
        .onConflictDoUpdate({
          target: schema.days.date,
          set: {
            sessionRef,
            sessionLabel: session.nombre,
            sessionKcal: sessionKcal(session.kcalMin, session.kcalMax),
          },
          setWhere: isNull(schema.days.sessionLabel),
        }),
    );
  }

  try {
    await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  } catch (error) {
    const raced = await trainingImportResult(
      requestId,
      fingerprint,
      assignments.length,
      true,
    );
    if (raced) return raced;
    if (await hasPlanForWeek(p.validFrom)) throw new TrainingPlanOverlapError();
    throw error;
  }
  const created = await trainingImportResult(
    requestId,
    fingerprint,
    assignments.length,
    false,
  );
  if (!created) throw new Error("La semana no quedó persistida.");
  return created;
}

export interface TrainingSessionWithDay extends TrainingSessionDTO {
  /** Día al que está asignada esta sesión ('YYYY-MM-DD') o null. */
  assignedDate: string | null;
  /*
    F26 Fase 2 · si ESE día tiene sesión adaptada, viaja con la sesión. Plan ·
    Entrenos es una vista por día (tiene selector de día), así que sin esto la
    app enseñaba dos verdades según la pestaña: en Hoy la adaptada y aquí la del
    plan, sin rastro de que la hubieras cambiado.
  */
  adaptedSession: string | null;
  adaptedReason: string | null;
  /** ISO. */
  adaptedAt: string | null;
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
        .select({
          date: schema.days.date,
          sessionRef: schema.days.sessionRef,
          adaptedSession: schema.days.adaptedSession,
          adaptedReason: schema.days.adaptedReason,
          adaptedAt: schema.days.adaptedAt,
        })
        .from(schema.days)
        .where(
          and(
            inArray(schema.days.sessionRef, ids),
            gte(schema.days.date, span.validFrom),
            lte(schema.days.date, span.validTo),
          ),
        )
    : [];
  const daysBySession = new Map(
    dayRows.flatMap((r) => (r.sessionRef != null ? [[r.sessionRef, r] as const] : [])),
  );

  return {
    plan: plan as TrainingPlanDTO,
    sessions: sessions.map((s) => {
      const day = daysBySession.get(s.id);
      return {
        ...s,
        assignedDate: day?.date ?? null,
        adaptedSession: day?.adaptedSession ?? null,
        adaptedReason: day?.adaptedReason ?? null,
        adaptedAt: day?.adaptedAt ? day.adaptedAt.toISOString() : null,
      };
    }),
  };
}

export interface TrainingSessionPatch {
  nombre?: string;
  tipo?: TrainingTipo;
  contenido?: string;
  kcalMin?: number | null;
  kcalMax?: number | null;
  duracionMin?: number | null;
  franja?: SessionFranja | null;
}

export class TrainingAssignmentConflictError extends Error {
  constructor() {
    super("Ese día ya tiene una sesión. Desasígnala antes de mover otra aquí.");
    this.name = "TrainingAssignmentConflictError";
  }
}

export class CanonicalTrainingUndoConflictError extends Error {
  constructor() {
    super("La sesión cambió después de guardarla y ya no se puede deshacer.");
    this.name = "CanonicalTrainingUndoConflictError";
  }
}

export interface CanonicalTrainingResult {
  kind: CanonicalTrainingWrite["kind"];
  session: CanonicalSessionState;
  replacedName: string | null;
  undo: CanonicalTrainingUndo;
}

async function allocateIdentity(table: "training_plans" | "training_sessions") {
  const [row] = await db
    .select({
      id: sql<number>`nextval(pg_get_serial_sequence(${table}, 'id'))::int`,
    })
    .from(sql`(select 1) as allocation`);
  if (!row) throw new Error(`No se pudo reservar un id de ${table}.`);
  return Number(row.id);
}

/**
 * Fuente única Plan↔Hoy (F17): actualiza la sesión ya asignada o crea una dentro
 * de la semana, y sincroniza los tres campos del día en un batch transaccional.
 */
export async function saveCanonicalTrainingSession(
  input: CanonicalTrainingInput,
): Promise<CanonicalTrainingResult> {
  const [dayRow] = await db
    .select({
      sessionRef: schema.days.sessionRef,
      sessionLabel: schema.days.sessionLabel,
      sessionKcal: schema.days.sessionKcal,
    })
    .from(schema.days)
    .where(eq(schema.days.date, input.date));
  const assignedSession = dayRow?.sessionRef
    ? ((await db
        .select()
        .from(schema.trainingSessions)
        .where(eq(schema.trainingSessions.id, dayRow.sessionRef))
        .limit(1))[0] as CanonicalSessionState | undefined) ?? null
    : null;
  const [weekView, profile] = await Promise.all([
    getTrainingWeekView(input.date),
    getAthleteProfile(),
  ]);
  const needSessionId = assignedSession == null;
  const needPlanId = needSessionId && weekView == null;
  const [allocatedSessionId, allocatedPlanId] = await Promise.all([
    needSessionId ? allocateIdentity("training_sessions") : Promise.resolve(null),
    needPlanId ? allocateIdentity("training_plans") : Promise.resolve(null),
  ]);

  const write = buildCanonicalTrainingWrite(input, {
    day: dayRow
      ? {
          exists: true,
          sessionRef: dayRow.sessionRef,
          sessionLabel: dayRow.sessionLabel,
          sessionKcal: dayRow.sessionKcal,
        }
      : null,
    assignedSession,
    week: weekView
      ? {
          id: weekView.plan.id,
          programa: weekView.plan.programa,
          etiqueta: weekView.plan.etiqueta,
          validFrom: weekView.plan.validFrom,
          validTo: weekView.plan.validTo,
          source: weekView.plan.source,
          sessionCount: weekView.sessions.length,
          maxSort: Math.max(-1, ...weekView.sessions.map((session) => session.sort)),
        }
      : null,
    allocatedPlanId,
    allocatedSessionId,
    athleteProgram: profile.programa,
  });

  const expectedSessionRef = dayRow?.sessionRef ?? null;
  const queries: BatchItem<"pg">[] = [
    db.execute(
      sql`select pg_advisory_xact_lock(hashtext('fuelboard:canonical-training-session'))`,
    ),
    db.execute(sql`
      select 1 / case when (
        select ${schema.days.sessionRef}
        from ${schema.days}
        where ${schema.days.date} = ${input.date}
      ) is not distinct from ${expectedSessionRef}
      then 1 else 0 end
    `),
  ];

  if (write.planToInsert) {
    queries.push(
      db.execute(sql`
        select 1 / case when not exists (
          select 1 from ${schema.trainingPlans}
          where ${schema.trainingPlans.validFrom} <= ${write.planToInsert.validTo}
            and (
              ${schema.trainingPlans.validTo} is null
              or ${schema.trainingPlans.validTo} >= ${write.planToInsert.validFrom}
            )
        ) then 1 else 0 end
      `),
      db
        .insert(schema.trainingPlans)
        .overridingSystemValue()
        .values({
          id: write.planToInsert.id,
          programa: write.planToInsert.programa,
          etiqueta: write.planToInsert.etiqueta,
          source: write.planToInsert.source,
          validFrom: write.planToInsert.validFrom,
          validTo: write.planToInsert.validTo,
        }),
    );
  }

  if (write.kind === "updated") {
    queries.push(
      db
        .update(schema.trainingSessions)
        .set({
          key: write.session.key,
          nombre: write.session.nombre,
          tipo: write.session.tipo,
          contenido: write.session.contenido,
          kcalMin: write.session.kcalMin,
          kcalMax: write.session.kcalMax,
          duracionMin: write.session.duracionMin,
          franja: write.session.franja,
        })
        .where(eq(schema.trainingSessions.id, write.session.id)),
    );
  } else {
    queries.push(
      db
        .insert(schema.trainingSessions)
        .overridingSystemValue()
        .values(write.session),
    );
  }
  queries.push(
    db
      .insert(schema.days)
      .values(write.day)
      .onConflictDoUpdate({
        target: schema.days.date,
        set: {
          sessionRef: write.day.sessionRef,
          sessionLabel: write.day.sessionLabel,
          sessionKcal: write.day.sessionKcal,
        },
      }),
  );

  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return {
    kind: write.kind,
    session: write.session,
    replacedName:
      write.undo.previousSession?.nombre ??
      write.undo.previousDay.sessionLabel,
    undo: write.undo,
  };
}

/** Inversa inmediata del guardado canónico; restaura sesión + día del snapshot. */
export async function undoCanonicalTrainingSession(
  undo: CanonicalTrainingUndo,
): Promise<void> {
  const [currentDay] = await db
    .select({ sessionRef: schema.days.sessionRef })
    .from(schema.days)
    .where(eq(schema.days.date, undo.date));
  if (currentDay?.sessionRef !== undo.writtenSessionId) {
    throw new CanonicalTrainingUndoConflictError();
  }

  const queries: BatchItem<"pg">[] = [
    db.execute(
      sql`select pg_advisory_xact_lock(hashtext('fuelboard:canonical-training-session'))`,
    ),
    db.execute(sql`
      select 1 / case when (
        select ${schema.days.sessionRef}
        from ${schema.days}
        where ${schema.days.date} = ${undo.date}
      ) = ${undo.writtenSessionId}
      then 1 else 0 end
    `),
  ];

  if (undo.previousDay.exists) {
    queries.push(
      db
        .insert(schema.days)
        .values({
          date: undo.date,
          sessionRef: undo.previousDay.sessionRef,
          sessionLabel: undo.previousDay.sessionLabel,
          sessionKcal: undo.previousDay.sessionKcal,
        })
        .onConflictDoUpdate({
          target: schema.days.date,
          set: {
            sessionRef: undo.previousDay.sessionRef,
            sessionLabel: undo.previousDay.sessionLabel,
            sessionKcal: undo.previousDay.sessionKcal,
          },
        }),
    );
  } else {
    queries.push(
      db
        .update(schema.days)
        .set({ sessionRef: null, sessionLabel: null, sessionKcal: null })
        .where(eq(schema.days.date, undo.date)),
      db.delete(schema.days).where(
        and(
          eq(schema.days.date, undo.date),
          isNull(schema.days.weight),
          isNull(schema.days.waterL),
          isNull(schema.days.bodyFatPct),
          isNull(schema.days.sessionRef),
          isNull(schema.days.sessionLabel),
          isNull(schema.days.sessionKcal),
          isNull(schema.days.phase),
          isNull(schema.days.bloat),
          isNull(schema.days.notes),
        ),
      ),
    );
  }

  if (undo.previousSession) {
    queries.push(
      db
        .update(schema.trainingSessions)
        .set({
          planId: undo.previousSession.planId,
          key: undo.previousSession.key,
          nombre: undo.previousSession.nombre,
          tipo: undo.previousSession.tipo,
          contenido: undo.previousSession.contenido,
          kcalMin: undo.previousSession.kcalMin,
          kcalMax: undo.previousSession.kcalMax,
          duracionMin: undo.previousSession.duracionMin,
          franja: undo.previousSession.franja,
          sort: undo.previousSession.sort,
        })
        .where(eq(schema.trainingSessions.id, undo.previousSession.id)),
    );
  } else {
    queries.push(
      db
        .delete(schema.trainingSessions)
        .where(eq(schema.trainingSessions.id, undo.writtenSessionId)),
    );
  }
  if (undo.createdPlanId != null) {
    queries.push(
      db.delete(schema.trainingPlans).where(
        and(
          eq(schema.trainingPlans.id, undo.createdPlanId),
          sql`not exists (
            select 1 from ${schema.trainingSessions}
            where ${schema.trainingSessions.planId} = ${undo.createdPlanId}
          )`,
        ),
      ),
    );
  }

  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
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
  franja?: SessionFranja | null,
): Promise<void> {
  const [s] = await db
    .select()
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.id, sessionId));
  if (!s) return;
  const effectiveFranja =
    franja === undefined ? (s.franja as SessionFranja | null) : franja;
  if (newDate && !effectiveFranja) {
    throw new Error("Elige mañana o tarde antes de asignar la sesión.");
  }

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
  if (franja !== undefined && franja !== s.franja) {
    await db
      .update(schema.trainingSessions)
      .set({ franja })
      .where(eq(schema.trainingSessions.id, sessionId));
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

/** Borra una sesión y limpia su asignación del día en el mismo lote. */
export async function deleteTrainingSession(id: number): Promise<void> {
  await db.batch([
    db
      .update(schema.days)
      .set({ sessionRef: null, sessionLabel: null, sessionKcal: null })
      .where(eq(schema.days.sessionRef, id)),
    db.delete(schema.trainingSessions).where(eq(schema.trainingSessions.id, id)),
  ]);
}

/** Borra un plan y limpia todos los campos desnormalizados de sus días. */
export async function deleteTrainingPlan(id: number): Promise<void> {
  const sessions = await db
    .select({ id: schema.trainingSessions.id })
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.planId, id));
  const ids = sessions.map((session) => session.id);
  const queries: BatchItem<"pg">[] = [];
  if (ids.length > 0) {
    queries.push(
      db
        .update(schema.days)
        .set({ sessionRef: null, sessionLabel: null, sessionKcal: null })
        .where(inArray(schema.days.sessionRef, ids)),
    );
  }
  queries.push(db.delete(schema.trainingPlans).where(eq(schema.trainingPlans.id, id)));
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}
