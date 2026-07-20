import { z } from "zod";
import { ensureAuth, badRequest, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { dateZ, mealZ } from "@/lib/schemas";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { normalizeImage } from "@/server/ai/image";
import { photoPrompt, planOptionsList } from "@/server/ai/prompts";
import { photoResultZ } from "@/server/ai/schemas";
import { getPlanContext } from "@/server/db/queries/plan";

const bodyZ = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.string().min(1).max(80),
  meal: mealZ,
  note: z.string().max(600).nullable().optional(),
  date: dateZ,
});

// F-IA-1 · Análisis de foto de comida (capa "Foto" del sheet).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;
  const { imageBase64, mediaType, meal, note, date } = parsed.data;

  let image;
  try {
    image = await normalizeImage({ base64: imageBase64, mediaType });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Imagen inválida.");
  }

  // Contexto del plan + perfil (BD): errores de BD se reportan como tales, no como
  // "IA:". retry() absorbe el arranque en frío de Neon (scale-to-zero).
  let plan;
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    [plan, atleta] = await Promise.all([
      retry(() => getPlanContext(date)),
      retry(() => getAthleteContexts(date)),
    ]);
  } catch (err) {
    return serverError(err);
  }

  try {
    const result = await runStructured({
      kind: "vision",
      task: "vision", // visión: thinking por defecto (regla de determinismo 04-IA)
      prompt: photoPrompt({
        // Compacto con excepción de escala (doc 10 A2): la altura/complexión SÍ
        // sirve de referencia de tamaño de ración en la foto.
        contexto: atleta.compactPhoto,
        meal,
        kcalObjetivo: plan?.targets.kcal ?? null,
        protObjetivo: plan?.targets.prot ?? null,
        listaOpciones: planOptionsList(plan?.optionsByMeal[meal] ?? []),
        note,
      }),
      images: [image],
      schema: photoResultZ,
      // En Gemini 3 los tokens de "thinking" salen de maxOutputTokens; con visión
      // en thinkingLevel:"medium" (04-IA/DECISIONS #48), 1500 se agotaban pensando
      // y el JSON quedaba vacío/truncado ("Output not generated"). 4096 da margen
      // para el razonamiento + el desglose de la foto (≥3 items).
      maxOutputTokens: 4096,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
