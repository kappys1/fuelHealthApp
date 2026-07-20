import { describe, expect, it } from "vitest";
import type { DayView } from "@/server/db/queries/day";
import {
  coachContextHash,
  coachReadingKey,
  coachReadingView,
  type CoachReading,
} from "./coach-reading";

const view: DayView = {
  date: "2026-07-20",
  day: null,
  health: null,
  session: null,
  entries: [
    {
      id: 2,
      meal: "comida",
      name: "Arroz",
      kcal: 200,
      prot: 4,
      carb: 42,
      fat: 1,
      source: "manual",
      photoUrl: null,
      grams: 100,
      baseG: 100,
      baseKcal: 200,
      baseProt: 4,
      baseCarb: 42,
      baseFat: 1,
      createdAt: "2026-07-20T10:00:00.000Z",
    },
  ],
};

const targets = { kcal: 2_000, prot: 140, carb: 220, fat: 60 };

describe("coach reading cache", () => {
  it("usa una clave distinta por fecha y modo", () => {
    expect(coachReadingKey("2026-07-20", "hoy")).toBe(
      "coachReading:2026-07-20:hoy",
    );
    expect(coachReadingKey("2026-07-20", "ayer")).not.toBe(
      coachReadingKey("2026-07-20", "hoy"),
    );
  });

  it("mantiene la huella si solo cambia createdAt u orden de entradas", () => {
    const changed: DayView = {
      ...view,
      entries: [
        { ...view.entries[0]!, createdAt: "2026-07-20T11:00:00.000Z" },
      ],
    };
    expect(coachContextHash(changed, targets)).toBe(
      coachContextHash(view, targets),
    );
  });

  it("marca la lectura obsoleta cuando cambian macros u objetivos", () => {
    const hash = coachContextHash(view, targets);
    const reading: CoachReading = {
      baseDate: view.date,
      targetDate: view.date,
      mode: "hoy",
      text: "Lectura guardada",
      generatedAt: "2026-07-20T12:00:00.000Z",
      contextHash: hash,
    };
    expect(coachReadingView(reading, hash)?.stale).toBe(false);

    const changed: DayView = {
      ...view,
      entries: [{ ...view.entries[0]!, carb: 50 }],
    };
    expect(
      coachReadingView(reading, coachContextHash(changed, targets))?.stale,
    ).toBe(true);
    expect(
      coachReadingView(
        reading,
        coachContextHash(view, { ...targets, kcal: 2_100 }),
      )?.stale,
    ).toBe(true);
  });
});
