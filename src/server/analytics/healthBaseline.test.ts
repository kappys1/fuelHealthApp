import { describe, expect, it } from "vitest";
import {
  BASELINE_MIN_DAYS,
  type HealthDailyPoint,
  healthBaseline,
} from "./healthBaseline";

const P = (
  date: string,
  hrvMs: number | null = null,
  restingHr: number | null = null,
  sleepH: number | null = null,
  steps: number | null = null,
): HealthDailyPoint => ({ date, hrvMs, restingHr, sleepH, steps });

function stat(rows: ReturnType<typeof healthBaseline>, key: string) {
  return rows.find((r) => r.key === key)!;
}

describe("healthBaseline (media 30 d + delta, con huecos)", () => {
  const target = "2026-07-16";
  // 6 días anteriores dentro de la ventana [2026-06-16, 2026-07-15].
  const prior: HealthDailyPoint[] = [
    P("2026-07-15", 60, 40, 8, 9000),
    P("2026-07-14", 58, 40, 7, 8000),
    P("2026-07-13", 56, 40, 7, null),
    P("2026-07-12", 54, 40, 7, null),
    P("2026-07-11", 52, 40, 7, null),
    P("2026-07-10", 50, 40, 7, null),
  ];
  // hoy
  const today = P(target, 65, 38, 6, 12000);

  it("media 30 d excluye HOY y calcula el delta hoy − media", () => {
    const rows = healthBaseline([...prior, today], target);
    const hrv = stat(rows, "hrvMs");
    // media de 50,52,54,56,58,60 = 55 (NO incluye el 65 de hoy)
    expect(hrv.mean30).toBe(55);
    expect(hrv.today).toBe(65);
    expect(hrv.delta).toBe(10);
    expect(hrv.nDays).toBe(6);

    const rhr = stat(rows, "restingHr");
    expect(rhr.mean30).toBe(40);
    expect(rhr.delta).toBe(-2);

    const sleep = stat(rows, "sleepH");
    expect(sleep.mean30).toBeCloseTo(43 / 6, 6);
    expect(sleep.delta).toBeCloseTo(6 - 43 / 6, 6);
  });

  it("una métrica con menos de BASELINE_MIN_DAYS días → media y delta null", () => {
    const rows = healthBaseline([...prior, today], target);
    const steps = stat(rows, "steps");
    // solo 2 días con pasos en la ventana (< 5)
    expect(steps.nDays).toBe(2);
    expect(steps.mean30).toBeNull();
    expect(steps.delta).toBeNull();
    // pero el valor de hoy sí se conserva
    expect(steps.today).toBe(12000);
    expect(BASELINE_MIN_DAYS).toBe(5);
  });

  it("sin dato hoy → today y delta null, media conservada", () => {
    const rows = healthBaseline(prior, target); // sin punto de hoy
    const hrv = stat(rows, "hrvMs");
    expect(hrv.today).toBeNull();
    expect(hrv.mean30).toBe(55);
    expect(hrv.delta).toBeNull();
  });

  it("días fuera de la ventana de 30 d no cuentan", () => {
    const outside = P("2026-06-10", 999, 99, 99, 99999); // < 2026-06-16 (lo)
    const rows = healthBaseline([outside, ...prior, today], target);
    const hrv = stat(rows, "hrvMs");
    expect(hrv.nDays).toBe(6); // el outlier de fuera de rango se ignora
    expect(hrv.mean30).toBe(55);
  });

  it("serie vacía → todo null, nDays 0", () => {
    const rows = healthBaseline([], target);
    for (const r of rows) {
      expect(r.today).toBeNull();
      expect(r.mean30).toBeNull();
      expect(r.delta).toBeNull();
      expect(r.nDays).toBe(0);
    }
  });
});
