import { describe, expect, it } from "vitest";
import {
  canonicalTrainingSessionZ,
  trainingPlanCreateZ,
} from "@/lib/schemas";

const session = {
  key: "T1",
  nombre: "Snatch",
  tipo: "halterofilia",
  contenido: "Snatch",
  kcalMin: 200,
  kcalMax: 300,
  duracionMin: 60,
};

describe("boundaries de franja de sesión (F20 AC7)", () => {
  it("un plan exige mañana/tarde en toda asignación", () => {
    const base = {
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      programa: "The Progrm",
      etiqueta: "Week 31",
      source: "texto",
      sessions: [session],
    };
    expect(
      trainingPlanCreateZ.safeParse({
        ...base,
        assignments: [
          { sessionIndex: 0, date: "2026-07-27", franja: "mañana" },
        ],
      }).success,
    ).toBe(true);
    expect(
      trainingPlanCreateZ.safeParse({
        ...base,
        assignments: [{ sessionIndex: 0, date: "2026-07-27" }],
      }).success,
    ).toBe(false);
    expect(
      trainingPlanCreateZ.safeParse({
        ...base,
        assignments: [
          { sessionIndex: 0, date: "2026-07-27", franja: "descanso" },
        ],
      }).success,
    ).toBe(false);
  });

  it("crear una sesión canónica exige una franja explícita", () => {
    expect(
      canonicalTrainingSessionZ.safeParse({
        date: "2026-07-27",
        session: { ...session, franja: "tarde" },
      }).success,
    ).toBe(true);
    expect(
      canonicalTrainingSessionZ.safeParse({
        date: "2026-07-27",
        session,
      }).success,
    ).toBe(false);
  });
});
