import { describe, expect, it } from "vitest";
import {
  buildCanonicalTrainingWrite,
  type CanonicalTrainingState,
} from "./training-persistence";

const input = {
  date: "2026-07-26",
  session: {
    nombre: "Snatch + WOD",
    tipo: "mixto" as const,
    contenido: "Fuerza: Snatch\nCrossFit: 5 rondas",
    kcalMin: 500,
    kcalMax: 700,
    duracionMin: 75,
  },
};

function state(
  patch: Partial<CanonicalTrainingState> = {},
): CanonicalTrainingState {
  return {
    day: null,
    assignedSession: null,
    week: null,
    allocatedPlanId: 40,
    allocatedSessionId: 80,
    athleteProgram: "The Progrm",
    ...patch,
  };
}

describe("persistencia canónica de sesión · F17", () => {
  it("actualiza la misma training_session asignada y sincroniza days", () => {
    const currentSession = {
      id: 7,
      planId: 3,
      key: "T2",
      nombre: "Training 2",
      tipo: "fuerza" as const,
      contenido: "Anterior",
      kcalMin: 300,
      kcalMax: 500,
      duracionMin: 60,
      sort: 1,
    };
    const write = buildCanonicalTrainingWrite(
      input,
      state({
        day: {
          exists: true,
          sessionRef: 7,
          sessionLabel: "Training 2",
          sessionKcal: 400,
        },
        assignedSession: currentSession,
      }),
    );

    expect(write.kind).toBe("updated");
    expect(write.session.id).toBe(7);
    expect(write.planToInsert).toBeNull();
    expect(write.day).toEqual({
      date: input.date,
      sessionRef: 7,
      sessionLabel: "Snatch + WOD",
      sessionKcal: 600,
    });
    expect(write.undo.previousSession).toEqual(currentSession);
    expect(write.undo.previousDay.sessionLabel).toBe("Training 2");
  });

  it("reutiliza la semana existente y crea una sola sesión para la fecha", () => {
    const week = {
      id: 12,
      programa: "The Progrm",
      etiqueta: "Week 30",
      validFrom: "2026-07-20",
      validTo: "2026-07-26",
      source: "pdf" as const,
      sessionCount: 6,
      maxSort: 5,
    };
    const first = buildCanonicalTrainingWrite(input, state({ week }));
    expect(first.kind).toBe("created");
    expect(first.session.id).toBe(80);
    expect(first.session.planId).toBe(12);
    expect(first.session.sort).toBe(6);
    expect(first.planToInsert).toBeNull();

    const replay = buildCanonicalTrainingWrite(
      { ...input, session: { ...input.session, nombre: "WOD definitivo" } },
      state({
        allocatedSessionId: 81,
        week,
        day: {
          exists: true,
          sessionRef: first.session.id,
          sessionLabel: first.session.nombre,
          sessionKcal: first.day.sessionKcal,
        },
        assignedSession: first.session,
      }),
    );
    expect(replay.kind).toBe("updated");
    expect(replay.session.id).toBe(80);
    expect(replay.planToInsert).toBeNull();
  });

  it("sin semana crea una manual lunes-domingo con el programa vigente", () => {
    const write = buildCanonicalTrainingWrite(input, state());

    expect(write.planToInsert).toEqual({
      id: 40,
      programa: "The Progrm",
      etiqueta: "Semana del lun 20 jul",
      source: "texto",
      validFrom: "2026-07-20",
      validTo: "2026-07-26",
    });
    expect(write.session).toMatchObject({
      id: 80,
      planId: 40,
      key: "Día 7",
      sort: 0,
    });
    expect(write.undo.createdPlanId).toBe(40);
    expect(write.undo.createdSession).toBe(true);
  });

  it("usa el fallback cuando el perfil no tiene programa", () => {
    const write = buildCanonicalTrainingWrite(
      input,
      state({ athleteProgram: "   " }),
    );
    expect(write.planToInsert?.programa).toBe("Entreno manual");
  });

  it("el undo conserva ausencia de día y el snapshot anterior completo", () => {
    const created = buildCanonicalTrainingWrite(input, state());
    expect(created.undo.previousDay).toEqual({
      exists: false,
      sessionRef: null,
      sessionLabel: null,
      sessionKcal: null,
    });
    expect(created.undo.previousSession).toBeNull();
    expect(created.undo.writtenSessionId).toBe(80);
  });
});
