import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { normalizeImage } from "@/server/ai/image";
import { labelReadPrompt } from "@/server/ai/prompts";
import { labelReadZ } from "@/server/ai/schemas";

/*
  F-IA-11 · Leer etiqueta nutricional de un producto (F07 · Mis productos). Foto(s)
  de la tabla nutricional (HEIC→JPEG vía normalizeImage, reutiliza la infra de visión
  F-IA-1/9). Es una LECTURA, no una estimación: el prompt (congelado, 04-IA §F-IA-11)
  ordena null donde el dato NO figura. La respuesta es una VISTA PREVIA: no persiste
  nada; el editor la muestra para que Alex confirme/edite antes de guardar.
*/
const fileZ = z.object({
  base64: z.string().min(1),
  mediaType: z.string().min(1).max(80),
});
const bodyZ = z.object({
  files: z.array(fileZ).min(1).max(2),
});

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  let images;
  try {
    images = await Promise.all(parsed.data.files.map((f) => normalizeImage(f)));
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Archivo inválido.");
  }

  // Contexto compacto del atleta (doc 10 A2): no debe sesgar la LECTURA de la etiqueta.
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    atleta = await retry(() => getAthleteContexts());
  } catch (err) {
    return serverError(err);
  }

  try {
    const result = await runStructured({
      kind: "vision",
      task: "vision",
      prompt: labelReadPrompt(atleta.compact),
      images,
      schema: labelReadZ,
      maxOutputTokens: 2048,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
