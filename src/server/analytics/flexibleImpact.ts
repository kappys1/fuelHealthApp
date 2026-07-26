import { shiftDayKey } from "@/lib/dates";
import type { DailyRecord } from "./types";

export const FLEXIBLE_IMPACT_WINDOW = 28;
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
 * Comparación descriptiva F/R de 28 días. No excluye estas kcal de ninguna otra
 * fórmula: solo crea dos vistas observadas para conversar con el nutricionista.
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
