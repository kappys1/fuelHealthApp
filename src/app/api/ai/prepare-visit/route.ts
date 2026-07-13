import { ensureAuth, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { computeDeficit } from "@/server/analytics/deficit";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runText } from "@/server/ai/client";
import { dayLines, medLines, trendSummary } from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { prepareVisitPrompt } from "@/server/ai/prompts";
import { listMed } from "@/server/db/queries/med";
import { getTrendData } from "@/server/db/queries/trend";

/*
  F-IA-7 · Preparar visita al nutricionista. Contexto: últimos 21 días con datos +
  historial MED completo + tendencia calculada. Respuesta en texto plano (máx 200
  palabras). Límite ético (principio 8): observaciones y preguntas, nunca pautas.
*/
export async function POST() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const today = dayKey();
  let trend: Awaited<ReturnType<typeof getTrendData>>;
  let meds: Awaited<ReturnType<typeof listMed>>;
  try {
    [trend, meds] = await Promise.all([
      retry(() => getTrendData()),
      retry(() => listMed()),
    ]);
  } catch (err) {
    return serverError(err);
  }

  const { records, currentTarget } = trend;
  const deficit = computeDeficit(records);
  const lastWeight =
    [...records].reverse().find((r) => r.weight != null)?.weight ?? 92;

  // ATHLETE_CONTEXT dinámico (doc 10 A2) + mapeo para el calendario del día en curso.
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    atleta = await retry(() => getAthleteContexts(today, lastWeight));
  } catch (err) {
    return serverError(err);
  }

  try {
    const text = await runText({
      kind: "coach",
      task: "coach",
      prompt: prepareVisitPrompt({
        atleta: atleta.full,
        today,
        kcal: currentTarget.kcal,
        prot: currentTarget.prot,
        meds: medLines(meds),
        tendencia: trendSummary(deficit),
        filas: dayLines(records, 21, {
          sessionByWeekday: atleta.sessionByWeekday,
          today,
        }),
      }),
      // Presupuesto amplio: thinking "medium" (análisis) + 200 palabras de texto
      // deben caber sin truncar. Los tokens de thinking cuentan aquí (DECISIONS #48).
      maxOutputTokens: 4096,
    });
    return Response.json({ text });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
