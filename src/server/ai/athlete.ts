import { dayKey } from "@/lib/dates";
import type { SessionByWeekday } from "@/lib/macros";
import { trainingDaysPerWeek } from "@/lib/profile";
import { latestWeightOnOrBefore } from "@/server/db/queries/day";
import {
  getAthleteProfile,
  getSessionByWeekday,
} from "@/server/db/queries/lookups";
import { athleteContext, athleteContextCompact } from "./prompts";

/*
  Carga el perfil vigente + mapeo de sesiones + último peso y construye las dos
  variantes de ATHLETE_CONTEXT (doc 10 A2). Punto único desde el que TODAS las
  rutas de IA obtienen el contexto del atleta: cero datos hardcodeados en prompts.
  `diasEntrenoSemana` se deriva del mapeo (una sola fuente de verdad).
*/
export interface AthleteContexts {
  peso: number;
  sessionByWeekday: SessionByWeekday;
  /** Contexto completo (coach/WOD/visita/chat). */
  full: string;
  /** Contexto compacto + cláusula anti-sesgo (estimaciones). */
  compact: string;
  /** Compacto con excepción de escala para F-IA-1 (foto). */
  compactPhoto: string;
}

export async function getAthleteContexts(
  date: string = dayKey(),
  knownPeso?: number | null,
): Promise<AthleteContexts> {
  const [profile, sessionByWeekday, pesoDb] = await Promise.all([
    getAthleteProfile(),
    getSessionByWeekday(),
    knownPeso != null
      ? Promise.resolve(knownPeso)
      : latestWeightOnOrBefore(date),
  ]);
  const peso = (knownPeso ?? pesoDb) ?? 92;
  const trainingDays = trainingDaysPerWeek(sessionByWeekday);
  return {
    peso,
    sessionByWeekday,
    full: athleteContext(profile, peso, trainingDays, date),
    compact: athleteContextCompact(profile, peso),
    compactPhoto: athleteContextCompact(profile, peso, {
      photoScaleException: true,
    }),
  };
}
