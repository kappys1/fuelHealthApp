import { describe, expect, it } from "vitest";
import { weekdayName } from "@/lib/dates";
import { DEFAULT_SESSION_BY_WEEKDAY } from "@/lib/macros";
import { type AthleteProfile, DEFAULT_ATHLETE_PROFILE } from "@/lib/profile";
import type { DatedEntry, DayView } from "@/server/db/queries/day";
import type { PlanOptionDTO } from "@/server/db/queries/plan";
import type { MarkDTO } from "@/server/db/queries/marks";
import {
  dayContext,
  marksContext,
  pendingPlanOptions,
  recentMealsDetail,
} from "./context";
import {
  athleteContext,
  athleteContextCompact,
  chatSystemPrompt,
  coachPrompt,
  prepareVisitPrompt,
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
    today: TODAY,
    targetDate: TODAY,
    kcal: 1800,
    prot: 110,
    carb: 200,
    fat: 60,
    dayContext: "Comidas: ninguna registrada aún.",
    planPendiente: "",
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

describe("fecha en los prompts conversacionales (F01 Fase 0)", () => {
  const base = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    kcal: 1800,
    prot: 110,
    carb: 200,
    fat: 60,
    dayContext: "Comidas: ninguna registrada aún.",
    planPendiente: "",
  };

  it("AC2: el system prompt del chat contiene la línea `HOY es {hoy}`", () => {
    const p = chatSystemPrompt({
      atleta: base.atleta,
      today: TODAY,
      planSummary: "—",
      trendAdherence: "—",
      meds: "—",
      days30: "—",
    });
    expect(p).toContain(`HOY es ${TODAY}`);
    expect(p).toContain(weekdayName(TODAY)); // nombre del día real, sin hardcodear
  });

  it("el coach ancla el día evaluado por paridad (hoy=hoy, ayer=día evaluado)", () => {
    const hoy = coachPrompt({ ...base, today: TODAY, targetDate: TODAY, mode: "hoy" });
    expect(hoy).toContain(`HOY es ${TODAY}`);

    const ayerKey = "2026-07-11";
    const ayer = coachPrompt({
      ...base,
      today: TODAY,
      targetDate: ayerKey,
      mode: "ayer",
    });
    expect(ayer).toContain(`HOY es ${TODAY}`);
    expect(ayer).toContain(`Analizas AYER, ${ayerKey}`);
  });

  it("preparar-visita ancla la fecha", () => {
    const p = prepareVisitPrompt({
      atleta: base.atleta,
      today: TODAY,
      kcal: 1800,
      prot: 110,
      meds: "—",
      tendencia: "—",
      filas: "—",
    });
    expect(p).toContain(`HOY es ${TODAY}`);
  });
});

describe("el coach conoce el plan (F01 Fase 1)", () => {
  const opts: PlanOptionDTO[] = [
    {
      id: 1,
      meal: "cena",
      grp: "Proteína",
      name: "Pavo a la plancha",
      baseG: 150,
      kcal: 165,
      prot: 32,
      carb: 0,
      fat: 4,
      sort: 0,
    },
  ];

  it("AC4: el prompt incluye las opciones del plan pendientes", () => {
    const pendiente = pendingPlanOptions({ cena: opts }, ["cena"]);
    expect(pendiente).toContain("Pavo a la plancha");

    const p = coachPrompt({
      atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
      today: TODAY,
      targetDate: TODAY,
      mode: "hoy",
      kcal: 1800,
      prot: 110,
      carb: 200,
      fat: 60,
      dayContext: "Comidas: ninguna registrada aún.",
      planPendiente: pendiente,
    });
    expect(p).toContain("OPCIONES DEL PLAN PENDIENTES:");
    expect(p).toContain("Pavo a la plancha");
    expect(p).toContain("fuera de tu pauta"); // guardarraíl de prioridad del plan
  });

  it("pendingPlanOptions omite comidas ya registradas y sin opciones", () => {
    const pendiente = pendingPlanOptions({ cena: opts }, ["almuerzo"]);
    expect(pendiente).toBe(""); // 'cena' no está en pending; 'almuerzo' no tiene opciones
  });
});

