import { describe, expect, it } from "vitest";
import type { DailyRecord } from "./types";
import { computeFlexibleImpact } from "./flexibleImpact";

function record(
  date: string,
  kcal: number,
  targetKcal: number,
  patch: Partial<DailyRecord> = {},
): DailyRecord {
  return {
    date,
    weight: null,
    phase: null,
    logged: true,
    kcal,
    prot: 110,
    carb: 200,
    fat: 60,
    target: { kcal: targetKcal, prot: 110 },
    flexibleMeals: { planned: [], real: [] },
    steps: null,
    activeKcal: null,
    basalKcal: null,
    hrvMs: null,
    sleepH: null,
    restingHr: null,
    bodyFatPct: null,
    waterL: null,
    sessionLabel: null,
    bloat: null,
    notes: null,
    ...patch,
  };
}

describe("computeFlexibleImpact · 28 días", () => {
  it("separa F/R, usa objetivos históricos y no mezcla fases especiales", () => {
    const records: DailyRecord[] = [
      record("2026-06-28", 9000, 1800, {
        flexibleMeals: { planned: [], real: ["cena"] },
      }), // fuera de ventana
      record("2026-07-01", 1980, 1800, {
        flexibleMeals: { planned: [], real: ["cena"] },
      }),
      record("2026-07-05", 2000, 2000, {
        flexibleMeals: { planned: [], real: ["comida", "cena"] },
      }),
      record("2026-07-10", 2100, 2000, {
        flexibleMeals: { planned: [], real: ["merienda"] },
      }),
      ...Array.from({ length: 7 }, (_, index) =>
        record(
          `2026-07-${String(12 + index).padStart(2, "0")}`,
          index < 4 ? 1800 : 2000,
          index < 4 ? 1800 : 2000,
        ),
      ),
      record("2026-07-20", 5000, 1800, {
        phase: "carga",
        flexibleMeals: { planned: [], real: ["cena"] },
      }),
      record("2026-07-21", 1800, 1800, {
        flexibleMeals: { planned: ["cena"], real: [] },
      }),
      record("2026-07-22", 0, 1800, { logged: false }),
      record("2026-07-23", 1800, 0),
    ];

    const result = computeFlexibleImpact(records, "2026-07-26");
    expect(result.flexibleDays).toBe(3);
    expect(result.flexibleMoments).toBe(4);
    expect(result.regularDays).toBe(8); // 7 base + prevista (sigue regular)
    expect(result.flexibleMeanKcal).toBeCloseTo((1980 + 2000 + 2100) / 3);
    expect(result.regularMeanKcal).toBe(1875);
    expect(result.flexibleMeanTargetPct).toBeCloseTo(105);
    expect(result.regularMeanTargetPct).toBe(100);
    expect(result.differenceObservedKcal).toBeCloseTo(151.6666667);
    expect(result.differenceObservedPct).toBeCloseTo(8.0888889);
    expect(result.enoughForComparison).toBe(true);
  });

  it("antes de 3 flexibles + 7 regulares conserva conteos sin habilitar comparación", () => {
    const result = computeFlexibleImpact(
      [
        record("2026-07-20", 2000, 1800, {
          flexibleMeals: { planned: [], real: ["cena"] },
        }),
        record("2026-07-21", 1800, 1800),
      ],
      "2026-07-26",
    );

    expect(result).toMatchObject({
      flexibleDays: 1,
      flexibleMoments: 1,
      regularDays: 1,
      enoughForComparison: false,
    });
  });
});
