import { describe, expect, it } from "vitest";
import { SESSIONS } from "@/lib/macros";
import {
  orderedSessionOptions,
  planSpanFromAssignments,
  sessionKcal,
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

  it("orderedSessionOptions: sesiones del plan primero, luego Competición/Descanso, luego genéricas", () => {
    const opts = orderedSessionOptions(["Snatch + WOD", "Aeróbico Z2"]);
    expect(opts[0]).toBe("Snatch + WOD");
    expect(opts[1]).toBe("Aeróbico Z2");
    expect(opts[2]).toBe("Competición");
    expect(opts[3]).toBe("Descanso");
    // Las genéricas van después y no se duplican.
    expect(opts).toContain(SESSIONS[0]);
    expect(new Set(opts).size).toBe(opts.length);
  });

  it("orderedSessionOptions: sin plan, solo Competición/Descanso + genéricas (sin duplicar)", () => {
    const opts = orderedSessionOptions([]);
    expect(opts[0]).toBe("Competición");
    expect(opts[1]).toBe("Descanso");
    // SESSIONS ya incluye Competición/Descanso → no se duplican.
    expect(new Set(opts).size).toBe(opts.length);
  });

  it("TRAINING_TIPO_LABELS cubre todos los tipos", () => {
    for (const t of TRAINING_TIPOS) {
      expect(TRAINING_TIPO_LABELS[t]).toBeTruthy();
    }
  });
});
