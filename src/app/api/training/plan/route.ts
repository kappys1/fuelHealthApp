import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { trainingPlanCreateZ } from "@/lib/schemas";
import {
  planSpanFromAssignments,
  sessionKcal,
  trainingWeekSpan,
} from "@/lib/training";
import {
  assignSessionsToDays,
  createTrainingPlanFull,
  deleteTrainingPlan,
  restoreTrainingPlans,
  type DayAssignment,
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
  const { programa, etiqueta, source, weekStart, sessions, assignments } = parsed.data;
  const assignedDates = assignments.map((assignment) => assignment.date);
  if (new Set(assignedDates).size !== assignedDates.length) {
    return badRequest("Solo puede haber una sesión asignada a cada día.");
  }
  const assignedSessions = assignments.map((assignment) => assignment.sessionIndex);
  if (new Set(assignedSessions).size !== assignedSessions.length) {
    return badRequest("Cada sesión solo puede asignarse a un día.");
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
    const {
      plan,
      sessions: created,
      closedPlanIds,
    } = await createTrainingPlanFull({
      programa,
      etiqueta,
      source,
      validFrom: span.validFrom,
      validTo: span.validTo,
      sessions: sessions.map((s) => ({
        key: s.key,
        nombre: s.nombre,
        tipo: s.tipo,
        contenido: s.contenido,
        kcalMin: s.kcalMin,
        kcalMax: s.kcalMax,
        duracionMin: s.duracionMin,
      })),
    });

    // Mapear el índice de la vista previa (== sort al insertar) a la sesión creada.
    const bySort = new Map(created.map((c) => [c.sort, c]));
    const dayAssignments: DayAssignment[] = assignments.flatMap((a) => {
      const s = bySort.get(a.sessionIndex);
      if (!s) return [];
      return [
        {
          date: a.date,
          sessionRef: s.id,
          sessionLabel: s.nombre,
          sessionKcal: sessionKcal(s.kcalMin, s.kcalMax),
        },
      ];
    });
    let res: { assigned: number; skipped: number };
    try {
      res = await assignSessionsToDays(dayAssignments);
    } catch (error) {
      await deleteTrainingPlan(plan.id);
      await restoreTrainingPlans(closedPlanIds);
      throw error;
    }

    return Response.json({ ok: true, ...res });
  } catch (err) {
    return serverError(err);
  }
}
