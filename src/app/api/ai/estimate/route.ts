import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { estimatePrompt } from "@/server/ai/prompts";
import { estimateZ } from "@/server/ai/schemas";

const bodyZ = z.object({ descripcion: z.string().min(1).max(500) });

// F-IA-2 · Estimar macros desde texto (fallback de la búsqueda universal).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  // Contexto compacto del atleta (doc 10 A2): perfil como contexto, sin sesgar la
  // estimación (los macros son del alimento). Lectura de BD → serverError.
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
      prompt: estimatePrompt(parsed.data.descripcion, atleta.compact),
      schema: estimateZ,
      maxOutputTokens: 500,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
