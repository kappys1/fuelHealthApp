import { describe, expect, it } from "vitest";
import { shiftDayKey } from "@/lib/dates";
import { computeDeficit } from "./deficit";
import { computeTrajectory } from "./trajectory";
import type { AnalyticsRecord } from "./types";

const T = { kcal: 1800, prot: 110 };
function rec(date: string, weight: number | null): AnalyticsRecord {
  return {
    date,
    weight,
    phase: null,
    logged: true,
    kcal: 1800,
    prot: 110,
    target: T,
    flexibleMeals: { planned: [], real: [] },
  };
}

/** Serie diaria continua desde `from` durante `days` días, bajando `slope` kg/día. */
function series(from: string, days: number, start: number, slope: number) {
  return Array.from({ length: days }, (_, i) => rec(shiftDayKey(from, i), start - slope * i));
}

const TODAY = "2026-08-03";

describe("F22 · trayectoria mensual (AC4b)", () => {
  // 01-may → 03-ago, pesaje diario.
  const history = series("2026-05-01", 95, 95, 0.03);

  it("muestra los 3 últimos meses CERRADOS, nunca el mes en curso", () => {
    const { months, enough } = computeTrajectory(history, TODAY);
    expect(enough).toBe(true);
    expect(months.map((m) => m.monthKey)).toEqual(["2026-07", "2026-06", "2026-05"]);
    expect(months.map((m) => m.label)).toEqual(["jul", "jun", "may"]);
    expect(months.some((m) => m.monthKey === "2026-08")).toBe(false);
  });

  it("usa exactamente la misma metodología que el titular", () => {
    const { months } = computeTrajectory(history, TODAY);
    const julio = computeDeficit(history, { from: "2026-07-01", to: "2026-07-31" });
    expect(months[0]!.kgPerWeek).toBeCloseTo(julio.kgPerWeek ?? 0, 10);
    expect(months[0]!.deficitKcal).toBe(julio.deficitKcal);
    // 0,03 kg/día ≈ −0,21 kg/semana en un mes con historia previa (jul y jun).
    expect(months[0]!.kgPerWeek).toBeCloseTo(-0.21, 2);
    expect(months[1]!.kgPerWeek).toBeCloseTo(-0.21, 2);
    // Mayo es el primer mes del histórico: su borde izquierdo no tiene 6 días
    // previos que promediar, así que sale algo más plano. Es honesto —el dato no
    // existe— y por eso el gate se aplica por mes en vez de estimar.
    expect(months[2]!.kgPerWeek).toBeCloseTo(-0.189, 3);
  });

  it("cada pesaje pertenece a un solo mes: los bloques no se solapan", () => {
    const { months } = computeTrajectory(history, TODAY);
    expect(months.map((m) => m.weighins)).toEqual([31, 30, 31]);
    expect(months.reduce((sum, m) => sum + m.weighins, 0)).toBe(92);
  });

  it("a caballo entre dos meses: el 30-jun cuenta en junio, no en julio", () => {
    // Julio arranca el 01-jul; junio termina el 30-jun con un pesaje desviado.
    const spiked = history.map((record) =>
      record.date === "2026-06-30" ? rec(record.date, (record.weight as number) + 1.5) : record,
    );
    const { months } = computeTrajectory(spiked, TODAY);
    const [julio, junio] = months;
    // El pico mueve junio (es su último punto)...
    expect(junio!.kgPerWeek).not.toBeCloseTo(-0.21, 2);
    // ...y solo suaviza el borde de julio a través de la ma7, sin sumarse a su muestra.
    expect(julio!.weighins).toBe(31);
    expect(junio!.weighins).toBe(30);
  });

  it("el borde de cada mes lee los 6 días previos (misma corrección que el titular)", () => {
    const julio = { from: "2026-07-01", to: "2026-07-31" };
    const conJunio = computeTrajectory(history, TODAY).months[0]!;
    // Mismo mes, mismo gate, pero sin los 6 días de junio que suavizan el borde.
    const sinJunio = computeDeficit(
      history.filter((r) => r.date >= "2026-07-01"),
      julio,
    );
    expect(sinJunio.enough).toBe(true);
    expect(conJunio.kgPerWeek).not.toBeCloseTo(sinJunio.kgPerWeek ?? 0, 6);
  });
});

describe("F22 · gate por mes: «—», nunca estimación (AC4b)", () => {
  it("un mes que no llega a 8 pesajes sale «—» sin estimar", () => {
    // Junio con solo 4 pesajes; mayo y julio completos.
    const mayo = series("2026-05-01", 31, 95, 0.03);
    const junio = Array.from({ length: 30 }, (_, i) =>
      rec(shiftDayKey("2026-06-01", i), i % 8 === 0 ? 94 - i * 0.03 : null),
    );
    const julio = series("2026-07-01", 31, 93, 0.03);
    const { months, enough } = computeTrajectory([...mayo, ...junio, ...julio], TODAY);
    expect(enough).toBe(true); // jul y may siguen siendo válidos
    const jun = months.find((m) => m.monthKey === "2026-06")!;
    expect(jun.kgPerWeek).toBeNull();
    expect(jun.deficitKcal).toBeNull();
    expect(jun.weighins).toBeLessThan(8);
    expect(months.filter((m) => m.kgPerWeek != null)).toHaveLength(2);
  });

  it("un mes con 8 pesajes pero span <7 d también sale «—»", () => {
    const mayo = series("2026-05-01", 31, 95, 0.03);
    const julio = series("2026-07-01", 31, 93, 0.03);
    // 8 pesajes en junio, todos en 5 días.
    const junio = Array.from({ length: 8 }, (_, i) =>
      rec(shiftDayKey("2026-06-10", Math.floor(i / 2)), 94 - i * 0.01),
    );
    const { months } = computeTrajectory([...mayo, ...junio, ...julio], TODAY);
    expect(months.find((m) => m.monthKey === "2026-06")!.kgPerWeek).toBeNull();
  });

  it("con <2 meses válidos se omite la línea entera", () => {
    const soloJulio = series("2026-07-01", 31, 93, 0.03);
    const { months, enough } = computeTrajectory(soloJulio, TODAY);
    expect(enough).toBe(false);
    expect(months).toEqual([]);
  });

  it("cruza el cambio de año sin inventar meses", () => {
    const history = [
      ...series("2025-11-01", 30, 96, 0.03),
      ...series("2025-12-01", 31, 95, 0.03),
      ...series("2026-01-01", 20, 94, 0.03),
    ];
    const { months } = computeTrajectory(history, "2026-01-20");
    expect(months.map((m) => m.monthKey)).toEqual(["2025-12", "2025-11", "2025-10"]);
    expect(months.find((m) => m.monthKey === "2025-10")!.kgPerWeek).toBeNull();
  });
});
