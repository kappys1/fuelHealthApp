import { describe, expect, it } from "vitest";
import type { DailyRecord } from "./types";
import { shiftDayKey } from "@/lib/dates";
import { computeCanonicalDeficit } from "./deficit";
import {
  computeFlexibleImpact,
  computeFlexibleRhythms,
  FLEXIBLE_IMPACT_WINDOW,
  type FlexibleImpact,
} from "./flexibleImpact";

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

describe("computeFlexibleImpact · ventana canónica", () => {
  it("la ventana está alineada con la cifra que manda (F22)", () => {
    expect(FLEXIBLE_IMPACT_WINDOW).toBe(30);
  });

  it("separa F/R, usa objetivos históricos y no mezcla fases especiales", () => {
    const records: DailyRecord[] = [
      record("2026-06-20", 9000, 1800, {
        flexibleMeals: { planned: [], real: ["cena"] },
      }), // fuera de ventana (30 d desde el 2026-07-26 → 2026-06-27)
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

/*
  F22 · AC8 — la fila «real ponderado» cuadra con la cifra que manda (±2 kcal/día).

  Fixture de las capturas del 3-ago: 22 días juzgados en la ventana canónica, 16 de
  pauta a 1.806 kcal y 6 flexibles a 2.442, TDEE real 2.200.
    (16×394 − 6×242) / 22 = 220,5 ≈ 220 kcal/día de déficit
  Esa cifra NO se recalcula aquí: sale de `computeCanonicalDeficit` sobre el mismo
  fixture, y el desdoble tiene que reproducirla.
*/
describe("F22 · desdoble de ritmos (AC8)", () => {
  const TODAY = "2026-08-03";
  const FROM = shiftDayKey(TODAY, -(FLEXIBLE_IMPACT_WINDOW - 1)); // 2026-07-05

  // 22 días registrados: los 6 últimos sábados/domingos como flexibles a 2.442.
  const FLEXIBLE_DATES = new Set([
    "2026-07-11",
    "2026-07-12",
    "2026-07-18",
    "2026-07-19",
    "2026-07-25",
    "2026-07-26",
  ]);

  /** Peso que produce exactamente −0,20 kg/semana de pendiente en la ma7. */
  const weightAt = (index: number) => 92 - (0.2 / 7) * index;

  // 6 días ANTES de la ventana, solo con peso: alimentan la ma7 del borde izquierdo
  // (F22 · AC1) y no entran ni en la muestra ni en la ingesta media.
  const priorHistory: DailyRecord[] = Array.from({ length: 6 }, (_, i) => {
    const index = i - 6;
    return record(shiftDayKey(FROM, index), 0, 1800, {
      logged: false,
      kcal: 0,
      weight: weightAt(index),
    });
  });

  const windowRecords: DailyRecord[] = Array.from({ length: 30 }, (_, index) => {
    const date = shiftDayKey(FROM, index);
    const flexible = FLEXIBLE_DATES.has(date);
    // 22 días con registro (los 8 últimos sin registrar): 16 R + 6 F.
    const logged = index < 22 || flexible;
    return record(date, flexible ? 2442 : 1806, 1800, {
      logged,
      kcal: logged ? (flexible ? 2442 : 1806) : 0,
      weight: weightAt(index),
      flexibleMeals: flexible
        ? { planned: [], real: ["cena"] }
        : { planned: [], real: [] },
    });
  });
  const records = [...priorHistory, ...windowRecords];

  const impact = computeFlexibleImpact(records, TODAY);
  const deficit = computeCanonicalDeficit(records, TODAY);

  it("el fixture reproduce el caso real: 16 de pauta y 6 flexibles", () => {
    expect(impact.regularDays).toBe(16);
    expect(impact.flexibleDays).toBe(6);
    expect(impact.regularMeanKcal).toBe(1806);
    expect(impact.flexibleMeanKcal).toBe(2442);
    expect(deficit.enough).toBe(true);
    expect(deficit.kgPerWeek).toBeCloseTo(-0.2, 6);
  });

  it("traduce cada media a su ritmo en kg/semana", () => {
    const rhythms = computeFlexibleRhythms(impact, deficit.tdee)!;
    expect(rhythms.tdee).toBe(deficit.tdee);
    expect(rhythms.regular.balanceKcal).toBeCloseTo(1806 - rhythms.tdee, 6);
    expect(rhythms.regular.kgPerWeek).toBeLessThan(0); // días de pauta = déficit
    expect(rhythms.flexible.kgPerWeek).toBeGreaterThan(0); // flexibles = superávit
    expect(rhythms.regular.days).toBe(16);
    expect(rhythms.flexible.days).toBe(6);
    expect(rhythms.weighted.days).toBe(22);
  });

  it("la fila ponderada cuadra con el déficit de la cifra que manda (±2 kcal/día)", () => {
    const rhythms = computeFlexibleRhythms(impact, deficit.tdee)!;
    // balance ponderado (negativo) == −déficit (positivo)
    expect(Math.abs(rhythms.weighted.balanceKcal + (deficit.deficitKcal ?? 0))).toBeLessThanOrEqual(2);
    expect(rhythms.weighted.kgPerWeek).toBeCloseTo(deficit.kgPerWeek ?? 0, 2);
  });

  it("la aritmética del desdoble reconstruye el déficit medio", () => {
    const rhythms = computeFlexibleRhythms(impact, deficit.tdee)!;
    const reconstructed =
      (rhythms.regular.balanceKcal * 16 + rhythms.flexible.balanceKcal * 6) / 22;
    expect(reconstructed).toBeCloseTo(rhythms.weighted.balanceKcal, 6);
  });

  it("sin muestra suficiente o sin TDEE no inventa el desdoble", () => {
    expect(computeFlexibleRhythms(impact, null)).toBeNull();
    const thin: FlexibleImpact = { ...impact, enoughForComparison: false };
    expect(computeFlexibleRhythms(thin, 2200)).toBeNull();
  });
});

/*
  F22 · AC12 — la razón entre los dos ritmos MEDIDOS (no un contrafactual: no simula
  un Alex que no existió, divide lo que pasó entre lo que pasó).
*/
describe("F22 · cuánto ritmo se llevan los flexibles (AC12)", () => {
  const impact = (patch: Partial<FlexibleImpact> = {}): FlexibleImpact => ({
    windowDays: 30,
    flexibleDays: 6,
    flexibleMoments: 8,
    regularDays: 17,
    flexibleMeanKcal: 2442,
    regularMeanKcal: 1798,
    flexibleMeanTargetPct: 136,
    regularMeanTargetPct: 100,
    differenceObservedKcal: 644,
    differenceObservedPct: 36,
    enoughForComparison: true,
    ...patch,
  });

  it("calcula la fracción del ritmo de pauta que no llega al ritmo real", () => {
    // pauta 1798 − 2227 = −429 · ponderado (17×1798 + 6×2442)/23 − 2227 = −261
    const r = computeFlexibleRhythms(impact(), 2227)!;
    expect(r.regular.kgPerWeek).toBeCloseTo(-0.39, 2);
    expect(r.weighted.kgPerWeek).toBeCloseTo(-0.24, 2);
    expect(r.flexibleShare).toBeCloseTo((429 - 261) / 429, 1);
    expect(Math.round(r.flexibleShare! * 100)).toBeGreaterThan(30);
    expect(Math.round(r.flexibleShare! * 100)).toBeLessThan(50);
  });

  it("sin flexibles que resten no hay proporción que enseñar", () => {
    // Días flexibles POR DEBAJO del gasto: no se llevan ritmo.
    const r = computeFlexibleRhythms(impact({ flexibleMeanKcal: 1700 }), 2227)!;
    expect(r.flexibleShare).toBeNull();
  });

  it("si los días de pauta no están en déficit, la proporción no significa nada", () => {
    const r = computeFlexibleRhythms(impact({ regularMeanKcal: 2400 }), 2227)!;
    expect(r.regular.balanceKcal).toBeGreaterThan(0);
    expect(r.flexibleShare).toBeNull();
  });

  it("si los flexibles se llevan el ritmo entero, la fracción pasa de 1", () => {
    // Ponderado en superávit pese a que los días de pauta están en déficit.
    const r = computeFlexibleRhythms(
      impact({ flexibleDays: 14, regularDays: 9, flexibleMeanKcal: 3200 }),
      2227,
    )!;
    expect(r.weighted.balanceKcal).toBeGreaterThan(0);
    expect(r.flexibleShare).toBeGreaterThan(1);
  });
});
