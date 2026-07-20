import { describe, expect, it } from "vitest";
import {
  computeLoggingStreak,
  computeProgressSummary,
  macroEnergy,
  trailingRecords,
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
