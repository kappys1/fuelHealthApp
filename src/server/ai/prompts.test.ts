import { describe, expect, it } from "vitest";
import { weekdayName } from "@/lib/dates";
import { DEFAULT_SESSION_BY_WEEKDAY } from "@/lib/macros";
import { type AthleteProfile, DEFAULT_ATHLETE_PROFILE } from "@/lib/profile";
import type { DatedEntry, DayView } from "@/server/db/queries/day";
import type { PlanOptionDTO } from "@/server/db/queries/plan";
import type { MarkDTO } from "@/server/db/queries/marks";
import type { DeficitResult } from "@/server/analytics/deficit";
import { energyBalance } from "@/server/analytics/energyBalance";
import { gaugeVerdict } from "@/server/analytics/gaugeVerdict";
import type { TrainingTiming } from "@/server/analytics/dayClosure";
import {
  closureLine,
  dayContext,
  energyBalanceLine,
  gaugeVerdictLine,
  marksContext,
  pendingPlanOptions,
  planSummary,
  productsContext,
  recentMealsDetail,
  trendJudgeLine,
  trendSummary,
} from "./context";
import type { ProductDTO } from "@/server/db/queries/lookups";
import {
  athleteContext,
  athleteContextCompact,
  chatSummaryPrompt,
  chatSystemPrompt,
  chatTitlePrompt,
  coachPrompt,
  photoPrompt,
  prepareVisitPrompt,
  sharedGuardrails,
} from "./prompts";

/*
  ATHLETE_CONTEXT dinámico + guardarraíles del coach (doc 10 A2/A3/A4). Todo esto
  es interpolación pura (sin IA ni BD) → testeable directamente.
*/

const TODAY = "2026-07-12";

describe("foto sin pauta nutricional", () => {
  it("declara el objetivo ausente y exige un veredicto null", () => {
    const prompt = photoPrompt({
      contexto: "Contexto del usuario.",
      meal: "comida",
      kcalObjetivo: null,
      protObjetivo: null,
      listaOpciones: "",
    });

    expect(prompt).toContain("sin una pauta nutricional configurada");
    expect(prompt).toContain("encaja_plan: null");
    expect(prompt).not.toMatch(/plan de \d+ kcal/);
  });
});

describe("F14·B · la foto detecta etiqueta nutricional (prompt congelado)", () => {
  const prompt = photoPrompt({
    contexto: "Contexto del usuario.",
    meal: "comida",
    kcalObjetivo: 2200,
    protObjetivo: 170,
    listaOpciones: "Pollo, arroz",
  });

  it("caso etiqueta → la LEE (ración en items + por 100 g en producto), no la vacía", () => {
    expect(prompt).toContain("ETIQUETA o tabla de información nutricional");
    expect(prompt).toContain('devuelve "es_etiqueta": true');
    // La ración va como item (para añadir como comida directamente) y el por-100 g
    // como bloque producto (para «Guardar como producto» sin 2ª llamada).
    expect(prompt).toContain("los valores POR 100 g de la etiqueta");
    expect(prompt).toContain("leídos tal cual, sin estimar");
    expect(prompt).not.toContain('"items": []');
  });

  it("caso plato real → es_etiqueta:false, producto:null y análisis normal", () => {
    expect(prompt).toContain('devuelve "es_etiqueta": false, "producto": null');
    expect(prompt).toContain('"es_etiqueta": boolean');
    expect(prompt).toContain('"producto":');
  });
});

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

  it("declara el peso ausente en vez de inventar un valor", () => {
    const full = athleteContext(DEFAULT_ATHLETE_PROFILE, null, 6, TODAY);
    const compact = athleteContextCompact(DEFAULT_ATHLETE_PROFILE, null);
    expect(full).toContain("peso reciente no disponible");
    expect(compact).toContain("peso reciente no disponible");
    expect(full).not.toContain("92 kg");
  });
});

