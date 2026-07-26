import { describe, expect, it } from "vitest";
import { DEFAULT_TRAINING_BY_WEEKDAY } from "@/lib/training-slot";
import {
  changeAssignmentDate,
  createTrainingAssignment,
  overrideAssignmentFranja,
} from "@/lib/training-assignment";

describe("estado fecha/franja al asignar una sesión (F20 AC5)", () => {
  it("sin fecha deshabilita y vacía la franja", () => {
    expect(
      createTrainingAssignment("", DEFAULT_TRAINING_BY_WEEKDAY),
    ).toEqual({ date: "", franja: null, source: "auto" });
  });

  it("precarga el patrón y no inventa franja en descanso", () => {
    expect(
      createTrainingAssignment("2026-07-25", {
        ...DEFAULT_TRAINING_BY_WEEKDAY,
        "6": "mañana",
      }),
    ).toEqual({ date: "2026-07-25", franja: "mañana", source: "auto" });
    expect(
      createTrainingAssignment("2026-07-26", DEFAULT_TRAINING_BY_WEEKDAY),
    ).toEqual({ date: "2026-07-26", franja: null, source: "auto" });
  });

  it("al cambiar fecha recalcula solo un valor automático", () => {
    const pattern = {
      ...DEFAULT_TRAINING_BY_WEEKDAY,
      "6": "mañana" as const,
    };
    const auto = createTrainingAssignment("2026-07-24", pattern);
    expect(changeAssignmentDate(auto, "2026-07-25", pattern)).toEqual({
      date: "2026-07-25",
      franja: "mañana",
      source: "auto",
    });

    const manual = overrideAssignmentFranja(auto, "mañana");
    expect(changeAssignmentDate(manual, "2026-07-26", pattern)).toEqual({
      date: "2026-07-26",
      franja: "mañana",
      source: "manual",
    });
  });

  it("al quitar fecha borra incluso el override visible", () => {
    const manual = overrideAssignmentFranja(
      createTrainingAssignment("2026-07-25", DEFAULT_TRAINING_BY_WEEKDAY),
      "mañana",
    );
    expect(
      changeAssignmentDate(manual, "", DEFAULT_TRAINING_BY_WEEKDAY),
    ).toEqual({ date: "", franja: null, source: "auto" });
  });
});
