import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { dateZ } from "@/lib/schemas";
import { dayKey } from "@/lib/dates";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { wodPrompt } from "@/server/ai/prompts";
import { wodZ } from "@/server/ai/schemas";

const bodyZ = z.object({
  texto: z.string().min(1).max(4000),
  date: dateZ.optional(),
});

// F-IA-5 · Analizar sesión pegada (WOD) — en la tarjeta "Mi día".
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  const date = parsed.data.date ?? dayKey();
  // ATHLETE_CONTEXT dinámico desde el perfil (doc 10 A2). Lectura de BD → serverError.
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    atleta = await retry(() => getAthleteContexts(date));
  } catch (err) {
    return serverError(err);
  }

  try {
    const result = await runStructured({
      kind: "text",
      task: "estimate",
      prompt: wodPrompt(parsed.data.texto, atleta.full),
      schema: wodZ,
      // Ver plan-option: el thinking de Gemini 3.5 sale de maxOutputTokens; 800
      // quedaba al borde para una sesión (más razonamiento + nombre/comentario).
      maxOutputTokens: 2048,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
