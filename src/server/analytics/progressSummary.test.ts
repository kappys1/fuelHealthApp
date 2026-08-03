import { describe, expect, it } from "vitest";
import {
  computeLoggingStreak,
  computeProgressSummary,
  macroEnergy,
  trailingRecords,
  targetSpans,
} from "./progressSummary";
import type { DailyRecord } from "./types";

const record = (
  date: string,
  patch: Partial<DailyRecord> = {},
): DailyRecord => ({
  date,
  weight: null,
  phase: null,
  logged: true,
  kcal: 1800,
  prot: 110,
  carb: 180,
  fat: 60,
  target: { kcal: 1800, prot: 110 },
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
  flexibleMeals: { planned: [], real: [] },
  ...patch,
});

describe("progress summary", () => {
  it("usa ventanas naturales inclusivas de 7 y 30 días", () => {
    const rows = [
      record("2026-06-20"),
      record("2026-06-21"),
      record("2026-07-14"),
      record("2026-07-20"),
    ];
    expect(trailingRecords(rows, "2026-07-20", 30).map((row) => row.date)).toEqual([
      "2026-06-21",
      "2026-07-14",
      "2026-07-20",
    ]);
    expect(trailingRecords(rows, "2026-07-20", 7).map((row) => row.date)).toEqual([
      "2026-07-14",
      "2026-07-20",
    ]);
  });

  it("resume solo días registrados y excluye fases de adherencia", () => {
    const summary = computeProgressSummary(
      [
        record("2026-07-18"),
        record("2026-07-19", { kcal: 2400, prot: 70 }),
        record("2026-07-20", { kcal: 3000, phase: "carga" }),
      ],
      "2026-07-20",
      7,
    );
    expect(summary.loggedDays).toBe(3);
    expect(summary.normalDays).toBe(2);
    expect(summary.kcalInRange).toBe(1);
    expect(summary.proteinOnTarget).toBe(1);
    expect(summary.averageKcal).toBe(2400);
    expect(summary.contextDays).toBe(1);
    expect(summary.averageSteps).toBeNull();
  });

  it("mantiene el consumo pero no juzga días que todavía no tenían pauta", () => {
    const summary = computeProgressSummary(
      [
        record("2026-07-19", {
          kcal: 1600,
          prot: 90,
          target: { kcal: 0, prot: 0 },
        }),
        record("2026-07-20"),
      ],
      "2026-07-20",
      7,
    );

    expect(summary.loggedDays).toBe(2);
    expect(summary.averageKcal).toBe(1700);
    expect(summary.normalDays).toBe(1);
    expect(summary.kcalInRange).toBe(1);
    expect(summary.proteinOnTarget).toBe(1);
  });

  it("el resumen conserva kcal medias pero separa denominadores flexibles", () => {
    const summary = computeProgressSummary(
      [
        record("2026-07-19"),
        record("2026-07-20", {
          kcal: 2440,
          prot: 119,
          flexibleMeals: { planned: [], real: ["cena"] },
        }),
      ],
      "2026-07-20",
      7,
    );
    expect(summary.averageKcal).toBe(2120);
    expect(summary.normalDays).toBe(2);
    expect(summary.kcalDays).toBe(1);
    expect(summary.proteinDays).toBe(2);
    expect(summary.kcalInRange).toBe(1);
    expect(summary.proteinOnTarget).toBe(2);
  });

  it("mantiene la racha desde ayer cuando hoy aún no tiene registro", () => {
    const rows = [record("2026-07-17"), record("2026-07-18"), record("2026-07-19")];
    expect(computeLoggingStreak(rows, "2026-07-20")).toBe(3);
    expect(computeLoggingStreak([...rows, record("2026-07-20")], "2026-07-20")).toBe(4);
  });

  it("apila energía de macros y conserva aparte la discrepancia", () => {
    expect(macroEnergy(record("2026-07-20", { kcal: 1900, prot: 100, carb: 200, fat: 60 }))).toEqual({
      proteinKcal: 400,
      carbKcal: 800,
      fatKcal: 540,
      macroKcal: 1740,
      recordedKcal: 1900,
      discrepancyKcal: 160,
    });
  });
});

/*
  F22 · AC6 — el Resumen declara el cambio de pauta cuando la ventana contiene más
  de un objetivo. Cada día ya lleva su objetivo histórico (F1.5): sin esto, la media
  de la ventana se compara contra un objetivo que no estuvo vigente todo el periodo.
*/
describe("F22 · objetivos vigentes en la ventana (AC6)", () => {
  it("un solo objetivo produce un solo tramo", () => {
    const rows = [record("2026-07-01"), record("2026-07-02"), record("2026-07-03")];
    const spans = targetSpans(rows);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ kcal: 1800, from: "2026-07-01", to: "2026-07-03" });
  });

  it("agrupa tramos consecutivos y marca dónde cambia la pauta", () => {
    const rows = [
      record("2026-08-10"),
      record("2026-08-11"),
      record("2026-08-12", { target: { kcal: 1900, prot: 115 } }),
      record("2026-08-13", { target: { kcal: 1900, prot: 115 } }),
    ];
    const spans = targetSpans(rows);
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ kcal: 1800, to: "2026-08-11" });
    expect(spans[1]).toMatchObject({ kcal: 1900, from: "2026-08-12", to: "2026-08-13" });
  });

  it("ignora los días sin objetivo válido en vez de abrir un tramo a 0", () => {
    const rows = [
      record("2026-07-01", { target: { kcal: 0, prot: 0 } }),
      record("2026-07-02"),
    ];
    expect(targetSpans(rows)).toHaveLength(1);
    expect(targetSpans(rows)[0]).toMatchObject({ kcal: 1800, from: "2026-07-02" });
  });

  it("el resumen transporta los tramos de SU ventana, no del histórico", () => {
    const rows = [
      record("2026-06-01", { target: { kcal: 1700, prot: 105 } }),
      record("2026-07-15"),
      record("2026-07-20"),
    ];
    const summary = computeProgressSummary(rows, "2026-07-20", 7);
    expect(summary.targets).toHaveLength(1);
    expect(summary.targets[0]!.kcal).toBe(1800);
  });
});
