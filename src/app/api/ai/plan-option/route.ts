import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { productsContext } from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { applyPlanOptionProductMatch } from "@/server/ai/product-match";
import { planOptionPrompt } from "@/server/ai/prompts";
import { planOptionAiZ } from "@/server/ai/schemas";
import { listProducts } from "@/server/db/queries/lookups";

const bodyZ = z.object({
  nombre: z.string().min(1).max(200),
  gramos: z.number().int().min(0).max(5000).nullable().optional(),
});

// F-IA-3 · Estimar nueva opción del plan (CRUD de Plan).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  // Contexto compacto del atleta (doc 10 A2) + catálogo F19. Ambas lecturas llevan
  // retry y cualquier fallo aquí es de BD (serverError), separado del error de IA.
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  let products: Awaited<ReturnType<typeof listProducts>>;
  try {
    [atleta, products] = await Promise.all([
      retry(() => getAthleteContexts()),
      retry(() => listProducts()),
    ]);
  } catch (err) {
    return serverError(err);
  }

  try {
    const result = await runStructured({
      kind: "text",
      task: "estimate",
      prompt: planOptionPrompt(
        parsed.data.nombre,
        parsed.data.gramos ?? null,
        atleta.compact,
        productsContext(products),
      ),
      schema: planOptionAiZ,
      // El output es minúsculo (~60 tokens) pero en Gemini 3.5 los tokens de
      // "thinking" salen de maxOutputTokens: con 500 el thinking (incluso en nivel
      // "low") agotaba el presupuesto y truncaba antes del JSON → NoOutputGenerated
      // → 500. Holgura amplia; el techo no cobra tokens no generados (coste igual).
      maxOutputTokens: 2048,
    });
    // F19: el modelo reconoce el producto; el servidor valida el canónico y aplica
    // la etiqueta guardada a los gramos del body. Sin match, conserva la estimación.
    return Response.json(
      applyPlanOptionProductMatch(
        result,
        parsed.data.gramos ?? null,
        products,
      ),
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