describe("resumen de tendencia honesto", () => {
  it("nombra el déficit firmado negativo como superávit y omite TDEE ausente", () => {
    const summary = trendSummary({
      enough: true,
      weighins: 8,
      spanDays: 12,
      kgPerWeek: 0.37,
      deficitKcal: -403,
      intakeMean: 1821,
      tdee: null,
    });
    expect(summary).toContain("superávit estimado ~403 kcal/día");
    expect(summary).not.toContain("déficit real ~-403");
    expect(summary).not.toContain("0 kcal/día");
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
      variants: [],
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

describe("coach: datos juzgados en servidor + tono (regresión 14-jul, DECISIONS #53)", () => {
  const TARGETS = { kcal: 1800, prot: 110, carb: 215, fat: 55 };
  // 14-jul real: 1987 kcal · 114P/227C/66F, día de entreno, fase Normal.
  const JUL14 = { kcal: 1987, prot: 114, carb: 227, fat: 66 };

  it("línea de veredicto = MISMO juicio del gauge (cubierto Y +187)", () => {
    const line = gaugeVerdictLine(gaugeVerdict(TARGETS, JUL14, null), {
      faseLabel: "Normal",
      sessionLabel: "día de entreno: Training 3",
    });
    expect(line).toContain("objetivos cubiertos ✓");
    expect(line).toContain("kcal +187 sobre la pauta de 1800");
    expect(line).toContain("fase Normal");
    expect(line).toContain("día de entreno: Training 3");
  });

  it("línea de balance = déficit real del día pese a pasarse de INGESTA", () => {
    const line = energyBalanceLine(
      energyBalance({
        intakeKcal: 1987,
        basalKcal: 1800,
        activeKcal: 950,
        sessionKcal: 600,
      }),
    );
    expect(line).toContain("déficit ~763");
    expect(line).toContain("NO es el juez");
  });

  it("línea del juez (báscula) según haya o no tendencia fiable", () => {
    const enough: DeficitResult = {
      enough: true,
      weighins: 10,
      spanDays: 14,
      kgPerWeek: -0.4,
      deficitKcal: 440,
      intakeMean: 1850,
      tdee: 2290,
    };
    expect(trendJudgeLine(enough)).toContain("ESTE es el juez");
    expect(trendJudgeLine(enough)).toContain("440 kcal/día");
    const notEnough: DeficitResult = {
      enough: false,
      weighins: 3,
      spanDays: 0,
      kgPerWeek: null,
      deficitKcal: null,
      intakeMean: null,
      tdee: null,
    };
    expect(trendJudgeLine(notEnough)).toContain("aún sin tendencia fiable");
  });

  it("el prompt del coach lleva datos ya juzgados, tono NO catastrófico y guardarraíles completos", () => {
    const dayData = [
      gaugeVerdictLine(gaugeVerdict(TARGETS, JUL14, null), {
        faseLabel: "Normal",
        sessionLabel: "día de entreno: Training 3",
      }),
      energyBalanceLine(
        energyBalance({
          intakeKcal: 1987,
          basalKcal: 1800,
          activeKcal: 950,
          sessionKcal: 600,
        }),
      ),
    ].join("\n");
    const p = coachPrompt({
      atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
      today: TODAY,
      targetDate: "2026-07-14",
      mode: "ayer",
      kcal: 1800,
      prot: 110,
      carb: 215,
      fat: 55,
      dayContext: "Comidas: [...]",
      planPendiente: "",
      dayData,
    });
    // (1) los datos ya juzgados viajan y se ordena usarlos tal cual
    expect(p).toContain("objetivos cubiertos ✓");
    expect(p).toContain("déficit ~763");
    expect(p).toContain("úsalos tal cual, no recalcules");
    // (2) tono honesto/proporcionado, sin bronca
    expect(p).toContain("SIN dramatizar");
    expect(p).toContain("NO lo conviertas en un fracaso");
    // (3) guardarraíles: anti-prescripción, anti-pseudociencia, anti-invención
    expect(p).toContain("cíñete a X kcal");
    expect(p).toContain("grasa abdominal");
    expect(p).toContain("no inventes alimentos");
    // (4) el marco que causaba la «bronca» YA NO está
    expect(p).not.toContain("en qué falló respecto a objetivos");
  });
});

describe("coach: directriz de cierre por dato, no por prompt (ai-tuner 25-jul, DECISIONS #76)", () => {
  const T = { kcal: 1800, prot: 110, carb: 215, fat: 55 };
  const noTiming: TrainingTiming = { rel: "sin_dato", hoursToStart: null };

  // Casos canónicos LITERALES del export real (skill §6: sin caso, no hay fix).
  it("21-jul (faltan 10 kcal, definición) → DÍA CERRADO, NO sugerir comida", () => {
    const v = gaugeVerdict(T, { kcal: 1790, prot: 129, carb: 195, fat: 57 }, null);
    const line = closureLine({ stance: "deficit", verdict: v, timing: noTiming });
    expect(line).toContain("DÍA CERRADO");
    expect(line).toContain("NO sugieras comida");
  });

  it("23-jul (67 kcal, proteína cubierta, definición) → día cerrado", () => {
    const v = gaugeVerdict(T, { kcal: 1733, prot: 114, carb: 181, fat: 60 }, null);
    expect(
      closureLine({ stance: "deficit", verdict: v, timing: noTiming }),
    ).toContain("DÍA CERRADO");
  });

  it("24-jul (22 g proteína pendientes) → PROTEÍNA PRIORITARIA (proteína magra)", () => {
    const v = gaugeVerdict(T, { kcal: 1748, prot: 88, carb: 200, fat: 60 }, null);
    const line = closureLine({ stance: "deficit", verdict: v, timing: noTiming });
    expect(line).toContain("PROTEÍNA PRIORITARIA");
    expect(line).toContain("proteína magra");
  });

  it("MISMO 23-jul con objetivo=volumen → SUELO, sí invita a cerrar (no «día cerrado»)", () => {
    const v = gaugeVerdict(T, { kcal: 1733, prot: 114, carb: 181, fat: 60 }, null);
    const line = closureLine({ stance: "superavit", verdict: v, timing: noTiming });
    expect(line).toContain("SUELO");
    expect(line).not.toContain("NO sugieras comida");
  });

  it("hueco material: definición NO empuja (techo, «si tienes hambre»); volumen sugiere cerrar", () => {
    const v = gaugeVerdict(T, { kcal: 1600, prot: 110, carb: 180, fat: 40 }, null); // 200 kcal rem
    const def = closureLine({ stance: "deficit", verdict: v, timing: noTiming });
    expect(def).toContain("TECHO");
    expect(def).toContain("si tienes hambre");
    const vol = closureLine({ stance: "superavit", verdict: v, timing: noTiming });
    expect(vol).toContain("sugiere cerrarlo");
  });

  it("exceso en definición se comenta con calma, sin sugerir más comida", () => {
    const v = gaugeVerdict(T, { kcal: 1950, prot: 120, carb: 240, fat: 70 }, null);
    const line = closureLine({ stance: "deficit", verdict: v, timing: noTiming });
    expect(line).toContain("EXCESO");
    expect(line).toContain("NO sugieras más comida");
  });

  it("mantenimiento: hueco dentro del ±10 % → EN BANDA (no comentar)", () => {
    const v = gaugeVerdict(T, { kcal: 1650, prot: 110, carb: 215, fat: 55 }, null); // 150 kcal rem
    expect(
      closureLine({ stance: "mantenimiento", verdict: v, timing: noTiming }),
    ).toContain("EN BANDA");
  });

  it("timing: hidratos pendientes a las 17:00 (pre) vs 22:30 (post) → directrices distintas", () => {
    const v = gaugeVerdict(T, { kcal: 1400, prot: 110, carb: 150, fat: 40 }, null); // carb rem 65
    const pre = closureLine({
      stance: "deficit",
      verdict: v,
      timing: { rel: "pre", hoursToStart: 2.5 },
    });
    const post = closureLine({
      stance: "deficit",
      verdict: v,
      timing: { rel: "post", hoursToStart: null },
    });
    expect(pre).toContain("comida previa");
    expect(pre).toContain("2,5 h");
    expect(post).toContain("recuperación");
    expect(pre).not.toEqual(post);
  });

  it("el bloque «hoy» sigue la directriz y ya NO pide una sugerencia incondicional", () => {
    const base = {
      atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
      today: TODAY,
      targetDate: TODAY,
      kcal: 1800,
      prot: 110,
      carb: 215,
      fat: 55,
      dayContext: "Comidas: [...]",
      planPendiente: "",
    };
    const p = coachPrompt({ ...base, mode: "hoy" });
    expect(p).toContain("ACTÚA SEGÚN LA DIRECTRIZ DE CIERRE");
    expect(p).toContain("NO sugieras comida por defecto ni para rellenar huecos pequeños");
    // el marco que causaba la compulsión de cuadrar YA NO está
    expect(p).not.toContain(
      "una sugerencia concreta con las comidas del plan que le quedan",
    );
  });

  it("día pasado analizado en modo «hoy» (retroactivo) se etiqueta como terminado", () => {
    const p = coachPrompt({
      atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
      today: TODAY,
      targetDate: "2026-07-10",
      mode: "hoy",
      retroactive: true,
      kcal: 1800,
      prot: 110,
      carb: 215,
      fat: 55,
      dayContext: "Comidas: [...]",
      planPendiente: "",
    });
    expect(p).toContain("Analizas un día YA PASADO, 2026-07-10");
    expect(p).toContain("Día TERMINADO");
    expect(p).not.toContain("Día EN CURSO");
  });
});

describe("chat: persona directa + resumen con hechos literales (DECISIONS #54)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };

  it("el system prompt lleva la persona (analista directo) y el tope de brevedad", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("analista de rendimiento");
    expect(p).toContain("Sé BREVE");
  });

  it("cuadrar el día con SU pauta es su trabajo (el «consúltalo» NO sobre-dispara)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("ayudarle a cuadrar el día con SU pauta");
    expect(p).toContain("igual que hace el coach");
    // el deferral al nutri se reserva; NO para «¿qué meriendo con lo que me queda?»
    expect(p).toContain("NUNCA para «¿qué meriendo con lo que me queda?»");
  });

  it("el prompt de resumen exige la lista LITERAL de hechos de Alex", () => {
    const s = chatSummaryPrompt("Atleta: no tomo lactosa\nAsistente: anotado");
    expect(s).toContain("Hechos y decisiones de Alex:");
    expect(s).toContain("sin reformular ni omitir");
  });

  it("proyectar el día con opciones del plan NO es inventar (DECISIONS #56)", () => {
    const p = chatSystemPrompt(chatArgs);
    // La distinción explícita: usar macros que SÍ están ≠ inventar.
    expect(p).toContain("NO es inventar, es tu trabajo");
    expect(p).toContain("proyectar cómo acabaría el día si cenas una opción del plan");
  });

  it("el conocimiento nutricional general (equivalencias) NO es inventar (DECISIONS #61, absorbido en #62)", () => {
    const p = chatSystemPrompt(chatArgs);
    // Regresión: a «macarrones, ¿cuánto añado?» debe aplicar la equivalencia con
    // su pauta a la primera, no exigir los macros de un alimento común.
    expect(p).toContain("conocimiento nutricional general");
    expect(p).toContain("DECLARANDO la asunción");
    expect(p).toContain("respóndele a la primera con la equivalencia");
    // Inventar se redefine como afirmar QUÉ comió / citar registros inexistentes.
    expect(p).toContain("afirmar qué comió Alex");
  });

  it("al repartir una cantidad entre tomas, prioriza lo práctico (DECISIONS #61, absorbido en #62)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("prioriza lo práctico");
  });
});

