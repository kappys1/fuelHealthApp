import { describe, expect, it } from "vitest";
import { shiftDayKey } from "@/lib/dates";
import {
  CANONICAL_WINDOW_DAYS,
  computeCanonicalDeficit,
  computeDeficit,
  MIN_WEIGHINS,
  trailingWindow,
  WIDENED_WINDOW_DAYS,
} from "./deficit";
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
    flexibleMeals: { planned: [], real: [] },
  };
}

describe("computeDeficit (03 §3 / F6.2)", () => {
  // 8 días consecutivos (span 7), peso bajando 0,1 kg/día, ingesta 1.700 kcal.
  const days: AnalyticsRecord[] = [];
  for (let i = 0; i < 8; i++) {
    const date = `2026-03-${String(1 + i).padStart(2, "0")}`;
    days.push(rec(date, 92 - i * 0.1, 1700));
  }
  const marzo = { from: "2026-03-01", to: "2026-03-08" };

  it("calcula kg/semana, déficit, ingesta media y TDEE", () => {
    const r = computeDeficit(days, marzo);
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

  it("expone la ventana usada para que UI e IA la declaren sin recalcular", () => {
    const r = computeDeficit(days, marzo);
    expect(r.windowFrom).toBe("2026-03-01");
    expect(r.windowTo).toBe("2026-03-08");
    expect(r.windowDays).toBe(8);
    expect(r.widened).toBe(false);
  });

  it("con <8 pesajes elegibles → no hay datos suficientes", () => {
    const few = days.slice(0, MIN_WEIGHINS - 1);
    const r = computeDeficit(few, marzo);
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
        flexibleMeals: { planned: [], real: [] },
      },
    ];
    const r = computeDeficit(withCarga, { from: "2026-03-01", to: "2026-03-09" });
    expect(r.weighins).toBe(8); // el día de carga no cuenta como pesaje elegible
    expect(r.intakeMean).toBe(1700); // ni como ingesta
  });

  it("conserva el 100 % de las kcal flexibles en intakeMean/TDEE", () => {
    const flexible: AnalyticsRecord[] = days.map((day, index) =>
      index === 7
        ? {
            ...day,
            kcal: 2440,
            flexibleMeals: { planned: [], real: ["cena"] },
          }
        : day,
    );
    const result = computeDeficit(flexible, marzo);
    expect(result.intakeMean).toBe(1793); // (7×1700 + 2440) / 8
    expect(result.tdee).toBe(2233);
  });

  it("solo promedia la ingesta de la ventana, no la del histórico entero", () => {
    // Mes anterior con ingesta muy distinta: no debe contaminar la cifra de marzo.
    const febrero = Array.from({ length: 10 }, (_, i) =>
      rec(`2026-02-${String(10 + i).padStart(2, "0")}`, 93 - i * 0.05, 2600),
    );
    const r = computeDeficit([...febrero, ...days], marzo);
    expect(r.intakeMean).toBe(1700);
  });
});

/*
  F22 · AC1 — borde izquierdo de la ma7.

  Ventana canónica 05-jul → 03-ago sobre un histórico que empieza el 25-jun. El peso
  baja 0,05 kg/día y el pesaje del borde (05-jul) está desviado +0,5 kg.

  Antes: la serie llegaba recortada a la ventana, así que ma7(borde) = ese único peso
  crudo (92,0) y la desviación entraba entera en la pendiente.
  Ahora: ma7(borde) promedia los 7 días reales [29-jun … 05-jul] = 91,72.
*/
describe("F22 · computeDeficit ve los 6 días previos al borde (AC1)", () => {
  const START = "2026-06-25";
  const history: AnalyticsRecord[] = [];
  for (let i = 0; i < 40; i++) {
    const date = shiftDayKey(START, i);
    const spike = date === "2026-07-05" ? 0.5 : 0;
    history.push(rec(date, 92 - i * 0.05 + spike, 1800));
  }
  const window = { from: "2026-07-05", to: "2026-08-03" };

  it("el borde deja de ser un peso crudo de una sola muestra", () => {
    const r = computeDeficit(history, window);
    expect(r.enough).toBe(true);
    expect(r.weighins).toBe(30); // 30 pesajes DENTRO de la ventana
    expect(r.spanDays).toBe(29);
    // ma7(05-jul) = media(29-jun…05-jul) = 91,7214 ; ma7(03-ago) = 90,2
    expect(r.kgPerWeek).toBeCloseTo(-0.3672, 3);
  });

  it("difiere de la ma7 degenerada del recorte (el bug que corrige)", () => {
    const fixed = computeDeficit(history, window);
    // Simula el comportamiento anterior: la función solo veía la ventana.
    const clipped = history.filter(
      (r) => r.date >= window.from && r.date <= window.to,
    );
    const buggy = computeDeficit(clipped, window);
    expect(buggy.kgPerWeek).toBeCloseTo(-0.4345, 3);
    // ~0,067 kg/semana ≈ 74 kcal/día de TDEE: error del tamaño de la señal.
    expect(Math.abs((fixed.kgPerWeek ?? 0) - (buggy.kgPerWeek ?? 0))).toBeGreaterThan(0.05);
    expect(Math.abs((fixed.deficitKcal ?? 0) - (buggy.deficitKcal ?? 0))).toBeGreaterThan(50);
  });

  it("el histórico previo al borde no cuenta como muestra de la ventana", () => {
    const r = computeDeficit(history, window);
    expect(r.windowFrom).toBe(window.from);
    expect(history[0]!.date).toBe(START);
    expect(r.weighins).toBeLessThan(history.length);
  });
});

