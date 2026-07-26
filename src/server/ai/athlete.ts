import { dayKey } from "@/lib/dates";
import { type AthleteProfile, trainingDaysPerWeek } from "@/lib/profile";
import type { TrainingByWeekday } from "@/lib/training-slot";
import { latestWeightOnOrBefore } from "@/server/db/queries/day";
import {
  getAthleteProfile,
  getTrainingByWeekday,
} from "@/server/db/queries/lookups";
import { athleteContext, athleteContextCompact } from "./prompts";

/*
  Carga el perfil vigente + mapeo de sesiones + último peso y construye las dos
  variantes de ATHLETE_CONTEXT (doc 10 A2). Punto único desde el que TODAS las
  rutas de IA obtienen el contexto del atleta: cero datos hardcodeados en prompts.
  `diasEntrenoSemana` se deriva del mapeo (una sola fuente de verdad).
*/
export interface AthleteContexts {
  peso: number | null;
  trainingByWeekday: TrainingByWeekday;
  /** Perfil vigente (para leer el objetivo en servidor; F-IA-6 cierre). */
  profile: AthleteProfile;
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
  const [profile, trainingByWeekday, pesoDb] = await Promise.all([
    getAthleteProfile(),
    getTrainingByWeekday(),
    knownPeso != null
      ? Promise.resolve(knownPeso)
      : latestWeightOnOrBefore(date),
  ]);
  const peso = knownPeso ?? pesoDb;
  const trainingDays = trainingDaysPerWeek(trainingByWeekday);
  return {
    peso,
    trainingByWeekday,
    profile,
    full: athleteContext(profile, peso, trainingDays, date),
    compact: athleteContextCompact(profile, peso),
    compactPhoto: athleteContextCompact(profile, peso, {
      photoScaleException: true,
    }),
  };
}
