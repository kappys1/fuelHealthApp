import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import {
  applyImport,
  parseImport,
  previewImport,
} from "@/server/db/queries/backup";

/*
  Import / restore desde un export JSON (F4.5 / 07 §4). Dos fases:
  vista previa (apply=false) con el resumen de qué reemplaza, y aplicar
  (apply=true) que hace el restore completo. El restore es destructivo
  (reemplaza todo) → siempre se confirma en la UI.
*/

const bodyZ = z.object({
  data: z.unknown(),
  apply: z.boolean().default(false),
});

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  let importData;
  try {
    importData = parseImport(parsed.data.data);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Archivo inválido.");
  }

  try {
    if (!parsed.data.apply) {
      return Response.json({ preview: true, ...(await previewImport(importData)) });
    }
    const result = await applyImport(importData);
    return Response.json({ preview: false, ...result });
  } catch (err) {
    return serverError(err);
  }
}
