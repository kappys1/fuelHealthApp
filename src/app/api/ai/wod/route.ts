import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { dateZ } from "@/lib/schemas";
import { dayKey } from "@/lib/dates";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { wodPrompt } from "@/server/ai/prompts";
import { wodZ } from "@/server/ai/schemas";
import { latestWeightOnOrBefore } from "@/server/db/queries/day";

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
  // pesoReciente = último peso registrado (fallback 92) para ATHLETE_CONTEXT.
  let peso: number;
  try {
    peso = (await retry(() => latestWeightOnOrBefore(date))) ?? 92;
  } catch (err) {
    return serverError(err);
  }

  try {
    const result = await runStructured({
      kind: "text",
      task: "estimate",
      prompt: wodPrompt(parsed.data.texto, peso),
      schema: wodZ,
      maxOutputTokens: 800,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