describe("el chat conoce lo que has comido (F02)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };

  it("AC3: el system prompt lleva el guardarraíl anti-invención", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("NUNCA inventes comidas, cantidades ni un «día pautado estándar»");
    expect(p).toContain("pide a Alex que te lo proporcione");
  });

  it("AC4: incluye la sección de detalle por item cuando hay comidas", () => {
    const ayer = "2026-07-11";
    const entries: DatedEntry[] = [
      { date: ayer, meal: "cena", name: "Pavo", kcal: 200, prot: 30, carb: 0, fat: 5 },
      { date: TODAY, meal: "merienda", name: "Sandía", kcal: 120, prot: 2, carb: 28, fat: 0 },
      { date: TODAY, meal: "merienda", name: "Pan", kcal: 160, prot: 5, carb: 30, fat: 1 },
    ];
    const detail = recentMealsDetail(entries);
    // Agrupado por día, HOY primero.
    expect(detail.indexOf(TODAY)).toBeLessThan(detail.indexOf(ayer));
    expect(detail).toContain("[merienda] Sandía");
    expect(detail).toContain("[merienda] Pan");

    const p = chatSystemPrompt({ ...chatArgs, mealsDetail: detail });
    expect(p).toContain("COMIDAS POR ITEM (últimos 7 días");
    expect(p).toContain("Sandía");
  });

  it("recentMealsDetail vacío no añade sección al prompt", () => {
    expect(recentMealsDetail([])).toBe("");
    const p = chatSystemPrompt({ ...chatArgs, mealsDetail: "" });
    expect(p).not.toContain("COMIDAS POR ITEM");
  });
});

describe("el chat/visita conocen tus marcas (F03)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };
  const marks: MarkDTO[] = [
    {
      id: 1,
      name: "Sentadilla 1RM",
      measureType: "weight",
      unit: "kg",
      family: null,
      entries: [
        { id: 1, markId: 1, value: 100, recordedOn: "2026-05-01", note: null },
        { id: 2, markId: 1, value: 110, recordedOn: "2026-06-01", note: null },
      ],
    },
    // Marca sin registros: se omite del contexto.
    { id: 2, name: "Fran", measureType: "time", unit: "min", family: null, entries: [] },
  ];

  it("marksContext resume última + récord + progresión, omite las vacías", () => {
    const c = marksContext(marks);
    expect(c).toContain("Sentadilla 1RM");
    expect(c).toContain("última 110 kg (2026-06-01)");
    expect(c).toContain("progresión: 100→110 kg");
    expect(c).not.toContain("Fran"); // sin registros → fuera
  });

  it("el chat lleva el guardarraíl anti-sobreatribución + la sección de marcas", () => {
    const p = chatSystemPrompt({ ...chatArgs, marks: marksContext(marks) });
    expect(p).toContain("NO afirmes causalidad entre la nutrición y una marca");
    expect(p).toContain("MARCAS DE RENDIMIENTO");
    expect(p).toContain("Sentadilla 1RM");
  });

  it("sin marcas no añade la sección al chat", () => {
    const p = chatSystemPrompt({ ...chatArgs, marks: "" });
    expect(p).not.toContain("MARCAS DE RENDIMIENTO");
    // el guardarraíl se mantiene siempre (aunque no haya marcas hoy)
    expect(p).toContain("NO afirmes causalidad entre la nutrición y una marca");
  });

  it("la visita cita las marcas como evidencia, sin prescribir", () => {
    const p = prepareVisitPrompt({
      atleta: chatArgs.atleta,
      today: TODAY,
      kcal: 1800,
      prot: 110,
      meds: "—",
      tendencia: "—",
      filas: "—",
      marks: marksContext(marks),
    });
    expect(p).toContain("Marcas de rendimiento (PRs y progresión)");
    expect(p).toContain("sin atribuir su cambio a la nutrición");
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
