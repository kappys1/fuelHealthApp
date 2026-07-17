import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { normalizeImage } from "@/server/ai/image";
import { aiErrorResponse } from "@/server/ai/errors";
import { dietImportPrompt } from "@/server/ai/prompts";
import { dietImportZ } from "@/server/ai/schemas";

/*
  F-IA-9 · Importar dieta desde foto/PDF. Máx 4 archivos (páginas). Las imágenes se
  normalizan (HEIC→JPEG, límite 8 MB); el PDF se pasa TAL CUAL a Gemini, que lo lee
  de forma nativa como documento (evita depender de pdf-to-img). El resultado es una
  VISTA PREVIA: no se persiste nada hasta que el usuario confirme «Crear versión».
*/
const fileZ = z.object({
  base64: z.string().min(1),
  mediaType: z.string().min(1).max(80),
});
const bodyZ = z.object({
  files: z.array(fileZ).min(1).max(4),
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

  // Contexto compacto del atleta (doc 10 A2), sin sesgar la extracción de macros.
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
      prompt: dietImportPrompt(atleta.compact),
      images,
      schema: dietImportZ,
      // Extracción grande (~34 opciones) + tokens de "thinking" de visión: 3000 del
      // spec (pensado para Claude) se quedaban cortos con Gemini → 8192 (DECISIONS
      // #44/#48). F08 añade "variantes" por opción (carne/hidratos/pescado con 4
      // c/u) → el JSON crece y 8192 se truncaba (500 tras ~23 s). Ampliado a 16384.
      maxOutputTokens: 16384,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
