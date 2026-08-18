import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { applyLesionReview } from "@/lib/profile";
import {
  ATHLETE_PROFILE_KEY,
  getAthleteProfile,
  setSetting,
} from "@/server/db/queries/lookups";

/*
  F26 Fase 1 · revisión de una lesión vencida desde el check-in matinal. Puerta
  estrecha a propósito: el check-in manda UNA respuesta sobre UNA lesión, no el
  perfil entero (que es lo que hace Ajustes). Así dos superficies no se pisan el
  perfil entre ellas. El cálculo vive en `applyLesionReview` (puro y testeado).
*/
const bodyZ = z.object({
  id: z.string().min(1).max(64),
  review: z.enum(["igual", "mejor", "cerrada"]),
  capacidad: z.string().max(1000).optional(),
});

// POST /api/settings/lesion-review → perfil con la lesión revisada.
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    const profile = await getAthleteProfile();
    const next = applyLesionReview(
      profile,
      parsed.data.id,
      parsed.data.review,
      dayKey(),
      parsed.data.capacidad,
    );
    await setSetting(ATHLETE_PROFILE_KEY, next);
    return Response.json({ profile: next });
  } catch (err) {
    return serverError(err);
  }
}
