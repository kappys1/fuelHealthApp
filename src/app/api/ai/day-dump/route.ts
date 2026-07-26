import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { dateZ } from "@/lib/schemas";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runStructured } from "@/server/ai/client";
import { productsContext } from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { applyProductMatches } from "@/server/ai/product-match";
import { dayDumpPrompt } from "@/server/ai/prompts";
import { dayDumpZ } from "@/server/ai/schemas";
import { listProducts } from "@/server/db/queries/lookups";
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
  // F18: el catálogo «Mis productos» viaja al prompt (identificación) y a
  // applyProductMatches (recálculo determinista). Entra en el Promise.all con retry;
  // si falla → serverError (error-BD, separado del error-IA de más abajo).
  let products: Awaited<ReturnType<typeof listProducts>>;
  try {
    [plan, atleta, products] = await Promise.all([
      retry(() => getPlanContext(parsed.data.date)),
      retry(() => getAthleteContexts(parsed.data.date)),
      retry(() => listProducts()),
    ]);
  } catch (err) {
    return serverError(err);
  }

  try {
    const kcal = plan?.targets.kcal ?? null;
    const prot = plan?.targets.prot ?? null;
    const result = await runStructured({
      // Tabla 04-IA: F-IA-4 usa el modelo de visión (troceo fiable), pensamiento
      // "estimate" (thinking low) por la regla de determinismo.
      kind: "vision",
      task: "estimate",
      prompt: dayDumpPrompt(
        parsed.data.texto,
        kcal,
        prot,
        atleta.compact,
        productsContext(products),
      ),
      schema: dayDumpZ,
      // Un volcado del día entero puede trocearse en muchos items; con el thinking
      // de Gemini saliendo de este presupuesto, damos margen para no truncar el JSON.
      maxOutputTokens: 2500,
    });
    // F18: el modelo identifica el producto; el servidor sobrescribe sus macros con
    // la etiqueta guardada (diseño B, determinista). Los items sin match no cambian.
    return Response.json({ items: applyProductMatches(result.items, products) });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
