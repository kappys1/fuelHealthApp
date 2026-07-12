import { ensureAuth, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { computeDeficit } from "@/server/analytics/deficit";
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

  try {
    const text = await runText({
      kind: "coach",
      task: "coach",
      prompt: prepareVisitPrompt({
        pesoReciente: lastWeight,
        kcal: currentTarget.kcal,
        prot: currentTarget.prot,
        meds: medLines(meds),
        tendencia: trendSummary(deficit),
        filas: dayLines(records, 21),
      }),
      maxOutputTokens: 1200,
    });
    return Response.json({ text });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
