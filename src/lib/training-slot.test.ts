import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAINING_BY_WEEKDAY,
  resolveTrainingSlot,
} from "@/lib/training-slot";

describe("resolveTrainingSlot — precedencia de sesión y patrón (F20 AC4)", () => {
  it("prioriza la franja explícita de la sesión", () => {
    expect(
      resolveTrainingSlot({
        date: "2026-07-25",
        hasSession: true,
        sessionFranja: "mañana",
        trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
      }),
    ).toEqual({ value: "mañana", origin: "sesion" });
  });

  it("usa el patrón como fallback cuando hay sesión sin franja", () => {
    expect(
      resolveTrainingSlot({
        date: "2026-07-21",
        hasSession: true,
        sessionFranja: null,
        trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
      }),
    ).toEqual({ value: "tarde", origin: "patron" });
  });

  it("declara sin_dato si hay sesión sin franja en un descanso habitual", () => {
    expect(
      resolveTrainingSlot({
        date: "2026-07-26",
        hasSession: true,
        sessionFranja: null,
        trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
      }),
    ).toEqual({ value: "sin_dato", origin: "sin_dato" });
  });

  it("sin sesión devuelve el patrón del weekday Europe/Madrid", () => {
    expect(
      resolveTrainingSlot({
        date: "2026-07-26",
        hasSession: false,
        sessionFranja: null,
        trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
      }),
    ).toEqual({ value: "descanso", origin: "patron" });
  });
});
