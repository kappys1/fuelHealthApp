import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { createVersionWithTargets } from "@/server/db/queries/mutations";

const bodyZ = z.object({
  kcal: z.number().int().min(0).max(20000),
  prot: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000).nullable(),
  fat: z.number().min(0).max(2000).nullable(),
});

// PATCH /api/plan/targets → crea nueva versión de dieta con estos objetivos (F1.5).
export async function PATCH(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    const version = await createVersionWithTargets(parsed.data);
    return Response.json({ version });
  } catch (err) {
    return serverError(err);
  }
}
