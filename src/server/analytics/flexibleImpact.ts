import { shiftDayKey } from "@/lib/dates";
import { KCAL_PER_KG } from "./deficit";
import type { DailyRecord } from "./types";

/**
 * 30 d, alineada con la ventana canónica de la cifra que manda (F22).
 *
 * Era 28. Se mueve para que el desdoble de ritmos CUADRE con el titular: si las dos
 * ventanas difieren, la fila «real ponderado» compara una media de 28 d contra un
 * TDEE de 30 d y la aritmética deja de cerrar. Precio conocido y aceptado: las
 * cifras del KPI existente cambian un poco sin que Alex haya hecho nada distinto
 * (spec 22 · riesgo 2; se documenta en el HowCalculated de la tarjeta).
 */
export const FLEXIBLE_IMPACT_WINDOW = 30;
export const MIN_FLEXIBLE_DAYS = 3;
export const MIN_REGULAR_DAYS = 7;

export interface FlexibleImpact {
  windowDays: number;
  flexibleDays: number;
  flexibleMoments: number;
  regularDays: number;
  flexibleMeanKcal: number | null;
  regularMeanKcal: number | null;
  flexibleMeanTargetPct: number | null;
  regularMeanTargetPct: number | null;
  differenceObservedKcal: number | null;
  differenceObservedPct: number | null;
  enoughForComparison: boolean;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Comparación descriptiva F/R de la ventana canónica. No excluye estas kcal de
 * ninguna otra fórmula: solo crea dos vistas observadas para conversar con el
 * nutricionista.
 */
export function computeFlexibleImpact(
  records: readonly DailyRecord[],
  today: string,
  windowDays: number = FLEXIBLE_IMPACT_WINDOW,
): FlexibleImpact {
  const from = shiftDayKey(today, -(windowDays - 1));
  const eligible = records.filter(
    (record) =>
      record.date >= from &&
      record.date <= today &&
      record.logged &&
      record.phase == null &&
      record.target.kcal > 0,
  );
  const flexible = eligible.filter(
    (record) => record.flexibleMeals.real.length > 0,
  );
  const regular = eligible.filter(
    (record) => record.flexibleMeals.real.length === 0,
  );
  const flexibleMeanKcal = mean(flexible.map((record) => record.kcal));
  const regularMeanKcal = mean(regular.map((record) => record.kcal));
  const flexibleMeanTargetPct = mean(
    flexible.map((record) => (record.kcal / record.target.kcal) * 100),
  );
  const regularMeanTargetPct = mean(
    regular.map((record) => (record.kcal / record.target.kcal) * 100),
  );
  const differenceObservedKcal =
    flexibleMeanKcal != null && regularMeanKcal != null
      ? flexibleMeanKcal - regularMeanKcal
      : null;
  const differenceObservedPct =
    differenceObservedKcal != null &&
    regularMeanKcal != null &&
    regularMeanKcal !== 0
      ? (differenceObservedKcal / regularMeanKcal) * 100
      : null;

  return {
    windowDays,
    flexibleDays: flexible.length,
    flexibleMoments: flexible.reduce(
      (sum, record) => sum + record.flexibleMeals.real.length,
      0,
    ),
    regularDays: regular.length,
    flexibleMeanKcal,
    regularMeanKcal,
    flexibleMeanTargetPct,
    regularMeanTargetPct,
    differenceObservedKcal,
    differenceObservedPct,
    enoughForComparison:
      flexible.length >= MIN_FLEXIBLE_DAYS &&
      regular.length >= MIN_REGULAR_DAYS,
  };
}

/*
  F22 · Fase 4 — desdoble de ritmos.

  La app tenía el TDEE y las dos medias (regular / flexible) y no hacía la resta, así
  que «¿cuánto me cuestan las salidas?» no tenía respuesta en pantalla. Esto la da
  traduciendo cada media al único idioma que manda (principio 1): kg/semana.

  Es CONTABILIDAD, no atribución: descompone el déficit medio ya medido en los dos
  grupos que lo componen. No dice que las flexibles «causen» nada, y la fila
  ponderada tiene que cuadrar con el titular por construcción — de ahí que la ventana
  sea la misma.
*/

export interface RhythmRow {
  days: number;
  meanKcal: number;
  /** media − TDEE. Negativo = déficit; positivo = superávit. */
  balanceKcal: number;
  /** El mismo balance en kg/semana (misma constante que el déficit real). */
  kgPerWeek: number;
}

export interface FlexibleRhythms {
  tdee: number;
  regular: RhythmRow;
  flexible: RhythmRow;
  /** Media ponderada por días: debe cuadrar con el déficit de la cifra que manda. */
  weighted: RhythmRow;
  /**
   * Fracción del ritmo de los días de pauta que NO llega al ritmo real (0–1, o >1 si
   * los flexibles se lo llevan entero). null cuando la proporción no significa nada:
   * los días de pauta no están en déficit, o los flexibles no restan.
   *
   * Es una razón entre dos ritmos MEDIDOS, no un contrafactual: no simula un Alex que
   * no existió, divide lo que pasó entre lo que pasó.
   */
  flexibleShare: number | null;
}

function shareLostToFlexible(regular: RhythmRow, weighted: RhythmRow): number | null {
  const regularDeficit = -regular.balanceKcal;
  const weightedDeficit = -weighted.balanceKcal;
  if (regularDeficit <= 0) return null; // los días de pauta no están en déficit
  const share = (regularDeficit - weightedDeficit) / regularDeficit;
  return share > 0 ? share : null; // los flexibles no restan ritmo
}

function rhythm(days: number, meanKcal: number, tdee: number): RhythmRow {
  const balanceKcal = meanKcal - tdee;
  return {
    days,
    meanKcal,
    balanceKcal,
    kgPerWeek: (balanceKcal * 7) / KCAL_PER_KG,
  };
}

/**
 * Traduce la comparación F/R a ritmos usando el TDEE de la cifra que manda. null si
 * falta muestra o TDEE: sin las dos cosas la descomposición no es contabilidad, es
 * invención.
 */
export function computeFlexibleRhythms(
  impact: FlexibleImpact,
  tdee: number | null,
): FlexibleRhythms | null {
  if (!impact.enoughForComparison || tdee == null) return null;
  if (impact.regularMeanKcal == null || impact.flexibleMeanKcal == null) return null;

  const totalDays = impact.regularDays + impact.flexibleDays;
  if (totalDays === 0) return null;
  const weightedMean =
    (impact.regularMeanKcal * impact.regularDays +
      impact.flexibleMeanKcal * impact.flexibleDays) /
    totalDays;

  const regular = rhythm(impact.regularDays, impact.regularMeanKcal, tdee);
  const weighted = rhythm(totalDays, weightedMean, tdee);
  return {
    tdee,
    regular,
    flexible: rhythm(impact.flexibleDays, impact.flexibleMeanKcal, tdee),
    weighted,
    flexibleShare: shareLostToFlexible(regular, weighted),
  };
}
