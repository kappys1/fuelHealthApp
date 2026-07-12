import { z } from "zod";
import { badRequest, ensureAuth, parseBody } from "@/lib/api";
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

  try {
    const result = await runStructured({
      kind: "vision",
      task: "vision",
      prompt: dietImportPrompt(),
      images,
      schema: dietImportZ,
      // Extracción grande (~34 opciones) + tokens de "thinking" de visión: 3000 del
      // spec (pensado para Claude) se quedaban cortos con Gemini; ampliado a 8192.
      maxOutputTokens: 8192,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
