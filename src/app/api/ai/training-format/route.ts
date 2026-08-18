import { z } from "zod";
import { ensureAuth, parseBody } from "@/lib/api";
import { aiErrorResponse } from "@/server/ai/errors";
import { formatTrainingContent } from "@/server/ai/training-format";

const bodyZ = z.object({ contenido: z.string().min(1).max(20000) });

// F25 · Dar formato a una sesión: marcar los rótulos de grupo. No toca la BD —
// devuelve el texto y quien llama decide si guardarlo (import, composer, ficha).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    return Response.json(await formatTrainingContent(parsed.data.contenido));
  } catch (err) {
    return aiErrorResponse(err);
  }
}
