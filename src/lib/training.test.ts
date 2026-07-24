import { describe, expect, it } from "vitest";
import { SESSIONS } from "@/lib/macros";
import {
  orderedSessionOptions,
  planSpanFromAssignments,
  sessionKcal,
  sessionPatchFor,
  trainingWeekSpan,
  TRAINING_TIPO_LABELS,
  TRAINING_TIPOS,
} from "./training";

describe("helpers de entrenamiento (doc 10 Fase B)", () => {
  it("sessionKcal: media redondeada del rango", () => {
    expect(sessionKcal(1000, 1600)).toBe(1300);
    expect(sessionKcal(500, 700)).toBe(600);
  });

  it("sessionKcal: si falta un extremo usa el otro; null si no hay datos", () => {
    expect(sessionKcal(null, 800)).toBe(800);
    expect(sessionKcal(800, null)).toBe(800);
    expect(sessionKcal(null, null)).toBeNull();
    expect(sessionKcal(undefined, undefined)).toBeNull();
  });

  it("planSpanFromAssignments: min/max de las fechas asignadas", () => {
    expect(
      planSpanFromAssignments(["2026-07-14", "2026-07-12", "2026-07-16"]),
    ).toEqual({ validFrom: "2026-07-12", validTo: "2026-07-16" });
  });

  it("planSpanFromAssignments: ignora vacíos y devuelve null sin fechas", () => {
    expect(planSpanFromAssignments(["", "no-fecha"])).toBeNull();
    expect(planSpanFromAssignments([])).toBeNull();
  });

  it("trainingWeekSpan: normaliza cualquier día a lunes-domingo", () => {
    expect(trainingWeekSpan("2026-07-15")).toEqual({
      validFrom: "2026-07-13",
      validTo: "2026-07-19",
    });
    expect(trainingWeekSpan("2026-07-19")).toEqual({
      validFrom: "2026-07-13",
      validTo: "2026-07-19",
    });
  });

  it("orderedSessionOptions: con plan = sesiones reales + Competición/Descanso, SIN genéricas", () => {
    const opts = orderedSessionOptions(["Snatch + WOD", "Aeróbico Z2"]);
    expect(opts).toEqual([
      "Snatch + WOD",
      "Aeróbico Z2",
      "Competición",
      "Descanso",
    ]);
    // Los T1–T6 genéricos NO aparecen cuando hay plan (eran el ruido).
    expect(opts).not.toContain(SESSIONS[0]);
  });

  it("orderedSessionOptions: sin plan = lista genérica SESSIONS", () => {
    expect(orderedSessionOptions([])).toEqual([...SESSIONS]);
  });

  it("sessionPatchFor: sesión del plan ancla sessionRef + kcal media", () => {
    const sessions = [
      { id: 7, nombre: "Snatch + WOD", kcalMin: 600, kcalMax: 800 },
    ];
    expect(sessionPatchFor("Snatch + WOD", sessions)).toEqual({
      sessionLabel: "Snatch + WOD",
      sessionRef: 7,
      sessionKcal: 700,
    });
  });

  it("sessionPatchFor: label genérico → sessionRef null y kcal null", () => {
    expect(sessionPatchFor("Descanso", [])).toEqual({
      sessionLabel: "Descanso",
      sessionRef: null,
      sessionKcal: null,
    });
  });

  it("TRAINING_TIPO_LABELS cubre todos los tipos", () => {
    for (const t of TRAINING_TIPOS) {
      expect(TRAINING_TIPO_LABELS[t]).toBeTruthy();
    }
  });
});
