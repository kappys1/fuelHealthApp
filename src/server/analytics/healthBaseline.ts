/*
  Baseline personal (Restyle v2 · F1) — función PURA.

  Para cada métrica de salud del reloj (HRV, FC en reposo, sueño, pasos) calcula:
    - el valor de HOY,
    - la media de los ~30 días ANTERIORES (ventana [target−30, target−1], solo días
      con dato), y
    - el delta hoy − media30.

  Fuente: tabla `health_metrics` (Apple Health / HAE, DECISIONS #104/#107). NO inventa
  nada: si una métrica no tiene dato hoy → `today = null`; si la ventana tiene menos de
  BASELINE_MIN_DAYS días con dato → `mean30 = null` (necesita más historia); el delta
  solo existe si ambos existen. El mockup pinta series perfectas; los datos reales tienen
  huecos (días sin reloj) y por eso todo campo es opcional.

  El juez del gasto/déficit sigue siendo la báscula (principio 1); esto es CONTEXTO de
  cómo está el cuerpo hoy respecto a su norma reciente, no un veredicto.
*/
import { shiftDayKey } from "@/lib/dates";

export type HealthMetricKey = "hrvMs" | "restingHr" | "sleepH" | "steps";

export interface HealthDailyPoint {
  date: string;
  hrvMs: number | null;
  restingHr: number | null;
  sleepH: number | null;
  steps: number | null;
}

/** Mínimo de días con dato en la ventana para fiarse de la media (si no, `mean30=null`). */
export const BASELINE_MIN_DAYS = 5;

/** Tamaño de la ventana de baseline en días (los N días ANTERIORES a hoy). */
export const BASELINE_WINDOW_DAYS = 30;

export type BetterWhen = "higher" | "lower" | "neutral";

/** Configuración de presentación por métrica (constante, no cálculo). */
export const BASELINE_METRICS: ReadonlyArray<{
  key: HealthMetricKey;
  label: string;
  unit: string;
  decimals: number;
  betterWhen: BetterWhen;
}> = [
  { key: "hrvMs", label: "HRV", unit: "ms", decimals: 0, betterWhen: "higher" },
  { key: "restingHr", label: "FC reposo", unit: "ppm", decimals: 0, betterWhen: "lower" },
  { key: "sleepH", label: "Sueño", unit: "h", decimals: 1, betterWhen: "higher" },
  { key: "steps", label: "Pasos", unit: "", decimals: 0, betterWhen: "neutral" },
];

export interface BaselineStat {
  key: HealthMetricKey;
  /** Valor de la métrica hoy (null si no hay dato hoy). */
  today: number | null;
  /** Media de la ventana anterior (null si < BASELINE_MIN_DAYS días con dato). */
  mean30: number | null;
  /** hoy − media30 (null si falta alguno de los dos). */
  delta: number | null;
  /** Nº de días con dato en la ventana anterior (excluye hoy). */
  nDays: number;
}

function meanOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calcula el baseline de todas las métricas para `targetDate`.
 * `series` debe contener (al menos) los días de la ventana [targetDate−30, targetDate];
 * días extra o desordenados son inofensivos (se filtra por rango y clave de día).
 */
export function healthBaseline(
  series: readonly HealthDailyPoint[],
  targetDate: string,
): BaselineStat[] {
  const lo = shiftDayKey(targetDate, -BASELINE_WINDOW_DAYS);
  const hi = shiftDayKey(targetDate, -1);

  const todayPoint = series.find((p) => p.date === targetDate) ?? null;
  const window = series.filter((p) => p.date >= lo && p.date <= hi);

  return BASELINE_METRICS.map(({ key }): BaselineStat => {
    const today = todayPoint ? todayPoint[key] : null;
    const vals = window
      .map((p) => p[key])
      .filter((v): v is number => v != null);
    const nDays = vals.length;
    const mean30 = nDays >= BASELINE_MIN_DAYS ? meanOf(vals) : null;
    const delta = today != null && mean30 != null ? today - mean30 : null;
    return { key, today, mean30, delta, nDays };
  });
}
