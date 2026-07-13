import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_BY_WEEKDAY } from "@/lib/macros";
import { type AthleteProfile, DEFAULT_ATHLETE_PROFILE } from "@/lib/profile";
import type { DayView } from "@/server/db/queries/day";
import { dayContext } from "./context";
import {
  athleteContext,
  athleteContextCompact,
  coachPrompt,
} from "./prompts";

/*
  ATHLETE_CONTEXT dinámico + guardarraíles del coach (doc 10 A2/A3/A4). Todo esto
  es interpolación pura (sin IA ni BD) → testeable directamente.
*/

const TODAY = "2026-07-12";

describe("ATHLETE_CONTEXT dinámico (doc 10 A2)", () => {
  it("el contexto completo sale del perfil (edita el perfil → cambia el texto)", () => {
    const full = athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY);
    expect(full).toContain("CrossFit");
    expect(full).toContain("33 años");
    expect(full).toContain("175 cm");
    expect(full).toContain("92 kg");
    expect(full).toContain("6 días/semana");
    expect(full).toContain("creatina");
    // Cambiar el perfil cambia la respuesta: nada queda hardcodeado.
    const running: AthleteProfile = {
      ...DEFAULT_ATHLETE_PROFILE,
      deporte: "Running",
      suplementos: [],
      objetivos: [{ desde: "2026-05-01", texto: "maratón sub-3h" }],
    };
    const alt = athleteContext(running, 70, 4, TODAY);
    expect(alt).toContain("Running");
    expect(alt).not.toContain("CrossFit");
    expect(alt).toContain("70 kg");
    expect(alt).toContain("4 días/semana");
    expect(alt).toContain("Suplementos que toma: ninguno");
  });

  it("cita el objetivo vigente con su fecha", () => {
    const full = athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY);
    expect(full).toContain("Objetivo actual (desde 2026-05-01)");
  });

  it("la versión compacta lleva la cláusula anti-sesgo", () => {
    const c = athleteContextCompact(DEFAULT_ATHLETE_PROFILE, 92);
    expect(c).toContain("NO ajustes las estimaciones nutricionales según el perfil");
    expect(c).not.toContain("días/semana"); // compacta: sin datos de programa
  });

  it("la excepción de foto permite usar la altura como escala", () => {
    const c = athleteContextCompact(DEFAULT_ATHLETE_PROFILE, 92, {
      photoScaleException: true,
    });
    expect(c).toContain("referencia de escala");
  });
});

describe("guardarraíles del coach (doc 10 A3)", () => {
  const base = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    kcal: 1800,
    prot: 110,
    carb: 200,
    fat: 60,
    dayContext: "Comidas: ninguna registrada aún.",
  };

  it("anti-suplementación: solo los del perfil, no prescribe", () => {
    const p = coachPrompt({ ...base, mode: "hoy" });
    expect(p).toContain("NO prescribes suplementación");
    expect(p).toContain("SOLO los de su perfil");
  });

  it("anti-entreno-fantasma: descanso/sin sesión → sin timing", () => {
    const p = coachPrompt({ ...base, mode: "hoy" });
    expect(p).toContain(
      "Si la sesión de hoy es Descanso o no hay sesión, NO asumas que va a entrenar",
    );
  });
});

describe("dayContext mira el calendario (doc 10 A4)", () => {
  const emptyView: DayView = {
    date: "2026-07-12",
    day: null,
    health: null,
    entries: [],
    session: null,
  };

  it("sin sesión registrada emite la que toca según el calendario semanal", () => {
    // 2026-07-12 es domingo (ISO 7) → default = Descanso.
    const ctx = dayContext(emptyView, {
      sessionByWeekday: DEFAULT_SESSION_BY_WEEKDAY,
      date: "2026-07-12",
    });
    expect(ctx).toContain("Sesión: sin registrar");
    expect(ctx).toContain("Descanso");
  });

  it("sin calendario no inventa sesión", () => {
    const ctx = dayContext(emptyView);
    expect(ctx).not.toContain("sin registrar");
  });
});
