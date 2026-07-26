import { describe, expect, it } from "vitest";
import { computeAdherence } from "./adherence";
import type { AnalyticsRecord } from "./types";

const T = { kcal: 1800, prot: 110 };
function rec(
  date: string,
  opts: Partial<AnalyticsRecord> & { logged: boolean },
): AnalyticsRecord {
  return {
    date,
    weight: null,
    phase: null,
    kcal: 0,
    prot: 0,
    target: T,
    flexibleMeals: { planned: [], real: [] },
    ...opts,
  };
}

describe("computeAdherence (03 §3 / F6.3)", () => {
  const today = "2026-07-14";
  const records: AnalyticsRecord[] = [
    rec("2026-06-28", { logged: true, kcal: 1800, prot: 110 }), // fuera de ventana
    rec("2026-07-05", { logged: true, kcal: 1800, prot: 110 }), // normal, en rango, prot ok
    rec("2026-07-09", { logged: false, weight: 91 }), // sin registro → no cuenta
    rec("2026-07-10", { logged: true, kcal: 1800, prot: 110 }), // normal ✓ ✓
    rec("2026-07-11", { logged: true, kcal: 2100, prot: 90 }), // normal, fuera de rango, prot baja
    rec("2026-07-12", { logged: true, kcal: 1850, prot: 100 }), // normal ✓ ✓
    rec("2026-07-13", { logged: true, kcal: 3000, prot: 150, phase: "carga" }), // no normal
  ];

  it("cuenta registro, filtra a Normal y aplica ±10% / prot 90%", () => {
    const a = computeAdherence(records, today);
    expect(a.windowDays).toBe(14);
    expect(a.n).toBe(5); // 07-05, 10, 11, 12, 13 (dentro y con registro)
    expect(a.kcalN).toBe(4); // sin el día de carga
    expect(a.proteinN).toBe(4);
    expect(a.enRango).toBe(3); // 07-05, 10, 12 (no 11)
    expect(a.protOk).toBe(3); // 07-05, 10, 12 (no 11: 90 < 99)
  });

  it("no juzga como adherencia un día anterior a la primera pauta", () => {
    const a = computeAdherence(
      [
        rec("2026-07-12", {
          logged: true,
          kcal: 0,
          prot: 0,
          target: { kcal: 0, prot: 0 },
        }),
        rec("2026-07-13", { logged: true, kcal: 1800, prot: 110 }),
      ],
      today,
    );

    expect(a.n).toBe(2);
    expect(a.kcalN).toBe(1);
    expect(a.proteinN).toBe(1);
    expect(a.enRango).toBe(1);
    expect(a.protOk).toBe(1);
  });

  it("separa kcal y proteína: flexible real sale solo del denominador de kcal", () => {
    const a = computeAdherence(
      [
        rec("2026-07-10", { logged: true, kcal: 1800, prot: 110 }),
        rec("2026-07-11", {
          logged: true,
          kcal: 2440,
          prot: 119,
          flexibleMeals: { planned: [], real: ["cena"] },
        }),
        rec("2026-07-12", {
          logged: true,
          kcal: 1600,
          prot: 80,
          flexibleMeals: { planned: [], real: ["comida", "cena"] },
        }),
        rec("2026-07-13", {
          logged: true,
          kcal: 1800,
          prot: 110,
          flexibleMeals: { planned: ["cena"], real: [] },
        }),
        rec("2026-07-14", {
          logged: true,
          kcal: 3000,
          prot: 180,
          phase: "carga",
          flexibleMeals: { planned: [], real: ["cena"] },
        }),
      ],
      today,
    );

    expect(a).toMatchObject({
      n: 5,
      kcalN: 2,
      proteinN: 4,
      enRango: 2,
      protOk: 3,
      flexibleN: 2,
      flexibleMoments: 3,
      specialN: 1,
    });
  });
});
