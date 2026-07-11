import { describe, expect, it } from "vitest";
import { parseHaeJson } from "./hae-json";

describe("parseHaeJson — formato Automations de HAE (03 §4.1)", () => {
  const payload = {
    data: {
      metrics: [
        {
          name: "active_energy",
          units: "kJ",
          data: [
            { date: "2026-07-07 00:00:00 +0200", qty: 3472.72 },
            { date: "2026-07-08 00:00:00 +0200", qty: 3472.72 },
          ],
        },
        {
          name: "step_count",
          units: "count",
          data: [{ date: "2026-07-07 00:00:00 +0200", qty: 13300 }],
        },
        {
          name: "dietary_water",
          units: "mL",
          data: [{ date: "2026-07-07 00:00:00 +0200", qty: 3000 }],
        },
        {
          name: "resting_heart_rate",
          units: "bpm",
          data: [{ date: "2026-07-07 00:00:00 +0200", qty: 47 }],
        },
      ],
      workouts: [
        {
          name: "Functional Strength Training",
          start: "2026-07-07 19:30:00 +0200",
          duration: 95,
          activeEnergyBurned: { qty: 2510, units: "kJ" },
          avgHeartRate: { qty: 148 },
        },
      ],
    },
  };

  const r = parseHaeJson(payload);

  it("mapea nombres de métrica y convierte unidades", () => {
    expect(r.hadKj).toBe(true);
    const d7 = r.days.find((d) => d.date === "2026-07-07");
    expect(d7?.activeKcal).toBe(830); // 3472.72 kJ → kcal
    expect(d7?.steps).toBe(13300);
    expect(d7?.waterL).toBeCloseTo(3, 6); // 3000 mL → 3 L
    expect(d7?.restingHr).toBe(47);
  });

  it("agrupa por fecha (2 días de energía activa)", () => {
    expect(r.days).toHaveLength(2);
    expect(r.days.map((d) => d.date)).toEqual(["2026-07-07", "2026-07-08"]);
  });

  it("parsea workouts con energía en kJ → kcal", () => {
    expect(r.workouts).toHaveLength(1);
    const w = r.workouts[0]!;
    expect(w.date).toBe("2026-07-07");
    expect(w.durationMin).toBe(95);
    expect(w.avgHr).toBe(148);
    expect(w.activeKcal).toBe(600); // 2510 kJ / 4,184 ≈ 600
  });

  it("acepta el envoltorio { metrics } sin `data` y descarta métricas desconocidas", () => {
    const r2 = parseHaeJson({
      metrics: [
        { name: "blood_glucose", units: "mg/dL", data: [{ date: "2026-01-01", qty: 90 }] },
        { name: "weight_body_mass", units: "kg", data: [{ date: "2026-01-01", qty: 91.5 }] },
      ],
    });
    expect(r2.fields).toEqual(["weight"]);
    expect(r2.days[0]!.weight).toBeCloseTo(91.5, 6);
  });

  it("no lanza con entrada basura", () => {
    expect(parseHaeJson(null)).toEqual({ days: [], workouts: [], fields: [], hadKj: false });
    expect(parseHaeJson({ data: { metrics: "nope" } }).days).toEqual([]);
  });

  it("NO confunde lean_body_mass con weight (colisión body_mass)", () => {
    const r = parseHaeJson({
      data: {
        metrics: [
          { name: "lean_body_mass", units: "kg", data: [{ date: "2026-07-11", qty: 62.2 }] },
          { name: "weight_body_mass", units: "kg", data: [{ date: "2026-07-11", qty: 92.1 }] },
        ],
      },
    });
    const d = r.days.find((x) => x.date === "2026-07-11");
    expect(d?.weight).toBeCloseTo(92.1, 6); // el peso real, no la masa magra
    expect(r.fields).toEqual(["weight"]); // lean_body_mass se descarta
  });

  it("agrega varias muestras del mismo día: suma acumulativas, promedia instantáneas", () => {
    // HAE manda muestras por hora; el total real del día es la SUMA (no la última).
    const r = parseHaeJson({
      data: {
        metrics: [
          {
            name: "step_count",
            units: "count",
            data: [
              { date: "2026-07-11 08:00:00 +0200", qty: 5000 },
              { date: "2026-07-11 14:00:00 +0200", qty: 6373 },
              { date: "2026-07-11 22:00:00 +0200", qty: 105 },
            ],
          },
          {
            name: "heart_rate_variability",
            units: "ms",
            data: [
              { date: "2026-07-11 03:00:00 +0200", qty: 60 },
              { date: "2026-07-11 04:00:00 +0200", qty: 80 },
            ],
          },
        ],
      },
    });
    const d = r.days.find((x) => x.date === "2026-07-11");
    expect(d?.steps).toBe(11478); // 5000 + 6373 + 105 (suma, no la última muestra)
    expect(d?.hrvMs).toBe(70); // media de 60 y 80
  });
});
