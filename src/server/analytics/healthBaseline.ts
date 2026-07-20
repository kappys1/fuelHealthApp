export const BASELINE_METRICS = [
  "hrvMs",
  "restingHr",
  "sleepH",
  "steps",
] as const;

export type BaselineMetricKey = (typeof BASELINE_METRICS)[number];

export interface BaselineHealthRow {
  hrvMs: number | null;
  restingHr: number | null;
  sleepH: number | null;
  steps: number | null;
}

export interface BaselineMetric {
  /** Valor crudo del día seleccionado. Nunca se reemplaza por una estimación. */
  current: number | null;
  /** Media de los 30 días naturales anteriores con dato elegible. */
  average30d: number | null;
  /** current - average30d; null si falta cualquiera de los extremos. */
  delta: number | null;
  sampleCount: number;
}

export interface HealthBaseline {
  from: string;
  to: string;
  metrics: Record<BaselineMetricKey, BaselineMetric>;
}

function eligibleValues(
  rows: BaselineHealthRow[],
  key: BaselineMetricKey,
): number[] {
  return rows.flatMap((row) => {
    const value = row[key];
    if (value == null || !Number.isFinite(value)) return [];
    // Health puede importar noches sin lectura como 0. Se conserva como valor
    // crudo del día, pero no debe hundir artificialmente la media personal.
    if (key === "sleepH" && value <= 0) return [];
    return [value];
  });
}

export function buildHealthBaseline({
  current,
  history,
  from,
  to,
}: {
  current: BaselineHealthRow | null;
  history: BaselineHealthRow[];
  from: string;
  to: string;
}): HealthBaseline {
  const metrics = Object.fromEntries(
    BASELINE_METRICS.map((key) => {
      const values = eligibleValues(history, key);
      const average30d =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null;
      const currentValue = current?.[key] ?? null;

      return [
        key,
        {
          current: currentValue,
          average30d,
          delta:
            currentValue != null &&
            average30d != null &&
            !(key === "sleepH" && currentValue <= 0)
              ? currentValue - average30d
              : null,
          sampleCount: values.length,
        } satisfies BaselineMetric,
      ];
    }),
  ) as Record<BaselineMetricKey, BaselineMetric>;

  return { from, to, metrics };
}
