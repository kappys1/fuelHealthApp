import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import {
  ATHLETE_PROFILE_KEY,
  getAthleteProfile,
  setSetting,
} from "@/server/db/queries/lookups";

/*
  Perfil de atleta (doc 10 A1). Setting `athleteProfile` (jsonb, sin migración). El
  historial de objetivos se conserva: cambiar de objetivo = añadir entrada fechada
  (el cliente arma la lista completa; aquí solo validamos y guardamos).
*/

// GET /api/settings/athlete-profile → perfil vigente (con defaults).
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    return Response.json({ profile: await getAthleteProfile() });
  } catch (err) {
    return serverError(err);
  }
}

const dayKeyZ = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha 'YYYY-MM-DD' inválida.");

const objectiveZ = z.object({
  desde: dayKeyZ,
  texto: z.string().min(1).max(400),
  pesoObjetivo: z.number().min(0).max(500).nullable().optional(),
});

const profileZ = z.object({
  fechaNacimiento: dayKeyZ.nullable(),
  alturaCm: z.number().int().min(0).max(260).nullable(),
  sexo: z.string().max(40).nullable().optional(),
  deporte: z.string().min(1).max(80),
  nivel: z.string().max(80),
  programa: z.string().max(120),
  franjaEntreno: z.string().max(60),
  suplementos: z.array(z.string().min(1).max(60)).max(30),
  notaClinica: z.string().max(400).nullable().optional(),
  lesiones: z.array(z.string().min(1).max(120)).max(30).optional(),
  objetivos: z.array(objectiveZ).min(1).max(100),
});

// PATCH /api/settings/athlete-profile → guardar el perfil completo.
export async function PATCH(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, z.object({ profile: profileZ }));
  if ("error" in parsed) return parsed.error;

  try {
    await setSetting(ATHLETE_PROFILE_KEY, parsed.data.profile);
    return Response.json({ profile: await getAthleteProfile() });
  } catch (err) {
    return serverError(err);
  }
}
