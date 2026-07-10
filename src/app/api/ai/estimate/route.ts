import { z } from "zod";
import { ensureAuth, parseBody } from "@/lib/api";
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

  try {
    const result = await runStructured({
      kind: "text",
      task: "estimate",
      prompt: estimatePrompt(parsed.data.descripcion),
      schema: estimateZ,
      maxOutputTokens: 500,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