// ── F05 Fase 0 · reconstrucción del prompt del chat (DECISIONS #62) ──
// El contrato es C1-C9 de la spec F05. Estos tests del builder son la red de
// regresión determinista; los AC de comportamiento (0.1-0.6) los valida Alex en
// vivo (🖐). La causa raíz de F05 fue que el chat NO heredaba los guardarraíles
// del coach: aquí se verifica que ahora comparten fuente única.
describe("F05 Fase 0 · guardarraíles compartidos coach↔chat (DECISIONS #62)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };
  const coachArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    targetDate: TODAY,
    mode: "hoy" as const,
    kcal: 1800,
    prot: 110,
    carb: 200,
    fat: 60,
    dayContext: "Comidas: ninguna registrada aún.",
    planPendiente: "",
  };

  it("sharedGuardrails cubre no-diagnóstico, pseudociencia, anti-PR, entreno-fantasma y outlier del reloj (F12)", () => {
    const g = sharedGuardrails();
    expect(g).toContain("NO diagnostiques causas clínicas");
    expect(g).toContain("Prohibida la pseudociencia");
    expect(g).toContain("grasa localizada");
    expect(g).toContain("NO afirmes causalidad entre la nutrición y una marca");
    expect(g).toContain("NO asumas que va a entrenar ni des timing pre/post-entreno");
    // F12 (caso HRV 194 del 22-jul): dato del reloj muy fuera de base = artefacto,
    // no fisiología; nunca «recuperación extrema» sobre un valor aislado anómalo.
    expect(g).toContain("probable artefacto de medición");
    expect(g).toContain("recuperación extrema");
  });

  it("coach y chat heredan la MISMA fuente (no vuelven a divergir · causa raíz F05)", () => {
    const g = sharedGuardrails();
    expect(chatSystemPrompt(chatArgs)).toContain(g);
    expect(coachPrompt(coachArgs)).toContain(g);
  });

  it("C8: el chat ahora SÍ tiene pseudociencia y entreno-fantasma (antes le faltaban)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("Prohibida la pseudociencia");
    expect(p).toContain("NO asumas que va a entrenar ni des timing pre/post-entreno");
    expect(p).toContain("NO diagnostiques causas clínicas");
  });
});