/*
  F22 · AC2 — una sola cifra. Pantalla, Chat, Coach y Visita llaman todas a
  `computeCanonicalDeficit(records, today)`. Antes la pantalla recortaba al rango del
  selector (90 d por defecto) y las tres superficies de IA usaban el histórico
  completo: dos valores distintos el mismo día.
*/
describe("F22 · ventana canónica compartida (AC2, AC3)", () => {
  const today = "2026-08-03";
  const history: AnalyticsRecord[] = [];
  for (let i = 0; i < 120; i++) {
    const date = shiftDayKey("2026-04-06", i);
    history.push(rec(date, 95 - i * 0.03, 1800));
  }

  it("la cifra es la misma con histórico completo que con el recorte del selector", () => {
    const full = computeCanonicalDeficit(history, today); // Chat / Coach / Visita
    const rango90 = history.filter((r) => r.date >= "2026-05-06"); // pantalla en "90 d"
    const rango14 = history.filter((r) => r.date >= "2026-07-21"); // pantalla en "14 d"
    expect(computeCanonicalDeficit(rango90, today).kgPerWeek).toBeCloseTo(
      full.kgPerWeek ?? 0,
      6,
    );
    // 14 d no llega a la muestra de la ventana canónica por sí solo, pero la cifra
    // no la decide el selector: la decide la ventana canónica sobre el histórico.
    expect(computeCanonicalDeficit(rango14, today).windowDays).toBe(
      CANONICAL_WINDOW_DAYS,
    );
    expect(full.windowDays).toBe(CANONICAL_WINDOW_DAYS);
    expect(full.widened).toBe(false);
  });

  it("la ventana canónica son 30 días terminados hoy", () => {
    const full = computeCanonicalDeficit(history, today);
    expect(full.windowFrom).toBe("2026-07-05");
    expect(full.windowTo).toBe(today);
    expect(full).toEqual(computeDeficit(history, trailingWindow(today, 30)));
  });
});

/*
  F22 · AC4 — fallback declarado. <8 pesajes o <7 d de span en 30 d → 90 d + aviso.
*/
describe("F22 · fallback a 90 d declarado (AC4)", () => {
  const today = "2026-08-03";

  it("amplía a 90 d y lo marca cuando la canónica no reúne muestra", () => {
    // 5 pesajes en los últimos 30 d; 12 en los 90 d.
    const sparse: AnalyticsRecord[] = [];
    for (let i = 0; i < 90; i++) {
      const date = shiftDayKey("2026-05-06", i);
      const inLast30 = date >= "2026-07-05";
      const weighed = inLast30 ? i % 6 === 0 : i % 7 === 0;
      sparse.push(rec(date, weighed ? 92 - i * 0.02 : null, 1800));
    }
    const canonical = computeDeficit(sparse, trailingWindow(today, 30));
    expect(canonical.enough).toBe(false);
    expect(canonical.weighins).toBeLessThan(MIN_WEIGHINS);

    const result = computeCanonicalDeficit(sparse, today);
    expect(result.enough).toBe(true);
    expect(result.widened).toBe(true);
    expect(result.windowDays).toBe(WIDENED_WINDOW_DAYS);
    expect(result.weighins).toBeGreaterThanOrEqual(MIN_WEIGHINS);
  });

  it("sin muestra ni en 90 d conserva el estado insuficiente y la ventana ampliada", () => {
    const tiny = [
      rec("2026-08-01", 92, 1800),
      rec("2026-08-02", 91.9, 1800),
      rec("2026-08-03", 91.8, 1800),
    ];
    const result = computeCanonicalDeficit(tiny, today);
    expect(result.enough).toBe(false);
    expect(result.widened).toBe(true);
    expect(result.windowDays).toBe(WIDENED_WINDOW_DAYS);
    expect(result.kgPerWeek).toBeNull();
  });
});
