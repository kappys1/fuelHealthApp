import { createHash } from "node:crypto";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { trainingPlanCreateZ } from "@/lib/schemas";
import {
  planSpanFromAssignments,
  trainingWeekSpan,
} from "@/lib/training";
import {
  createTrainingPlanAtomic,
  TrainingPlanOverlapError,
} from "@/server/db/queries/training";

/*
  F-IA-10 · Crear el plan de entreno tras la vista previa: inserta training_plans +
  training_sessions y asigna las sesiones a sus días (sin pisar días ya registrados).
  En V2, valid_from/valid_to conserva la semana lunes-domingo elegida. Los clientes
  antiguos siguen usando el span de asignaciones como fallback.
*/
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, trainingPlanCreateZ);
  if ("error" in parsed) return parsed.error;
  const { requestId, programa, etiqueta, source, weekStart, sessions, assignments } =
    parsed.data;
  const assignedDates = assignments.map((assignment) => assignment.date);
  if (new Set(assignedDates).size !== assignedDates.length) {
    return badRequest("Solo puede haber una sesión asignada a cada día.");
  }
  const assignedSessions = assignments.map((assignment) => assignment.sessionIndex);
  if (new Set(assignedSessions).size !== assignedSessions.length) {
    return badRequest("Cada sesión solo puede asignarse a un día.");
  }
  if (assignedSessions.some((index) => index >= sessions.length)) {
    return badRequest("Una asignación apunta a una sesión inexistente.");
  }

  const span = weekStart
    ? trainingWeekSpan(weekStart)
    : planSpanFromAssignments(assignments.map((a) => a.date)) ?? {
        validFrom: dayKey(),
        validTo: dayKey(),
      };
  if (
    weekStart &&
    assignedDates.some((date) => date < span.validFrom || date > span.validTo)
  ) {
    return badRequest("Todas las sesiones deben pertenecer a la semana elegida.");
  }

  try {
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({ programa, etiqueta, source, weekStart, sessions, assignments }),
      )
      .digest("hex");
    const result = await createTrainingPlanAtomic(
      {
        programa,
        etiqueta,
        source,
        validFrom: span.validFrom,
        validTo: span.validTo,
        sessions,
      },
      assignments,
      requestId,
      fingerprint,
    );
    return Response.json({
      ok: true,
      assigned: result.assigned,
      skipped: result.skipped,
      replayed: result.replayed,
    });
  } catch (err) {
    if (err instanceof TrainingPlanOverlapError) return badRequest(err.message);
    return serverError(err);
  }
}
