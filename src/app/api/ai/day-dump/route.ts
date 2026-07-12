import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { dateZ } from "@/lib/schemas";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { dayDumpPrompt } from "@/server/ai/prompts";
import { dayDumpZ } from "@/server/ai/schemas";
import { getPlanContext } from "@/server/db/queries/plan";

const bodyZ = z.object({
  texto: z.string().min(1).max(3000),
  date: dateZ,
});

// F-IA-4 · Volcado del día (capa "Describir": una comida o el día entero).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  let plan;
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    [plan, atleta] = await Promise.all([
      retry(() => getPlanContext(parsed.data.date)),
      retry(() => getAthleteContexts(parsed.data.date)),
    ]);
  } catch (err) {
    return serverError(err);
  }

  try {
    const kcal = plan?.targets.kcal ?? 1800;
    const prot = plan?.targets.prot ?? 110;
    const result = await runStructured({
      // Tabla 04-IA: F-IA-4 usa el modelo de visión (troceo fiable), pensamiento
      // "estimate" (thinking low) por la regla de determinismo.
      kind: "vision",
      task: "estimate",
      prompt: dayDumpPrompt(parsed.data.texto, kcal, prot, atleta.compact),
      schema: dayDumpZ,
      // Un volcado del día entero puede trocearse en muchos items; con el thinking
      // de Gemini saliendo de este presupuesto, damos margen para no truncar el JSON.
      maxOutputTokens: 2500,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
