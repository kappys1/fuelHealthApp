import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { aiErrorResponse } from "@/server/ai/errors";
import { normalizeImage } from "@/server/ai/image";
import { trainingImportPrompt } from "@/server/ai/prompts";
import { trainingImportZ } from "@/server/ai/schemas";

/*
  F-IA-10 · Importar semana de entrenamiento. Acepta PDF/foto (files, reutiliza la
  infra de F-IA-9: PDF nativo a Gemini, HEIC→JPEG) O texto pegado. Resultado = vista
  previa editable; no se persiste nada aquí (eso lo hace /api/training/plan).
*/
const fileZ = z.object({
  base64: z.string().min(1),
  mediaType: z.string().min(1).max(80),
});
const bodyZ = z
  .object({
    files: z.array(fileZ).min(1).max(4).optional(),
    texto: z.string().min(1).max(8000).optional(),
  })
  .refine((b) => (b.files?.length ?? 0) > 0 || !!b.texto?.trim(), {
    message: "Aporta un PDF/foto o el texto de la semana.",
  });

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;
  const { files, texto } = parsed.data;

  // Contexto del atleta (deporte/programa/peso) para estimar el gasto (F-IA-5).
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    atleta = await retry(() => getAthleteContexts());
  } catch (err) {
    return serverError(err);
  }

  let images: Awaited<ReturnType<typeof normalizeImage>>[] | undefined;
  if (files?.length) {
    try {
      images = await Promise.all(files.map((f) => normalizeImage(f)));
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Archivo inválido.");
    }
  }

  try {
    const result = await runStructured({
      kind: images ? "vision" : "text",
      task: images ? "vision" : "estimate",
      prompt: trainingImportPrompt(atleta.full, texto ?? null),
      images,
      schema: trainingImportZ,
      // Extracción grande (semana entera) + thinking de Gemini: margen amplio.
      maxOutputTokens: 8192,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
