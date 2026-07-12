import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_BY_WEEKDAY } from "@/lib/macros";
import {
  type AthleteProfile,
  currentObjective,
  DEFAULT_ATHLETE_PROFILE,
  deriveAge,
  trainingDaysPerWeek,
} from "./profile";

describe("perfil de atleta — derivaciones (doc 10 A1)", () => {
  it("deriva la edad de la fecha de nacimiento (cumpleaños ya pasado)", () => {
    expect(deriveAge("1993-01-01", "2026-07-12")).toBe(33);
  });

  it("resta un año si el cumpleaños aún no ha llegado este año", () => {
    expect(deriveAge("1993-12-31", "2026-07-12")).toBe(32);
  });

  it("edad null si falta la fecha de nacimiento", () => {
    expect(deriveAge(null, "2026-07-12")).toBeNull();
  });

  it("objetivo vigente = último por `desde` (no el orden del array)", () => {
    const p: AthleteProfile = {
      ...DEFAULT_ATHLETE_PROFILE,
      objetivos: [
        { desde: "2026-01-01", texto: "volumen" },
        { desde: "2026-06-01", texto: "definición" },
        { desde: "2026-03-01", texto: "mantenimiento" },
      ],
    };
    expect(currentObjective(p)?.texto).toBe("definición");
  });

  it("diasEntrenoSemana se deriva del mapeo (nº de días ≠ Descanso)", () => {
    // Default: L-S entrenan, D descanso → 6.
    expect(trainingDaysPerWeek(DEFAULT_SESSION_BY_WEEKDAY)).toBe(6);
    expect(
      trainingDaysPerWeek({ "1": "T1", "2": "Descanso", "3": "T3" }),
    ).toBe(2);
  });
});
