import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dietVersionCreateZ } from "@/lib/schemas";
import { createDietVersionFull } from "@/server/db/queries/mutations";

/*
  Crea una versión de dieta completa desde la vista previa de F-IA-9. Se llama solo
  al confirmar; el effective_from lo elige el usuario. Los días pasados siguen
  evaluándose contra su versión de entonces.
*/
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, dietVersionCreateZ);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;

  try {
    const version = await createDietVersionFull({
      effectiveFrom: d.effectiveFrom,
      kcal: d.kcal,
      prot: d.prot,
      carb: d.carb,
      fat: d.fat,
      options: d.options,
    });
    return Response.json({ version });
  } catch (err) {
    return serverError(err);
  }
}