describe("chat: reconstrucción F05 Fase 0 (contrato C1-C9)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };

  it("C1: criterio realista (no clavar), verdad del hueco + una palanca, nada absurdo", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("criterio REALISTA");
    expect(p).toContain("la báscula es el juez");
    expect(p).toContain("Di la verdad del hueco");
    expect(p).toContain("ofrece UNA palanca");
    expect(p).toContain("acércate sin pasarte, no claves");
    expect(p).toContain("480 g de arroz"); // ejemplo de ración absurda prohibida
  });

  it("C2: las opciones de cada comida son ALTERNATIVAS, no se apilan (fin del arroz+boniato+pan)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("las opciones de cada comida son ALTERNATIVAS, no las apiles");
    expect(p).toContain("arroz+boniato+pan");
    // se conserva la proyección del día (#56), NO el apilamiento
    expect(p).toContain("proyectar cómo acabaría el día si cenas una opción del plan");
  });

  it("C3: detecta modos (fin de día / carga / se ha pasado / clavar si lo pide)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("fin del día o su última comida");
    expect(p).toContain("fase de Carga o Competición");
    expect(p).toContain("a la baja sin pasarse en exceso");
    expect(p).toContain("Si te lo pide explícitamente, clava");
  });

  it("C5: responde y luego pregunta, con defaults sensatos (no bloquea)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("defaults sensatos");
    expect(p).toContain("pregunta solo cuando la respuesta cambie de verdad");
    expect(p).toContain("no bloquees con un interrogatorio");
  });

  it("C6: fuera de pauta proactivo, marcado, sin prescribir", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("comidas realistas fuera de la pauta");
    expect(p).toContain("«fuera de tu pauta»");
    expect(p).toContain("¿te apetece algo distinto hoy?");
    expect(p).toContain("Sugieres, no prescribes");
  });

  it("C7: calidad de la fuente (buenas grasas, no rellenar por rellenar)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("Elige buenas fuentes");
    expect(p).toContain("AOVE/aguacate/crema");
    expect(p).toContain("no rellenes por rellenar");
  });

  it("C1 (iteración dev 16-jul): no rellenar huecos pequeños, proporcionalidad, gasolina≠rellenar, reconcilia contexto", () => {
    const p = chatSystemPrompt(chatArgs);
    // quedarse corto en definición no es un hueco que rellenar
    expect(p).toContain("NO es un hueco que rellenar");
    expect(p).toContain("vas bien, no toques nada");
    // la palanca es proporcional al hueco y ÚNICA de verdad (no subir la apuesta)
    expect(p).toContain("SOLO si el hueco es relevante");
    expect(p).toContain("no subas la apuesta");
    // gasolina de sesión (pre-entreno) ≠ rellenar para clavar
    expect(p).toContain("gasolina para la sesión");
    // reconcilia el cambio de contexto en vez de contradecirse (incoherencia T1↔T3)
    expect(p).toContain("reconcílialo en vez de contradecirte");
  });

  it("C1 (iteración dev 16-jul #2): el techo de kcal manda; no cerrar todos los macros a costa de pasarse", () => {
    const p = chatSystemPrompt(chatArgs);
    // el total de kcal es el juez, por encima de cerrar cada macro
    expect(p).toContain("El techo de kcal del día manda sobre cerrar macros");
    expect(p).toContain("comprueba el total");
    // prioriza un macro, deja el resto; niega «clavar los números» explícitamente
    expect(p).toContain("Cierra como mucho el macro que de verdad importe");
    expect(p).toContain("no persigas «clavar los números» a costa de pasarte de kcal");
  });

  it("asesor de solo lectura: no reclama borrar/guardar el registro (principio 7, iter dev nº4)", () => {
    const p = chatSystemPrompt(chatArgs);
    // caza el «Borro la cena que tenías registrada»: el chat es read-only
    expect(p).toContain("de solo lectura");
    expect(p).toContain("no puedes añadir, borrar ni modificar su registro");
    expect(p).toContain("nunca digas que «borras»");
    // «olvida X» → ignorar solo en el chat, sin tocar el registro
    expect(p).toContain("la ignoro para el cálculo");
  });
});

