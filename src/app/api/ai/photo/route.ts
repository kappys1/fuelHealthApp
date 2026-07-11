import { z } from "zod";
import { ensureAuth, badRequest, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { dateZ, mealZ } from "@/lib/schemas";
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

  // Contexto del plan (BD): errores de BD se reportan como tales, no como "IA:".
  // retry() absorbe el arranque en frío de Neon (scale-to-zero).
  let plan;
  try {
    plan = await retry(() => getPlanContext(date));
  } catch (err) {
    return serverError(err);
  }

  try {
    const result = await runStructured({
      kind: "vision",
      task: "vision", // visión: thinking por defecto (regla de determinismo 04-IA)
      prompt: photoPrompt({
        meal,
        kcalObjetivo: plan?.targets.kcal ?? 1800,
        protObjetivo: plan?.targets.prot ?? 110,
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
