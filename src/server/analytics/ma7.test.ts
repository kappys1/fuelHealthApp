import { describe, expect, it } from "vitest";
import { eligibleWeightSeries, ma7At, ma7Series } from "./ma7";
import type { AnalyticsRecord } from "./types";

const T = { kcal: 1800, prot: 110 };
function rec(
  date: string,
  weight: number | null,
  phase: AnalyticsRecord["phase"] = null,
): AnalyticsRecord {
  return { date, weight, phase, logged: false, kcal: 0, prot: 0, target: T };
}

describe("eligibleWeightSeries — exclusiones (03 §3)", () => {
  const records: AnalyticsRecord[] = [
    rec("2026-06-01", 92), // normal → incluido
    rec("2026-06-02", 91.8, "carga"), // fase especial → excluido
    rec("2026-06-03", 91.5, "competicion"), // fase especial → excluido
    rec("2026-06-04", 93), // 1 día tras competición → excluido
    rec("2026-06-05", 92.5), // 2 días tras competición → excluido
    rec("2026-06-06", 91), // 3 días tras → incluido
    rec("2026-06-07", null), // sin peso → excluido
  ];

  it("excluye fases especiales y los 2 días post-competición", () => {
    const s = eligibleWeightSeries(records);
    expect(s.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-06"]);
    expect(s.map((p) => p.weight)).toEqual([92, 91]);
  });

  it("ma7At promedia solo lo elegible dentro de la ventana [d-6, d]", () => {
    const s = eligibleWeightSeries(records);
    expect(ma7At(s, "2026-06-01")).toBe(92); // solo el propio día
    expect(ma7At(s, "2026-06-06")).toBe(91.5); // (92 + 91) / 2
    expect(ma7At(s, "2026-05-01")).toBeNull(); // ventana vacía
  });
});

describe("ma7 — media de ventana", () => {
  const records: AnalyticsRecord[] = [
    rec("2026-01-01", 90),
    rec("2026-01-02", 90),
    rec("2026-01-03", 90),
    rec("2026-01-04", 90),
    rec("2026-01-05", 90),
    rec("2026-01-06", 90),
    rec("2026-01-07", 97),
  ];

  it("ma7 al día 7 = (90×6 + 97) / 7 = 91", () => {
    const s = eligibleWeightSeries(records);
    expect(ma7At(s, "2026-01-07")).toBeCloseTo(91, 10);
  });

  it("ma7Series da un punto por fecha con peso elegible", () => {
    expect(ma7Series(records)).toHaveLength(7);
  });
});