// ── F05 Fase 1 · grounding web condicionado al flag `chatWebSearch` (AC5/5b) ──
// El párrafo de comer-fuera se añade por interpolación SOLO cuando `webSearch`
// está ON; OFF (o sin pasar el flag) = prompt idéntico a la Fase 0. La tool
// `googleSearch` de la route va atada al MISMO flag (revisión de la route). El
// disparo automático y la cita en el TEXTO son DECISIONS #63.
describe("F05 Fase 1 · párrafo web condicionado al flag (AC5/5b)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };

  it("AC5: con webSearch ON el prompt lleva el párrafo de comer-fuera (buscar/cita/estimación/no-registro)", () => {
    const p = chatSystemPrompt({ ...chatArgs, webSearch: true });
    // Iteración 16-jul (AC2): buscar primero y dar el dato con fuente, no desviar
    // a la pauta; y NUNCA macros confiados sin citar o marcar estimación.
    expect(p).toContain("BÚSCALO en la web");
    expect(p).toContain("citando la fuente");
    expect(p).toContain("no sustituyas el producto por una opción de su plan");
    expect(p).toContain("marca la cifra como estimación");
    expect(p).toContain(
      "NUNCA des macros concretos de un producto de fuera con seguridad sin citar la fuente o sin marcarlos como estimación",
    );
    // Iteración 16-jul (validación #2): la fuente web (Open Food Facts) trae el
    // dato flojo → tratar fuentes colaborativas como orientativas y ser honesto
    // cuando no está la variante exacta (fallo elegante, no dar otra por la suya).
    expect(p).toContain("Open Food Facts");
    expect(p).toContain("si no encuentras la variante EXACTA");
    expect(p).toContain("ORIENTATIVAS para decidir, NO un registro");
  });

  it("AC5b: con webSearch OFF (o sin pasar el flag) NO lleva el párrafo web (idéntico a Fase 0)", () => {
    const off = chatSystemPrompt({ ...chatArgs, webSearch: false });
    const undef = chatSystemPrompt(chatArgs);
    expect(off).not.toContain("BÚSCALO en la web");
    expect(undef).not.toContain("BÚSCALO en la web");
    // OFF y sin flag son byte-idénticos: el freno de coste vuelve a la Fase 0.
    expect(off).toBe(undef);
  });

  it("no toca el resto del contrato (C1-C9 intactos con web ON)", () => {
    const p = chatSystemPrompt({ ...chatArgs, webSearch: true });
    expect(p).toContain("criterio REALISTA");
    expect(p).toContain("las opciones de cada comida son ALTERNATIVAS, no las apiles");
    expect(p).toContain("Sugieres, no prescribes.");
  });
});

