import { z } from "zod";
import { badRequest, ensureAuth, parseBody } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { lesionesVigentes } from "@/lib/profile";
import { retry } from "@/lib/retry";
import { dateZ } from "@/lib/schemas";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runText } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import {
  ADAPT_SESSION_MAX_OUTPUT_TOKENS,
  adaptSessionPrompt,
} from "@/server/ai/prompts";
import { stripTrainingGroupMarkers } from "@/lib/training";
import { getDayView } from "@/server/db/queries/day";

/*
  F26 Fase 2 · genera la sesión adaptada del día. NO guarda nada: devuelve el
  texto y la UI lo abre en un editor para que Alex lo revise (la única puerta de
  guardado es POST /api/day/adapted-session).

  La capacidad de la lesión vigente entra como DATO (no se le pide al modelo que
  deduzca la limitación del motivo): mismo criterio que el resto de la casa —
  los juicios se precalculan en servidor y el modelo redacta.
*/
const bodyZ = z.object({
  date: dateZ.optional(),
  motivo: z.string().min(1).max(300),
});


export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  const date = parsed.data.date ?? dayKey();

  try {
    const [view, athlete] = await Promise.all([
      retry(() => getDayView(date)),
      retry(() => getAthleteContexts(date)),
    ]);

    /*
      Se adapta la PLANIFICADA, siempre: la adaptada de hoy es una alternativa a
      la del plan, no una adaptación de la adaptación (regenerar sobre lo ya
      adaptado iría alejándose del estímulo original en cada pasada).
    */
    const planificada = view.session?.contenido?.trim();
    if (!planificada) {
      return badRequest(
        "Este día no tiene sesión del plan que adaptar. Asígnala primero.",
      );
    }

    // Los marcadores de grupo de F25 no viajan al modelo (DECISIONS #95): recibe
    // el texto tal cual lo recibía antes, y el formateo se aplica a la vuelta.
    const capacidad = lesionesVigentes(athlete.profile)
      .map((l) => l.capacidad.trim())
      .filter(Boolean)
      .join(" ");

    const contenido = await runText({
      kind: "coach",
      task: "coach",
      prompt: adaptSessionPrompt({
        atleta: athlete.full,
        fecha: date,
        motivo: parsed.data.motivo.trim(),
        capacidad,
        planificada: stripTrainingGroupMarkers(planificada),
        nombre: view.session?.nombre ?? "sesión del día",
      }),
      maxOutputTokens: ADAPT_SESSION_MAX_OUTPUT_TOKENS,
    });

    return Response.json({ contenido: contenido.trim() });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
