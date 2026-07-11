import { describe, expect, it } from "vitest";
import { computeDeficit, MIN_WEIGHINS } from "./deficit";
import type { AnalyticsRecord } from "./types";

const T = { kcal: 1800, prot: 110 };
function rec(
  date: string,
  weight: number | null,
  kcal: number | null = null,
): AnalyticsRecord {
  return {
    date,
    weight,
    phase: null,
    logged: kcal != null,
    kcal: kcal ?? 0,
    prot: 110,
    target: T,
  };
}

describe("computeDeficit (03 §3 / F6.2)", () => {
  // 8 días consecutivos (span 7), peso bajando 0,1 kg/día, ingesta 1.700 kcal.
  const days: AnalyticsRecord[] = [];
  for (let i = 0; i < 8; i++) {
    const date = `2026-03-${String(1 + i).padStart(2, "0")}`;
    days.push(rec(date, 92 - i * 0.1, 1700));
  }

  it("calcula kg/semana, déficit, ingesta media y TDEE", () => {
    const r = computeDeficit(days);
    expect(r.enough).toBe(true);
    expect(r.weighins).toBe(8);
    expect(r.spanDays).toBe(7);
    // ma7(primero)=92 ; ma7(último)=media(91.9..91.3)=91.6 ; Δ=-0.4 en 7 días.
    expect(r.kgPerWeek).toBeCloseTo(-0.4, 6);
    // deficit = round(0.4 × 7700 / 7) = 440
    expect(r.deficitKcal).toBe(440);
    expect(r.intakeMean).toBe(1700);
    expect(r.tdee).toBe(2140); // 1700 + 440
  });

  it("con <8 pesajes elegibles → no hay datos suficientes", () => {
    const few = days.slice(0, MIN_WEIGHINS - 1);
    const r = computeDeficit(few);
    expect(r.enough).toBe(false);
    expect(r.weighins).toBe(7);
    expect(r.deficitKcal).toBeNull();
    expect(r.tdee).toBeNull();
  });

  it("excluye días especiales de la pendiente y de la ingesta media", () => {
    // Un día de Carga con ingesta enorme NO debe inflar la ingesta media.
    const withCarga: AnalyticsRecord[] = [
      ...days,
      {
        date: "2026-03-09",
        weight: 95,
        phase: "carga",
        logged: true,
        kcal: 4000,
        prot: 200,
        target: T,
      },
    ];
    const r = computeDeficit(withCarga);
    expect(r.weighins).toBe(8); // el día de carga no cuenta como pesaje elegible
    expect(r.intakeMean).toBe(1700); // ni como ingesta
  });
});
