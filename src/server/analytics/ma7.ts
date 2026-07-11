/*
  Media móvil de 7 días del peso (03-DATOS §3 / F6.1) — función PURA.

  ma7(d) = media de los pesos disponibles en la ventana [d−6, d] (solo días con
  peso). MEJORA vs PoC: se EXCLUYEN de la serie los pesos de días en fase especial
  (≠ Normal) y los de los 2 días siguientes a una fase `competicion` (rebote de
  glucógeno, distorsiona ~1-1,5 kg durante días).
*/
import { shiftDayKey } from "@/lib/dates";
import type { AnalyticsRecord } from "./types";

export interface WeightPoint {
  date: string;
  weight: number;
}

/**
 * Serie de pesos ELEGIBLES para la ma7 (ordenada asc por fecha): días con peso,
 * en fase Normal, y que no caen en los 2 días posteriores a una competición.
 */
export function eligibleWeightSeries(
  records: readonly AnalyticsRecord[],
): WeightPoint[] {
  const compDates = new Set(
    records.filter((r) => r.phase === "competicion").map((r) => r.date),
  );
  const isPostCompetition = (date: string): boolean =>
    compDates.has(shiftDayKey(date, -1)) || compDates.has(shiftDayKey(date, -2));

  return records
    .filter(
      (r) =>
        r.weight != null && r.phase == null && !isPostCompetition(r.date),
    )
    .map((r) => ({ date: r.date, weight: r.weight as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** ma7 en una fecha concreta sobre una serie ya elegible. null si no hay pesos en la ventana. */
export function ma7At(
  series: readonly WeightPoint[],
  date: string,
): number | null {
  const lo = shiftDayKey(date, -6);
  const inWindow = series.filter((p) => p.date >= lo && p.date <= date);
  if (inWindow.length === 0) return null;
  return inWindow.reduce((acc, p) => acc + p.weight, 0) / inWindow.length;
}

export interface Ma7Point {
  date: string;
  ma7: number;
}

/** Serie ma7 para graficar: un punto por cada fecha con peso elegible. */
export function ma7Series(records: readonly AnalyticsRecord[]): Ma7Point[] {
  const series = eligibleWeightSeries(records);
  return series.map((p) => ({
    date: p.date,
    // Siempre existe (la propia fecha está en su ventana).
    ma7: ma7At(series, p.date) as number,
  }));
}
