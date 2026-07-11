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
    expect(a.normalN).toBe(4); // sin el día de carga
    expect(a.enRango).toBe(3); // 07-05, 10, 12 (no 11)
    expect(a.protOk).toBe(3); // 07-05, 10, 12 (no 11: 90 < 99)
  });
});
