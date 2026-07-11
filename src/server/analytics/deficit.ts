/*
  Déficit / TDEE reales DESDE EL PESO (03-DATOS §3 / F6.2 / principio 1) — PURO.

  Requiere ≥8 pesajes elegibles repartidos en ≥7 días. Si no, estado "no enough"
  (la UI pide pesarse a diario en ayunas).

    kgSemana     = (ma7(último) − ma7(primero)) / díasEntreEllos × 7
    deficitDía   = round(−kgSemana × 7700 / 7)     // 7.700 kcal ≈ 1 kg de grasa
    ingestaMedia = media(kcal de días con registro y phase == Normal)
    TDEE         = ingestaMedia + deficitDía

  La cifra que MANDA es el déficit desde el peso; las kcal del reloj y las
  sesiones son solo contexto.
*/
import { daysBetween } from "@/lib/dates";
import { eligibleWeightSeries, ma7At } from "./ma7";
import type { AnalyticsRecord } from "./types";

/** 7.700 kcal ≈ 1 kg de grasa corporal (constante del PoC). */
export const KCAL_PER_KG = 7700;
export const MIN_WEIGHINS = 8;
export const MIN_SPAN_DAYS = 7;

export interface DeficitResult {
  /** ¿Hay datos suficientes (≥8 pesajes en ≥7 días)? */
  enough: boolean;
  weighins: number;
  spanDays: number;
  /** kg/semana (pendiente de la ma7). Negativo = pierde peso. */
  kgPerWeek: number | null;
  /** Déficit kcal/día (positivo = déficit real). */
  deficitKcal: number | null;
  /** Ingesta media de días con registro en fase Normal (kcal). */
  intakeMean: number | null;
  /** TDEE real (kcal). */
  tdee: number | null;
}

function notEnough(weighins: number, spanDays: number): DeficitResult {
  return {
    enough: false,
    weighins,
    spanDays,
    kgPerWeek: null,
    deficitKcal: null,
    intakeMean: null,
    tdee: null,
  };
}

export function computeDeficit(records: readonly AnalyticsRecord[]): DeficitResult {
  const series = eligibleWeightSeries(records);
  const weighins = series.length;
  if (weighins < MIN_WEIGHINS) return notEnough(weighins, 0);

  const first = series[0]!.date;
  const last = series[series.length - 1]!.date;
  const spanDays = daysBetween(first, last);
  if (spanDays < MIN_SPAN_DAYS) return notEnough(weighins, spanDays);

  const ma7First = ma7At(series, first) as number;
  const ma7Last = ma7At(series, last) as number;
  const kgPerWeek = ((ma7Last - ma7First) / spanDays) * 7;
  const deficitKcal = Math.round((-kgPerWeek * KCAL_PER_KG) / 7);

  const normalLogged = records.filter((r) => r.logged && r.phase == null);
  const rawIntake =
    normalLogged.length > 0
      ? normalLogged.reduce((acc, r) => acc + r.kcal, 0) / normalLogged.length
      : null;
  const tdee = rawIntake != null ? Math.round(rawIntake + deficitKcal) : null;

  return {
    enough: true,
    weighins,
    spanDays,
    kgPerWeek,
    deficitKcal,
    intakeMean: rawIntake != null ? Math.round(rawIntake) : null,
    tdee,
  };
}
