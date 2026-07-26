import { isoWeekday, labelForKey } from "@/lib/dates";
import {
  sessionKcal,
  trainingWeekSpan,
  type TrainingTipo,
} from "@/lib/training";
import type { SessionFranja } from "@/lib/training-slot";

export interface CanonicalSessionFields {
  key?: string;
  nombre: string;
  tipo: TrainingTipo;
  contenido: string;
  kcalMin: number | null;
  kcalMax: number | null;
  duracionMin: number | null;
  franja: SessionFranja;
}

export interface CanonicalTrainingInput {
  date: string;
  session: CanonicalSessionFields;
}

export interface CanonicalDayState {
  exists: boolean;
  sessionRef: number | null;
  sessionLabel: string | null;
  sessionKcal: number | null;
}

export interface CanonicalSessionState {
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

export interface CanonicalWeekState {
  id: number;
  programa: string;
  etiqueta: string;
  validFrom: string;
  validTo: string | null;
  source: "pdf" | "foto" | "texto";
  sessionCount: number;
  maxSort: number;
}

export interface CanonicalTrainingState {
  day: CanonicalDayState | null;
  assignedSession: CanonicalSessionState | null;
  week: CanonicalWeekState | null;
  allocatedPlanId: number | null;
  allocatedSessionId: number | null;
  athleteProgram: string;
}

export interface CanonicalTrainingUndo {
  date: string;
  writtenSessionId: number;
  createdSession: boolean;
  createdPlanId: number | null;
  previousDay: CanonicalDayState;
  previousSession: CanonicalSessionState | null;
}

export interface CanonicalTrainingWrite {
  kind: "created" | "updated";
  planToInsert: {
    id: number;
    programa: string;
    etiqueta: string;
    source: "texto";
    validFrom: string;
    validTo: string;
  } | null;
  session: CanonicalSessionState;
  day: {
    date: string;
    sessionRef: number;
    sessionLabel: string;
    sessionKcal: number | null;
  };
  undo: CanonicalTrainingUndo;
}

function previousDay(
  day: CanonicalDayState | null,
): CanonicalDayState {
  return (
    day ?? {
      exists: false,
      sessionRef: null,
      sessionLabel: null,
      sessionKcal: null,
    }
  );
}

/** Plan puro de escritura que la query traduce a un único batch transaccional. */
export function buildCanonicalTrainingWrite(
  input: CanonicalTrainingInput,
  state: CanonicalTrainingState,
): CanonicalTrainingWrite {
  const current = state.assignedSession;
  const kind = current ? "updated" : "created";
  const sessionId = current?.id ?? state.allocatedSessionId;
  if (sessionId == null) throw new Error("Falta reservar el id de la sesión.");

  const span = trainingWeekSpan(input.date);
  const planId = current?.planId ?? state.week?.id ?? state.allocatedPlanId;
  if (planId == null) throw new Error("Falta reservar el id de la semana.");

  const programa = state.athleteProgram.trim() || "Entreno manual";
  const planToInsert =
    current || state.week
      ? null
      : {
          id: planId,
          programa,
          etiqueta: `Semana del ${labelForKey(span.validFrom)}`,
          source: "texto" as const,
          validFrom: span.validFrom,
          validTo: span.validTo,
        };
  const session: CanonicalSessionState = {
    id: sessionId,
    planId,
    key:
      input.session.key?.trim() ||
      current?.key ||
      `Día ${isoWeekday(input.date)}`,
    nombre: input.session.nombre.trim(),
    tipo: input.session.tipo,
    contenido: input.session.contenido,
    kcalMin: input.session.kcalMin,
    kcalMax: input.session.kcalMax,
    duracionMin: input.session.duracionMin,
    franja: input.session.franja,
    sort: current?.sort ?? (state.week ? state.week.maxSort + 1 : 0),
  };

  return {
    kind,
    planToInsert,
    session,
    day: {
      date: input.date,
      sessionRef: session.id,
      sessionLabel: session.nombre,
      sessionKcal: sessionKcal(session.kcalMin, session.kcalMax),
    },
    undo: {
      date: input.date,
      writtenSessionId: session.id,
      createdSession: !current,
      createdPlanId: planToInsert?.id ?? null,
      previousDay: previousDay(state.day),
      previousSession: current,
    },
  };
}
