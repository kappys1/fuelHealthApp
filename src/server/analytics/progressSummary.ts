import { shiftDayKey } from "@/lib/dates";
import { KCAL_TOLERANCE, PROT_MIN_RATIO } from "./adherence";
import type { DailyRecord } from "./types";

export type SummaryWindowDays = 7 | 30;

/** Tramo continuo con un mismo objetivo dentro de la ventana (F22 · AC6). */
export interface TargetSpan {
  kcal: number;
  prot: number;
  from: string;
  to: string;
}

/**
 * Objetivos vigentes DENTRO de la ventana, en orden. Con más de uno, la pantalla
 * puede declarar el cambio de pauta en vez de enseñar una media contra un objetivo
 * que no estuvo vigente todo el periodo. Cada día ya viaja con su objetivo histórico
 * (F1.5, `record.target`), así que aquí solo se agrupan tramos consecutivos iguales.
 */
export function targetSpans(records: readonly DailyRecord[]): TargetSpan[] {
  const spans: TargetSpan[] = [];
  for (const record of records) {
    if (record.target.kcal <= 0) continue;
    const last = spans[spans.length - 1];
    if (last && last.kcal === record.target.kcal && last.prot === record.target.prot) {
      last.to = record.date;
      continue;
    }
    spans.push({
      kcal: record.target.kcal,
      prot: record.target.prot,
      from: record.date,
      to: record.date,
    });
  }
  return spans;
}

export interface ProgressSummary {
  days: SummaryWindowDays;
  from: string;
  to: string;
  loggedDays: number;
  normalDays: number;
  kcalDays: number;
  proteinDays: number;
  averageKcal: number | null;
  averageProtein: number | null;
  averageSteps: number | null;
  contextDays: number;
  kcalInRange: number;
  proteinOnTarget: number;
  /** Objetivos vigentes en la ventana (F22 · AC6): >1 = hubo cambio de pauta. */
  targets: TargetSpan[];
}

/** Ventana natural inclusiva: 30 días significa hoy y los 29 anteriores. */
export function trailingRecords(
  records: readonly DailyRecord[],
  today: string,
  days: number,
): DailyRecord[] {
  const from = shiftDayKey(today, -(days - 1));
  return records.filter((record) => record.date >= from && record.date <= today);
}

export function computeProgressSummary(
  records: readonly DailyRecord[],
  today: string,
  days: SummaryWindowDays,
): ProgressSummary {
  const from = shiftDayKey(today, -(days - 1));
  const logged = trailingRecords(records, today, days).filter((record) => record.logged);
  const normalPhase = logged.filter((record) => record.phase == null);
  const normal = normalPhase.filter(
    (record) =>
      record.target.kcal > 0 && record.target.prot > 0,
  );
  const kcalEligible = normalPhase.filter(
    (record) =>
      record.target.kcal > 0 && record.flexibleMeals.real.length === 0,
  );
  const proteinEligible = normalPhase.filter(
    (record) => record.target.prot > 0,
  );
  const average = (values: number[]) =>
    values.length > 0
      ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
      : null;

  return {
    days,
    from,
    to: today,
    loggedDays: logged.length,
    normalDays: normal.length,
    kcalDays: kcalEligible.length,
    proteinDays: proteinEligible.length,
    averageKcal: average(logged.map((record) => record.kcal)),
    averageProtein: average(logged.map((record) => record.prot)),
    averageSteps: average(
      trailingRecords(records, today, days)
        .map((record) => record.steps)
        .filter((value): value is number => value != null),
    ),
    contextDays: logged.filter((record) => record.phase != null).length,
    kcalInRange: kcalEligible.filter(
      (record) =>
        record.target.kcal > 0 &&
        Math.abs(record.kcal - record.target.kcal) / record.target.kcal <=
          KCAL_TOLERANCE,
    ).length,
    proteinOnTarget: proteinEligible.filter(
      (record) =>
        record.target.prot > 0 && record.prot >= record.target.prot * PROT_MIN_RATIO,
    ).length,
    targets: targetSpans(trailingRecords(records, today, days)),
  };
}

/** Racha de días registrados hasta hoy; si hoy está vacío, se conserva desde ayer. */
export function computeLoggingStreak(
  records: readonly DailyRecord[],
  today: string,
): number {
  const logged = new Set(records.filter((record) => record.logged).map((record) => record.date));
  let cursor = logged.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (logged.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

export interface MacroEnergy {
  proteinKcal: number;
  carbKcal: number;
  fatKcal: number;
  macroKcal: number;
  recordedKcal: number;
  discrepancyKcal: number;
}

/** Convierte gramos a kcal antes de apilar; la discrepancia nunca se oculta en la barra. */
export function macroEnergy(record: Pick<DailyRecord, "prot" | "carb" | "fat" | "kcal">): MacroEnergy {
  const proteinKcal = Math.max(0, record.prot) * 4;
  const carbKcal = Math.max(0, record.carb) * 4;
  const fatKcal = Math.max(0, record.fat) * 9;
  const macroKcal = proteinKcal + carbKcal + fatKcal;
  const recordedKcal = record.kcal;
  return {
    proteinKcal,
    carbKcal,
    fatKcal,
    macroKcal,
    recordedKcal,
    discrepancyKcal: recordedKcal - macroKcal,
  };
}