// ── F12 · Chat afinado con 11 días de uso real (batería canónica) ──
// Los AC1/2/3/5 los valida Alex en vivo (🖐); estos tests son la red de regresión
// determinista del builder. Cada caso real del export entra con su OPUESTO canónico
// (lección: "todo arreglo IA termina en caso canónico"; AC10).
describe("F12 · producto de marca → Mis productos primero (AC1, caso Lidl 16-jul)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };
  // Etiqueta real del brik: 37 kcal · 0,6P/3C/2F por 100 ml.
  const gazpacho: ProductDTO = {
    id: 1,
    name: "Gazpacho Lidl",
    baseG: 100,
    baseKcal: 37,
    baseProt: 0.6,
    baseCarb: 3,
    baseFat: 2,
    grupo: null,
    source: "etiqueta",
    unit: "ml",
    pinned: false,
  };

  it("productsContext formatea nombre, base/unidad, macros con 1 decimal y origen", () => {
    const c = productsContext([gazpacho]);
    expect(c).toContain("Gazpacho Lidl: 100 ml = 37 kcal · 0,6P/3C/2F (etiqueta)");
  });

  it("productsContext vacío no añade la sección al prompt (la línea de jerarquía sí queda)", () => {
    expect(productsContext([])).toBe("");
    const p = chatSystemPrompt({ ...chatArgs, products: "" });
    // Sin catálogo no hay SECCIÓN de datos…
    expect(p).not.toContain("MIS PRODUCTOS (catálogo de Alex");
    // …pero la instrucción de consultar Mis productos primero sigue presente.
    expect(p).toContain("consulta PRIMERO MIS PRODUCTOS");
  });

  it("el prompt fija la jerarquía de fuentes: Mis productos → web citada → estimación + etiqueta", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("consulta PRIMERO MIS PRODUCTOS");
    // No pasar otra variante/memoria como la etiqueta exacta (el fallo del 16-jul).
    expect(p).toContain("no des los macros de otra variante");
    expect(p).toContain("como si fueran su etiqueta exacta");
    // Cuando no está: estimación declarada + pedir la etiqueta.
    expect(p).toContain("pídele la etiqueta");
    expect(p).toContain("Lidl, Hacendado, Mercadona");
  });

  it("opuesto canónico: si el producto SÍ está en el catálogo, su etiqueta viaja como dato exacto", () => {
    const p = chatSystemPrompt({ ...chatArgs, products: productsContext([gazpacho]) });
    expect(p).toContain("MIS PRODUCTOS (catálogo de Alex");
    expect(p).toContain("Gazpacho Lidl: 100 ml = 37 kcal · 0,6P/3C/2F");
    expect(p).toContain("úsalos como su etiqueta guardada");
  });
});

