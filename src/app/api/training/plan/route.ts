import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { trainingPlanCreateZ } from "@/lib/schemas";
import { planSpanFromAssignments, sessionKcal } from "@/lib/training";
import {
  assignSessionsToDays,
  createTrainingPlanFull,
  type DayAssignment,
} from "@/server/db/queries/training";

/*
  F-IA-10 · Crear el plan de entreno tras la vista previa: inserta training_plans +
  training_sessions y asigna las sesiones a sus días (sin pisar días ya registrados).
  valid_from/valid_to = span de las fechas asignadas.
*/
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, trainingPlanCreateZ);
  if ("error" in parsed) return parsed.error;
  const { programa, etiqueta, source, sessions, assignments } = parsed.data;

  const span = planSpanFromAssignments(assignments.map((a) => a.date)) ?? {
    validFrom: dayKey(),
    validTo: dayKey(),
  };

  try {
    const { sessions: created } = await createTrainingPlanFull({
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
    const res = await assignSessionsToDays(dayAssignments);

    return Response.json({ ok: true, ...res });
  } catch (err) {
    return serverError(err);
  }
}
