import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { planOptionPrompt } from "@/server/ai/prompts";
import { planOptionAiZ } from "@/server/ai/schemas";

const bodyZ = z.object({
  nombre: z.string().min(1).max(200),
  gramos: z.number().int().min(0).max(5000).nullable().optional(),
});

// F-IA-3 · Estimar nueva opción del plan (CRUD de Plan).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  // Contexto compacto del atleta (doc 10 A2), sin sesgar la estimación de macros.
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    atleta = await retry(() => getAthleteContexts());
  } catch (err) {
    return serverError(err);
  }

  try {
    const result = await runStructured({
      kind: "text",
      task: "estimate",
      prompt: planOptionPrompt(
        parsed.data.nombre,
        parsed.data.gramos ?? null,
        atleta.compact,
      ),
      schema: planOptionAiZ,
      // El output es minúsculo (~60 tokens) pero en Gemini 3.5 los tokens de
      // "thinking" salen de maxOutputTokens: con 500 el thinking (incluso en nivel
      // "low") agotaba el presupuesto y truncaba antes del JSON → NoOutputGenerated
      // → 500. Holgura amplia; el techo no cobra tokens no generados (coste igual).
      maxOutputTokens: 2048,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