describe("F12 · integridad del registro (AC2, caso cena 16-jul) y outlier del reloj (AC3, HRV 22-jul)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };
  const coachArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    targetDate: TODAY,
    mode: "hoy" as const,
    kcal: 1800,
    prot: 110,
    carb: 200,
    fat: 60,
    dayContext: "Comidas: ninguna registrada aún.",
    planPendiente: "",
  };

  it("AC2: «olvida la cena» → modo hipotético, nunca reclama una mutación («borro tu cena»)", () => {
    const p = chatSystemPrompt(chatArgs);
    // El chat es read-only: ignora en el cálculo, la comida sigue guardada.
    expect(p).toContain("la ignoro para el cálculo");
    expect(p).toContain("sigue guardada en tu registro");
    expect(p).toContain('nunca digas que «borras», «guardas» ni «registras»');
  });

  it("AC3: el chat hereda el guardarraíl de outlier del reloj (194 vs base 50-80 = artefacto)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("probable artefacto de medición");
    expect(p).toContain("recuperación extrema");
  });

  it("AC3 (Impacto §Coach): el coach hereda el MISMO guardarraíl del reloj", () => {
    const p = coachPrompt(coachArgs);
    expect(p).toContain("probable artefacto de medición");
    // Sigue heredando la fuente única completa (no divergió al añadir el 5º).
    expect(p).toContain(sharedGuardrails());
  });
});

describe("F12 · guardado de producto: oferta y confirmación en el prompt (AC4/AC5)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };

  it("el prompt define el formato de la línea-ficha y la pregunta literal, y prohíbe auto-guardarse", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("Producto: NOMBRE · BASE UNIDAD · KCAL kcal · PROTP · CARBC · GRASAF");
    expect(p).toContain("¿Te lo guardo en Mis productos?");
    expect(p).toContain("NO afirmes que lo has guardado");
    expect(p).toContain("SOLO si Alex lo confirma en el SIGUIENTE mensaje");
    // Solo con etiqueta real, nunca con una estimación.
    expect(p).toContain("nunca con una estimación");
  });

  it("read-only del REGISTRO con la ÚNICA excepción de Mis productos (no contradice AC2)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).toContain("La ÚNICA excepción es guardar un producto en Mis productos");
    // AC2 intacto: sigue sin reclamar mutaciones del registro.
    expect(p).toContain('nunca digas que «borras», «guardas» ni «registras» una comida');
  });

  it("sin guardado en este turno, el prompt NO afirma un guardado (savedLine ausente)", () => {
    const p = chatSystemPrompt(chatArgs);
    expect(p).not.toContain("YA GUARDADO POR EL SISTEMA");
  });

  it("cuando el servidor ya guardó, el modelo solo narra el hecho (no vuelve a ofrecer)", () => {
    const p = chatSystemPrompt({
      ...chatArgs,
      justSavedProduct: "Gazpacho Lidl (100 ml · 37 kcal · 0,6P/3C/2F), creado",
    });
    expect(p).toContain("YA GUARDADO POR EL SISTEMA");
    expect(p).toContain("Gazpacho Lidl (100 ml · 37 kcal · 0,6P/3C/2F), creado");
    expect(p).toContain("no lo ofrezcas de nuevo");
  });
});

describe("F12 · prompt de título (AC7)", () => {
  it("pide 4-6 palabras, sin comillas ni preámbulos, e incluye el intercambio", () => {
    const p = chatTitlePrompt("¿cuánto arroz me falta?", "Te faltan ~40 g de arroz.");
    expect(p).toContain("4 a 6 palabras");
    expect(p).toContain("Sin comillas");
    expect(p).toContain("Devuelve SOLO el título");
    expect(p).toContain("¿cuánto arroz me falta?");
    expect(p).toContain("Te faltan ~40 g de arroz.");
  });
});

describe("planSummary lleva los macros de cada opción (DECISIONS #56)", () => {
  it("cada opción del plan incluye kcal + P/C/F, no solo nombre y gramos", () => {
    const targets = {
      kcal: 1800,
      prot: 110,
      carb: 215,
      fat: 55,
      carbDerived: false,
      fatDerived: false,
    };
    const opts: PlanOptionDTO[] = [
      {
        id: 1,
        meal: "cena",
        grp: "Proteína",
        name: "Carne magra",
        baseG: 210,
        kcal: 231,
        prot: 46,
        carb: 0,
        fat: 5,
        variants: [],
        sort: 0,
      },
    ];
    const s = planSummary(targets, { cena: opts });
    // Sin macros el chat no puede proyectar el día → el bug de #56. Con macros sí.
    expect(s).toContain("Carne magra 210 g = 231 kcal · 46P/0C/5F");
    expect(s).toContain("SÍ figuran en tus datos");
  });
});
