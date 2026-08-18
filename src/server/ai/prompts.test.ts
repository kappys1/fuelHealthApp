import { describe, expect, it } from "vitest";
import { weekdayName } from "@/lib/dates";
import { DEFAULT_TRAINING_BY_WEEKDAY } from "@/lib/training-slot";
import {
  type AthleteProfile,
  DEFAULT_ATHLETE_PROFILE,
  type Lesion,
} from "@/lib/profile";
import type { DatedEntry, DayView } from "@/server/db/queries/day";
import type { PlanOptionDTO } from "@/server/db/queries/plan";
import type { MarkDTO } from "@/server/db/queries/marks";
import type { DeficitResult } from "@/server/analytics/deficit";
import type { DailyRecord } from "@/server/analytics/types";
import { energyBalance } from "@/server/analytics/energyBalance";
import { gaugeVerdict } from "@/server/analytics/gaugeVerdict";
import type { TrainingTiming } from "@/server/analytics/dayClosure";
import {
  closureLine,
  dayContext,
  dayLine,
  dayLines,
  energyBalanceLine,
  gaugeVerdictLine,
  marksContext,
  pendingPlanOptions,
  planSummary,
  productsContext,
  recentMealsDetail,
  realFlexibleReviewLine,
  trainingWeekContext,
  trajectoryLine,
  trendAndAdherence,
  trendJudgeLine,
  trendSummary,
} from "./context";
import type {
  TrainingSessionWithDay,
  TrainingWeekView,
} from "@/server/db/queries/training";
import type { ProductDTO } from "@/server/db/queries/lookups";
import {
  ADAPT_SESSION_MAX_OUTPUT_TOKENS,
  adaptSessionPrompt,
  athleteContext,
  athleteContextCompact,
  chatSummaryPrompt,
  chatSystemPrompt,
  chatTitlePrompt,
  coachPrompt,
  dayDumpPrompt,
  planOptionsList,
  planOptionPrompt,
  photoPrompt,
  prepareVisitPrompt,
  sharedGuardrails,
  trainingFormatPrompt,
  trainingImportPrompt,
  wodPrompt,
} from "./prompts";

/*
  ATHLETE_CONTEXT dinámico + guardarraíles del coach (doc 10 A2/A3/A4). Todo esto
  es interpolación pura (sin IA ni BD) → testeable directamente.
*/

const TODAY = "2026-07-12";
/** F22: ventana canónica que todo `DeficitResult` declara ya en el propio dato. */
const WINDOW_30 = {
  windowDays: 30,
  windowFrom: "2026-06-13",
  windowTo: TODAY,
  widened: false,
} as const;

describe("F17 · contratos congelados de entreno", () => {
  it("F-IA-5 pide el tipo exacto y no regenera el WOD pegado", () => {
    const wod = "Fuerza: Snatch\nCrossFit: 5 rondas";
    const prompt = wodPrompt(wod, "Atleta dinámico.");
    expect(prompt).toContain(wod);
    expect(prompt).toContain(
      "fuerza, halterofilia, gimnasticos, metabolico, aerobico, mixto, descanso, otro",
    );
    expect(prompt).toContain('"tipo": string');
    expect(prompt).not.toContain('"contenido"');
  });

  it("F-IA-10 exige contenido completo, fiel, ordenado y separado por bloques", () => {
    const prompt = trainingImportPrompt(
      "Atleta dinámico.",
      "Lunes: fuerza\nMartes: carrera",
    );
    expect(prompt).toContain("contenido COMPLETO");
    expect(prompt).toContain("todos los bloques relevantes");
    expect(prompt).toContain("saltos de línea");
    expect(prompt).not.toContain("contenido resumido");
  });

  // El quick-fix del 7-ago identificó el contrato de separación como la causa raíz
  // y cambió la redacción, pero no la ancló aquí: revertir a "separa los bloques con
  // saltos de línea" pasaba en verde. La spec 17 pide `prompts.ts` + `prompts.test.ts`.
  it("F-IA-10 exige LÍNEA EN BLANCO entre bloques y unir los renglones envueltos", () => {
    const prompt = trainingImportPrompt("Atleta dinámico.", "Lunes: fuerza");

    expect(prompt).toContain("separa CADA bloque del siguiente con una LÍNEA EN BLANCO");
    expect(prompt).toContain("dos saltos de línea seguidos");
    expect(prompt).toContain("saltos de línea simples solo para las líneas de un mismo bloque");
    expect(prompt).toContain("ÚNELA en una sola línea");
    expect(prompt).toContain("nunca el final de un renglón");
  });
});

describe("F25 · el formateador solo marca rótulos (contrato mínimo)", () => {
  const contenido = "Power Clean + Power Jerk\nPower Clean\nMantener normal.";

  it("manda el contenido tal cual y pide el MISMO texto de vuelta", () => {
    const prompt = trainingFormatPrompt(contenido);
    expect(prompt).toContain(contenido);
    expect(prompt).toContain("RÓTULOS DE GRUPO");
    expect(prompt).toContain("Devuelve el MISMO texto, carácter por carácter");
    expect(prompt).toContain('{"contenido": string}');
  });

  // El valor de esta feature depende de que el modelo NO haga nada más. Las
  // prohibiciones son el prompt; la garantía es applyTrainingFormat.
  it("prohíbe explícitamente todo lo que no sea envolver una línea completa", () => {
    const prompt = trainingFormatPrompt(contenido);
    expect(prompt).toContain("no añadas, quites ni cambies una sola palabra");
    expect(prompt).toContain("no reordenes nada");
    expect(prompt).toContain("no resumas, reescribas ni traduzcas");
    expect(prompt).toContain("incluidas las líneas en blanco que separan bloques");
    expect(prompt).toContain("no envuelvas nada a mitad de línea, solo líneas completas");
  });

  it("no marca el rótulo de sección (ya se destaca solo) y admite cero grupos", () => {
    const prompt = trainingFormatPrompt(contenido);
    expect(prompt).toContain("no marques la línea que es el nombre de la sección");
    expect(prompt).toContain("devuelve el texto exactamente igual sin marcar nada");
  });

  // No es una estimación: no viaja ni contexto de atleta ni pauta. Si algún día
  // alguien se lo añade "para que entienda mejor", esto lo caza.
  it("no arrastra contexto de atleta: es una transformación de texto", () => {
    const prompt = trainingFormatPrompt(contenido);
    expect(prompt).not.toContain("kcal");
    expect(prompt).not.toContain("nutricionista");
  });
});

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
    expect(full).not.toContain("19:30");
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

/*
  F26 Fase 2 · adaptar la sesión del día. El riesgo de esta feature no es que el
  modelo no adapte: es que **sobre-frene** (spec 26 §1). Los tests fijan las
  cláusulas que lo sujetan y que el motivo NO tiene por qué ser una lesión (AC7).
*/
describe("F26 · adaptSessionPrompt", () => {
  const base = {
    atleta: "Atleta: CrossFit avanzado, 33 años.",
    fecha: "2026-08-18",
    nombre: "T3 · Fuerza + Gimnásticos",
    planificada: "**Fuerza**\nPress militar 5x5\n\n**WOD**\n21-15-9 pull-ups",
  };

  it("manda la planificada literal, el motivo y la capacidad", () => {
    const prompt = adaptSessionPrompt({
      ...base,
      motivo: "hombro derecho",
      capacidad: "NO por encima de cabeza. SÍ tirón horizontal, pierna.",
    });
    expect(prompt).toContain(base.planificada);
    expect(prompt).toContain("«T3 · Fuerza + Gimnásticos»");
    expect(prompt).toContain("adaptarla por este motivo: hombro derecho");
    expect(prompt).toContain("NO por encima de cabeza");
    expect(prompt).toContain("2026-08-18");
  });

  /*
    La regla que sujeta el fallo real del 18-ago (DECISIONS #100): el default
    ante la duda es MANTENER, y no depende de que la capacidad autorice nada —
    que es justo donde falló la primera redacción con una capacidad descriptiva.
  */
  it("ante la duda MANTIENE, sin depender de que la capacidad lo autorice", () => {
    const prompt = adaptSessionPrompt({ ...base, motivo: "x", capacidad: "y" });
    expect(prompt).toContain("Ante la duda, MANTÉN el ejercicio");
    expect(prompt).toContain("se mantiene por defecto");
    expect(prompt).toContain("Quitar de más es el fallo más caro");
    expect(prompt).not.toContain("permite explícitamente");
  });

  it("adapta ejercicio por ejercicio: el bloque conserva su objetivo", () => {
    const prompt = adaptSessionPrompt({ ...base, motivo: "x", capacidad: "y" });
    expect(prompt).toContain("NO rediseñas la sesión");
    expect(prompt).toContain("Cada bloque conserva su objetivo");
    expect(prompt).toContain("NO se extiende a lo que no la carga");
  });

  it("no rebaja el día", () => {
    const prompt = adaptSessionPrompt({ ...base, motivo: "x", capacidad: "y" });
    expect(prompt).toContain("adaptar no es rebajar el día");
    expect(prompt).toContain("no lo elimines dejando el día más corto");
  });

  /*
    Regresión del 18-ago: con 4096 la adaptación salía truncada a media frase en
    cuanto el motivo era largo. El thinking de Gemini sale de `maxOutputTokens` y
    aquí se reescribe una sesión entera (#48/#52/#59, ahora #100).
  */
  it("el techo de salida supera el que ya se demostró insuficiente (4096)", () => {
    expect(ADAPT_SESSION_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(8192);
  });

  it("notas en español y nombres de ejercicio en su idioma, sin markdown", () => {
    const prompt = adaptSessionPrompt({ ...base, motivo: "x", capacidad: "y" });
    expect(prompt).toContain("Escribe en ESPAÑOL **todas** las notas");
    expect(prompt).toContain("también las que no cambies");
    expect(prompt).toContain("Los NOMBRES de los ejercicios se dejan tal cual");
    expect(prompt).toContain("NO uses asteriscos");
  });

  it("hereda el guardarraíl de F21: ni diagnostica ni trata", () => {
    const prompt = adaptSessionPrompt({ ...base, motivo: "x", capacidad: "y" });
    expect(prompt).toContain("NO diagnostiques");
    expect(prompt).toContain("ni des consejo médico");
    // Un nombre clínico en el motivo («supraespinoso») disparó el sobre-frenado.
    expect(prompt).toContain("Un nombre clínico en el motivo");
  });

  it("un motivo que no es lesión funciona igual y sin bloque de capacidad (AC7)", () => {
    const prompt = adaptSessionPrompt({
      ...base,
      motivo: "solo tengo 40 minutos",
      capacidad: "   ",
    });
    expect(prompt).toContain("adaptarla por este motivo: solo tengo 40 minutos");
    expect(prompt).not.toContain("Lo que hoy PUEDE y NO PUEDE hacer");
  });

  it("pide texto plano con la misma forma: es lo que entra en el composer", () => {
    const prompt = adaptSessionPrompt({ ...base, motivo: "x", capacidad: "" });
    expect(prompt).toContain("separados por una línea en blanco");
    expect(prompt).toContain("Responde SOLO con el texto de la sesión adaptada");
    expect(prompt).not.toContain("JSON");
  });
});

/*
  F26 Fase 1 · la ranura {lesiones?} lleva CAPACIDAD, no zonas. La plantilla no
  cambia (sigue congelada): cambia el valor que se interpola. AC1 (el Chat conoce
  la capacidad en un hilo nuevo) y AC2 (la cerrada sale del contexto).
*/
describe("F26 · lesión vigente en el contexto de atleta", () => {
  const hombro: Lesion = {
    id: "l1",
    zona: "hombro derecho",
    capacidad:
      "NO: nada por encima de cabeza, press, kipping, snatch. SÍ: tirón horizontal, remo, peso muerto, pierna, cardio sin brazos.",
    desde: "2026-07-28",
    revisarEl: "2026-08-11",
  };
  const withLesiones = (lesiones: Lesion[]): AthleteProfile => ({
    ...DEFAULT_ATHLETE_PROFILE,
    lesiones,
  });

  it("la vigente entra con su capacidad completa y su fecha de inicio (AC1)", () => {
    const full = athleteContext(withLesiones([hombro]), 92, 6, TODAY);
    expect(full).toContain("Lesiones vigentes: hombro derecho (desde 2026-07-28)");
    expect(full).toContain("nada por encima de cabeza");
    expect(full).toContain("SÍ: tirón horizontal");
  });

  it("la cerrada NO entra en el contexto (AC2)", () => {
    const full = athleteContext(
      withLesiones([{ ...hombro, cerradaEl: "2026-08-15" }]),
      92,
      6,
      TODAY,
    );
    expect(full).not.toContain("hombro");
    expect(full).not.toContain("Lesiones vigentes");
  });

  it("sin lesiones vigentes no aparece la frase (contexto y coste de hoy)", () => {
    expect(athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY)).not.toContain(
      "Lesiones",
    );
  });

  it("un chip migrado sin capacidad entra solo con la zona, sin inventar nada", () => {
    const full = athleteContext(
      withLesiones([
        { id: "legacy-0", zona: "fascitis plantar", capacidad: "", desde: null, revisarEl: TODAY },
      ]),
      92,
      6,
      TODAY,
    );
    expect(full).toContain("Lesiones vigentes: fascitis plantar.");
    expect(full).not.toContain("capacidad:");
    expect(full).not.toContain("fascitis plantar (desde");
  });

  it("varias vigentes se separan sin confundirse con el texto de capacidad", () => {
    const full = athleteContext(
      withLesiones([
        hombro,
        { id: "l2", zona: "rodilla", capacidad: "NO saltos.", desde: "2026-08-01", revisarEl: "2026-08-15" },
      ]),
      92,
      6,
      TODAY,
    );
    // Las más recientes primero, separadas por " | " (el "; " vive dentro de la
    // capacidad y confundiría los límites de cada episodio).
    expect(full).toContain(
      "Lesiones vigentes: rodilla (desde 2026-08-01) — capacidad: NO saltos. | hombro derecho (desde 2026-07-28)",
    );
    expect(full).toMatch(/cardio sin brazos\.(?!\.)/); // sin punto duplicado
  });
});

/*
  F22 · Fase 1 — las etiquetas de ventana dejan de mentir. Antes `trendJudgeLine`
  decía «(báscula, 7 d)» sobre una pendiente medida en el histórico entero y el
  comentario de `trendAndAdherence` prometía «mismas cifras que la pantalla»
  mientras la pantalla usaba el rango del selector.
*/
describe("F22 · el contexto declara la ventana REAL de la cifra que manda", () => {
  const base: DeficitResult = {
    enough: true,
    weighins: 22,
    spanDays: 29,
    kgPerWeek: -0.2,
    deficitKcal: 220,
    intakeMean: 1979,
    tdee: 2199,
    ...WINDOW_30,
  };

  it("el juez del Coach nombra la ventana canónica, no «7 d»", () => {
    const line = trendJudgeLine(base);
    expect(line).toContain("30 d");
    expect(line).toContain("2026-06-13 → 2026-07-12");
    expect(line).toContain("22 pesajes");
    expect(line).not.toMatch(/báscula, 7 d/);
  });

  it("declara la ampliación a 90 d en vez de fingir la canónica", () => {
    const widened = trendJudgeLine({
      ...base,
      windowDays: 90,
      windowFrom: "2026-04-14",
      widened: true,
    });
    expect(widened).toContain("90 d");
    expect(widened).toContain("ampliada desde 30 d");
  });

  it("sin tendencia fiable sigue declarando de qué ventana habla", () => {
    const line = trendJudgeLine({
      ...base,
      enough: false,
      weighins: 3,
      kgPerWeek: null,
      deficitKcal: null,
    });
    expect(line).toContain("aún sin tendencia fiable");
    expect(line).toContain("30 d");
  });

  it("trendSummary (Visita) cierra con la misma ventana", () => {
    expect(trendSummary(base)).toContain("ventana de 30 d");
  });
});

describe("F22 · trayectoria mensual en Chat y Visita", () => {
  const months = [
    { monthKey: "2026-07", label: "jul", kgPerWeek: -0.2, deficitKcal: 220, weighins: 22 },
    { monthKey: "2026-06", label: "jun", kgPerWeek: -0.31, deficitKcal: 341, weighins: 28 },
    { monthKey: "2026-05", label: "may", kgPerWeek: -0.15, deficitKcal: 165, weighins: 25 },
  ];

  it("narra los meses cerrados en orden y con signo", () => {
    const line = trajectoryLine({ months, enough: true });
    expect(line).toContain("jul −0,20 kg/semana");
    expect(line).toContain("jun −0,31 kg/semana");
    expect(line).toContain("may −0,15 kg/semana");
    expect(line).toContain("sin solape");
  });

  it("un mes sin muestra se narra como insuficiente, nunca estimado", () => {
    const line = trajectoryLine({
      months: [
        months[0]!,
        { monthKey: "2026-06", label: "jun", kgPerWeek: null, deficitKcal: null, weighins: 4 },
        months[2]!,
      ],
      enough: true,
    });
    expect(line).toContain("jun — (solo 4 pesajes, insuficiente)");
    expect(line).not.toContain("jun −");
  });

  it("con <2 meses válidos no viaja ninguna línea al prompt", () => {
    expect(trajectoryLine({ months: [], enough: false })).toBe("");
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
      ...WINDOW_30,
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
      unit: "g",
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

  it("F19: planOptionsList rotula la ración con la unidad real", () => {
    const lista = planOptionsList([{ ...opts[0]!, unit: "ml" }]);
    expect(lista).toContain("150 ml");
    expect(lista).not.toContain("150 g →");
  });

  it("F16 pre-pizza: una cena prevista no expone pavo ni fuerza cerrar el hueco", () => {
    const pendiente = pendingPlanOptions({ cena: opts }, []);
    const verdict = gaugeVerdict(
      { kcal: 1800, prot: 110, carb: 215, fat: 55 },
      { kcal: 992, prot: 55, carb: 103, fat: 39 },
      null,
    );
    const directriz = closureLine({
      stance: "deficit",
      verdict,
      timing: { rel: "tarde" },
      plannedFlexibleMeals: ["cena"],
    });

    expect(pendiente).not.toContain("Pavo");
    expect(directriz).toContain("FLEXIBLE PREVISTO");
    expect(directriz).toContain("comida o la merienda");
    expect(directriz).toContain("NO intentes cerrar");
    expect(directriz).not.toContain("proteína magra");
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

describe("F16 · contexto IA flexible", () => {
  const targets = { kcal: 1800, prot: 110, carb: 215, fat: 55 };
  const record = (
    date: string,
    flexibleMeals: DailyRecord["flexibleMeals"],
  ): DailyRecord => ({
    date,
    logged: true,
    kcal: 1800,
    prot: 110,
    carb: 215,
    fat: 55,
    weight: null,
    phase: null,
    target: { kcal: 1800, prot: 110 },
    flexibleMeals,
    steps: null,
    activeKcal: null,
    basalKcal: null,
    hrvMs: null,
    sleepH: null,
    restingHr: null,
    bodyFatPct: null,
    waterL: null,
    sessionLabel: null,
    bloat: null,
    notes: null,
  });

  it("Coach ve prevista y real con directrices distintas", () => {
    const planned: DayView = {
      date: TODAY,
      day: null,
      health: null,
      session: null,
      entries: [],
      flexibleMeals: { planned: ["cena"], real: [] },
    };
    expect(dayContext(planned)).toContain("Cena flexible prevista");
    expect(dayContext(planned)).toContain("kcal aún desconocidas");

    const real: DayView = {
      ...planned,
      entries: [
        {
          id: 1,
          meal: "cena",
          name: "Pizza",
          kcal: 1448,
          prot: 64,
          carb: 170,
          fat: 55,
          source: "manual",
          photoUrl: null,
          grams: null,
          unit: "g",
          baseG: null,
          baseKcal: null,
          baseProt: null,
          baseCarb: null,
          baseFat: null,
          createdAt: "2026-07-12T21:00:00.000Z",
        },
      ],
      flexibleMeals: { planned: [], real: ["cena"] },
    };
    const ctx = dayContext(real);
    expect(ctx).toContain("Cena flexible real");
    expect(ctx).toContain("kcal sí cuentan");
    expect(ctx).toContain("no prescribas compensación");
  });

  it("post-pizza conserva 2440/119P/273C/94F y no ordena compensar", () => {
    const verdict = gaugeVerdict(
      targets,
      { kcal: 2440, prot: 119, carb: 273, fat: 94 },
      null,
      true,
    );
    const line = gaugeVerdictLine(verdict, {
      faseLabel: "Normal",
      sessionLabel: "día de entreno: T6",
    });
    const closure = closureLine({
      stance: "deficit",
      verdict,
      timing: { rel: "tarde" },
    });
    expect(line).toContain("kcal +640");
    expect(line).toContain("contexto flexible real");
    expect(closure).toContain("NO compenses");
    expect(closure).not.toContain("EXCESO");
  });

  it("post-pizza en modo ayer recibe valoración sin causalidad ni compensación", () => {
    const flexible = gaugeVerdict(
      targets,
      { kcal: 2440, prot: 119, carb: 273, fat: 94 },
      null,
      true,
    );
    const regular = gaugeVerdict(
      targets,
      { kcal: 2440, prot: 119, carb: 273, fat: 94 },
      null,
      false,
    );
    const line = realFlexibleReviewLine(flexible);
    expect(line).toContain("2440 kcal/119P/273C/94F");
    expect(line).toContain("peso, HRV, hinchazón ni rendimiento puntual");
    expect(line).toContain("NO compenses");
    expect(line).toContain("nunca «cena libre»");
    expect(realFlexibleReviewLine(regular)).toBe("");
  });

  it("sin marcador conserva la directriz actual y permite opción del plan", () => {
    const verdict = gaugeVerdict(
      targets,
      { kcal: 992, prot: 55, carb: 103, fat: 39 },
      null,
    );
    const line = closureLine({
      stance: "deficit",
      verdict,
      timing: { rel: "tarde" },
    });
    expect(line).toContain("PROTEÍNA PRIORITARIA");
    expect(line).toContain("opciones del plan pendientes");
  });

  it("Chat ve prevista solo hoy; histórico y Visita solo etiquetan reales", () => {
    const yesterday = record("2026-07-11", {
      planned: ["cena"],
      real: [],
    });
    const today = record(TODAY, { planned: ["cena"], real: [] });
    const current = dayLines([yesterday, today], 30, {
      trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
      today: TODAY,
      includeCurrentPlannedFlexible: true,
    });
    const visit = dayLines([yesterday, today], 30, {
      trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
      today: TODAY,
    });
    expect(current).toContain("Cena flexible prevista");
    expect(current.match(/flexible prevista/g)).toHaveLength(1);
    expect(visit).not.toContain("flexible prevista");

    const real = record("2026-07-11", { planned: [], real: ["cena"] });
    expect(dayLine(real)).toContain("Cena flexible");
  });

  it("Chat usa patrón solo hoy; el histórico/Visita exige franja explícita", () => {
    const historical = {
      ...record("2026-07-11", { planned: [], real: [] }),
      sessionLabel: "WOD histórico",
      sessionFranja: null,
    };
    const today = {
      ...record(TODAY, { planned: [], real: [] }),
      sessionLabel: "WOD de hoy",
      sessionFranja: null,
    };
    const lines = dayLines([historical, today], 30, {
      trainingByWeekday: {
        ...DEFAULT_TRAINING_BY_WEEKDAY,
        "7": "mañana",
      },
      today: TODAY,
    });
    expect(lines).toContain("WOD de hoy · franja mañana (patrón habitual)");
    expect(lines).toContain("WOD histórico");
    expect(lines).not.toContain("WOD histórico · franja");

    const explicit = {
      ...historical,
      sessionFranja: "tarde" as const,
    };
    expect(
      dayLines([explicit], 30, {
        trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
        today: TODAY,
      }),
    ).toContain("WOD histórico · franja tarde");
  });

  it("detalle histórico etiqueta solo el momento flexible real", () => {
    const entries: DatedEntry[] = [
      {
        date: "2026-07-11",
        meal: "cena",
        name: "Pizza",
        kcal: 900,
        prot: 30,
        carb: 100,
        fat: 40,
      },
      {
        date: TODAY,
        meal: "comida",
        name: "Arroz",
        kcal: 400,
        prot: 10,
        carb: 80,
        fat: 4,
      },
    ];
    const detail = recentMealsDetail(entries, [
      record("2026-07-11", { planned: [], real: ["cena"] }),
      record(TODAY, { planned: ["comida"], real: [] }),
    ]);
    expect(detail).toContain("[cena · Flexible] Pizza");
    expect(detail).toContain("[comida] Arroz");
    expect(detail).not.toContain("[comida · Flexible]");
  });

  it("Chat recibe el KPI precalculado solo con muestra suficiente", () => {
    const deficit: DeficitResult = {
      enough: false,
      weighins: 0,
      spanDays: 0,
      kgPerWeek: null,
      deficitKcal: null,
      intakeMean: null,
      tdee: null,
      ...WINDOW_30,
    };
    const adherence = {
      windowDays: 14,
      n: 14,
      kcalN: 11,
      proteinN: 14,
      flexibleN: 3,
      flexibleMoments: 3,
      specialN: 0,
      enRango: 8,
      protOk: 12,
      kcalPct: 72.7,
      protPct: 85.7,
    };
    const line = trendAndAdherence(deficit, adherence, {
      windowDays: 28,
      flexibleDays: 3,
      flexibleMoments: 3,
      regularDays: 7,
      flexibleMeanKcal: 2200,
      regularMeanKcal: 1800,
      flexibleMeanTargetPct: 122.2,
      regularMeanTargetPct: 100,
      differenceObservedKcal: 400,
      differenceObservedPct: 22.2,
      enoughForComparison: true,
    });
    expect(line).toContain("KPI flexible precalculado");
    expect(line).toContain("≈+400 kcal");
    expect(line).toContain("n=3");
    expect(line).toContain("n=7");
    expect(
      trendAndAdherence(deficit, adherence, {
        windowDays: 28,
        flexibleDays: 2,
        flexibleMoments: 2,
        regularDays: 7,
        flexibleMeanKcal: 2200,
        regularMeanKcal: 1800,
        flexibleMeanTargetPct: 122.2,
        regularMeanTargetPct: 100,
        differenceObservedKcal: 400,
        differenceObservedPct: 22.2,
        enoughForComparison: false,
      }),
    ).not.toContain("KPI flexible precalculado");
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
    flexibleMeals: { planned: [], real: [] },
    session: null,
  };

  it("sin sesión registrada emite la que toca según el calendario semanal", () => {
    // 2026-07-12 es domingo (ISO 7) → default = Descanso.
    const ctx = dayContext(emptyView, {
      trainingByWeekday: DEFAULT_TRAINING_BY_WEEKDAY,
      date: "2026-07-12",
    });
    expect(ctx).toContain("Sesión: sin registrar");
    expect(ctx).toContain("descanso");
  });

  it("sin calendario no inventa sesión", () => {
    const ctx = dayContext(emptyView);
    expect(ctx).not.toContain("sin registrar");
  });

  it("F17: con WOD sustituto cita la sesión canónica, nunca la referencia antigua", () => {
    const ctx = dayContext({
      ...emptyView,
      day: {
        date: "2026-07-12",
        weight: null,
        waterL: null,
        bodyFatPct: null,
        sessionLabel: "Snatch + WOD",
        sessionKcal: 650,
        sessionRef: 7,
        phase: null,
        bloat: null,
        notes: null,
        adaptedSession: null,
        adaptedReason: null,
        adaptedAt: null,
      },
      session: {
        id: 7,
        key: "T2",
        nombre: "Snatch + WOD",
        tipo: "mixto",
        contenido: "Fuerza: Snatch\nCrossFit: 5 rondas",
        kcalMin: 500,
        kcalMax: 800,
        duracionMin: 75,
        programa: "The Progrm",
        etiqueta: "Week 30",
        source: "pdf",
        importRequestId: "request-1",
      },
    });
    expect(ctx).toContain("sesión Snatch + WOD · Mixto");
    expect(ctx).not.toContain("Training 2");
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
      ...WINDOW_30,
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
      ...WINDOW_30,
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
  const noTiming: TrainingTiming = { rel: "sin_dato" };

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

  it("timing: mañana vs tarde coloca la gasolina en momentos distintos", () => {
    const v = gaugeVerdict(T, { kcal: 1400, prot: 110, carb: 150, fat: 40 }, null); // carb rem 65
    const morning = closureLine({
      stance: "deficit",
      verdict: v,
      timing: { rel: "mañana" },
    });
    const afternoon = closureLine({
      stance: "deficit",
      verdict: v,
      timing: { rel: "tarde" },
    });
    expect(morning).toContain("desayuno o antes");
    expect(morning).toContain("no los traslades por defecto a la merienda");
    expect(afternoon).toContain("comida o la merienda");
    expect(morning).not.toEqual(afternoon);
  });

  it("descanso no da urgencia y sin_dato no afirma colocación temporal", () => {
    const v = gaugeVerdict(T, { kcal: 1400, prot: 110, carb: 150, fat: 40 }, null);
    expect(
      closureLine({
        stance: "deficit",
        verdict: v,
        timing: { rel: "descanso" },
      }),
    ).toContain("sin urgencia de timing");
    expect(
      closureLine({
        stance: "deficit",
        verdict: v,
        timing: { rel: "sin_dato" },
      }),
    ).toContain("no afirmes cuándo colocar");
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
    expect(p).toContain(
      "Si la sesión del día es por la mañana, coloca cualquier hidrato pre-entreno",
    );
    expect(p).toContain(
      "La franja solo decide dónde va la gasolina, no aumenta la cantidad ni obliga a rellenar",
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
        unit: "ml",
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
    expect(s).toContain("Carne magra 210 ml = 231 kcal · 46P/0C/5F");
    expect(s).toContain("SÍ figuran en tus datos");
  });
});

// ── F18 · Describir consulta «Mis productos» (prompt congelado) ──
describe("F18 · dayDumpPrompt inyecta MIS PRODUCTOS y pide identificar, no recalcular", () => {
  const catalogo = productsContext([
    {
      id: 1,
      name: "Bebida de almendras Lidl 0%",
      baseG: 250,
      baseKcal: 40,
      baseProt: 1.8,
      baseCarb: 0,
      baseFat: 3.5,
      grupo: null,
      source: "etiqueta",
      unit: "ml",
      pinned: false,
    },
  ]);

  it("con catálogo: sección MIS PRODUCTOS + identificar por nombre EXACTO + no recalcular", () => {
    const p = dayDumpPrompt("cafe con leche de almendra 0% lidl", 1800, 110, "CTX.", catalogo);
    expect(p).toContain("MIS PRODUCTOS (catálogo de Alex");
    expect(p).toContain("Bebida de almendras Lidl 0%: 250 ml = 40 kcal · 1,8P/0C/3,5F");
    // Identificación por nombre exacto, con producto:null si no coincide.
    expect(p).toContain("nombre EXACTO");
    expect(p).toContain('"producto": null');
    // No recalcular: solo identificar (diseño B; el servidor hace la aritmética).
    expect(p).toContain("NO recalcules sus macros");
    expect(p).toContain("solo identifícalo");
    // El nombre conserva la preparación; el canónico va SOLO en `producto` (#82).
    expect(p).toContain("NO copies ahí el nombre del producto");
    expect(p).toContain('ese va SOLO en "producto"');
    // El campo entra en el JSON de salida.
    expect(p).toContain('"producto":string|null');
  });

  it("AC3: catálogo vacío → omite la sección MIS PRODUCTOS (espejo de productsContext([]))", () => {
    const p = dayDumpPrompt("dos tostadas con aceite", 1800, 110, "CTX.", productsContext([]));
    expect(productsContext([])).toBe("");
    expect(p).not.toContain("MIS PRODUCTOS");
    expect(p).not.toContain("NO recalcules sus macros");
    // El resto del contrato F-IA-4 sigue intacto (troceo + gramos null).
    expect(p).toContain("Trocéalo en items de comida");
    expect(p).toContain("devuelve gramos: null");
    // El campo producto sigue en el JSON de salida (el schema lo espera siempre).
    expect(p).toContain('"producto":string|null');
  });
});

// ── F19 Fase 1 · ✨ del Plan consulta «Mis productos» (prompt congelado) ──
describe("F19 · planOptionPrompt identifica MIS PRODUCTOS y el servidor calcula", () => {
  const catalogo = productsContext([
    {
      id: 1,
      name: "Bebida de almendras Lidl 0%",
      baseG: 100,
      baseKcal: 16,
      baseProt: 0.72,
      baseCarb: 0,
      baseFat: 1.4,
      grupo: "Otros",
      source: "etiqueta",
      unit: "ml",
      pinned: false,
    },
  ]);

  it("AC1: reconoce semánticamente un producto dentro de una preparación y devuelve el canónico exacto", () => {
    const p = planOptionPrompt(
      "Café con leche con almendras 0%",
      250,
      "CTX.",
      catalogo,
    );

    expect(p).toContain("MIS PRODUCTOS (catálogo de Alex");
    expect(p).toContain(
      "Bebida de almendras Lidl 0%: 100 ml = 16 kcal · 0,7P/0C/1,4F",
    );
    expect(p).toContain("aunque el texto lo describa de otra forma");
    expect(p).toContain("forme parte de una preparación");
    // Caso real AC1: hay dos candidatos guardados —un café genérico estimado y
    // la bebida 0% de etiqueta—. Los rasgos específicos del ingrediente mandan.
    expect(p).toContain("rasgos MÁS ESPECÍFICOS");
    expect(p).toContain('marca, "0/0%"');
    expect(p).toContain("devuelve ESE ingrediente");
    // Péndulo contrario: sin rasgos de otro producto, la preparación completa
    // guardada sigue siendo una coincidencia válida.
    expect(p).toContain("NO aporta rasgos específicos de otro producto");
    expect(p).toContain("devuelve esa preparación");
    expect(p).toContain("nombre EXACTO");
    expect(p).toContain("NO recalcules sus macros");
    expect(p).toContain("solo identifícalo");
    expect(p).toContain('"producto": null');
    expect(p).toContain('"producto": string|null');
  });

  it("AC3: catálogo vacío omite MIS PRODUCTOS y conserva la estimación de tablas", () => {
    const p = planOptionPrompt(
      "Dos tostadas con aceite",
      80,
      "CTX.",
      productsContext([]),
    );

    expect(productsContext([])).toBe("");
    expect(p).not.toContain("MIS PRODUCTOS");
    expect(p).not.toContain("NO recalcules sus macros");
    expect(p).toContain("valores medios de tablas de composición (España)");
    expect(p).toContain('"producto": string|null');
  });
});

// ── F21 · El Chat lee y adapta el entreno alrededor de una limitación ──
// Contenido REAL de las sesiones de la SEMANA + bloque de comportamiento, ambos
// bajo intención (detectTrainingAdaptationIntent). Sin intención → prompt
// byte-idéntico a hoy (AC8; mismo patrón que el flag `webSearch`). Los AC de
// comportamiento (1-5) los valida Alex en vivo (🖐); estos tests del builder son la
// red de regresión determinista.
function sessionWithDay(
  over: Partial<TrainingSessionWithDay> &
    Pick<TrainingSessionWithDay, "nombre" | "contenido" | "assignedDate">,
): TrainingSessionWithDay {
  return {
    id: 1,
    planId: 1,
    key: "T",
    tipo: "fuerza",
    kcalMin: 400,
    kcalMax: 600,
    duracionMin: 60,
    franja: "mañana",
    sort: 0,
    // F26 Fase 2: el día puede traer adaptada; por defecto, no (F21 no la mira).
    adaptedSession: null,
    adaptedReason: null,
    adaptedAt: null,
    ...over,
  };
}
function weekOf(sessions: TrainingSessionWithDay[]): TrainingWeekView {
  return { sessions } as TrainingWeekView;
}

describe("F21 · trainingWeekContext (arreglo de DATO del bug de origen)", () => {
  // TODAY = 2026-07-12 (domingo); ayer = 2026-07-11 (sábado).
  const week = weekOf([
    sessionWithDay({
      id: 2,
      key: "T2",
      nombre: "Training 2",
      assignedDate: "2026-07-11",
      contenido: "A) Snatch 5x2\nB) Metcon: 21-15-9 thrusters",
    }),
    sessionWithDay({
      id: 3,
      key: "T3",
      nombre: "Training 3",
      tipo: "mixto",
      assignedDate: TODAY,
      contenido: "A) Back Squat 5x3 @80%\nB) Strict Press 4x6\nC) 3 rondas wall balls",
    }),
  ]);

  it("emite el CONTENIDO real de la sesión de HOY y la de AYER (mata el bug 28/29-jul)", () => {
    const ctx = trainingWeekContext(week, TODAY);
    // hoy
    expect(ctx).toContain("Training 3");
    expect(ctx).toContain("Back Squat 5x3 @80%");
    expect(ctx).toContain("· HOY");
    // ayer (el caso que fallaba en Fase 1)
    expect(ctx).toContain("Training 2");
    expect(ctx).toContain("Snatch 5x2");
    expect(ctx).toContain("thrusters");
    expect(ctx).toContain("· ya pasado");
    // ordenadas por fecha (ayer antes que hoy)
    expect(ctx.indexOf("Training 2")).toBeLessThan(ctx.indexOf("Training 3"));
  });

  // F25 · AC 12: los marcadores de grupo son pintura de la ficha. El Chat recibe
  // el MISMO texto que recibía antes de que existieran → F21 no se re-valida.
  it("entrega el contenido SIN los marcadores de grupo de F25", () => {
    const marcada = weekOf([
      sessionWithDay({
        id: 4,
        key: "T4",
        nombre: "Training 4",
        assignedDate: TODAY,
        contenido: "**Power Clean**\nMantener normal.\nHacer **5 × 2** al 40 %.",
      }),
    ]);
    const ctx = trainingWeekContext(marcada, TODAY);

    expect(ctx).toContain("Power Clean\nMantener normal.");
    expect(ctx).not.toContain("**Power Clean**");
    // El énfasis a mitad de línea venía en el texto de origen: se respeta.
    expect(ctx).toContain("Hacer **5 × 2** al 40 %.");
  });

  it("sin semana importada → lo dice, no inventa (AC6)", () => {
    expect(trainingWeekContext(null, TODAY)).toContain(
      "No hay ninguna sesión de entreno importada para esta semana",
    );
  });

  it("semana con sesiones pero sin sesión hoy → lo señala sin inventar (AC6)", () => {
    const noToday = weekOf([
      sessionWithDay({
        nombre: "Training 2",
        assignedDate: "2026-07-11",
        contenido: "A) Snatch 5x2",
      }),
    ]);
    const ctx = trainingWeekContext(noToday, TODAY);
    expect(ctx).toContain("Training 2");
    expect(ctx).toContain(`Hoy (${TODAY}) no tienes ninguna sesión asignada`);
  });
});

describe("F21 · chatSystemPrompt · bloque de adaptación (bajo intención)", () => {
  const chatArgs = {
    atleta: athleteContext(DEFAULT_ATHLETE_PROFILE, 92, 6, TODAY),
    today: TODAY,
    planSummary: "—",
    trendAdherence: "—",
    meds: "—",
    days30: "—",
  };
  const training = trainingWeekContext(
    weekOf([
      sessionWithDay({
        nombre: "Training 3",
        assignedDate: TODAY,
        contenido: "A) Back Squat 5x3",
      }),
    ]),
    TODAY,
  );

  it("con trainingContext: añade el bloque de comportamiento y la sección de datos", () => {
    const p = chatSystemPrompt({ ...chatArgs, trainingContext: training });
    // AC1/AC6 · leer real + anti-invención de WOD
    expect(p).toContain("Adaptar el entreno:");
    expect(p).toContain("usa el CONTENIDO real");
    expect(p).toContain("no inventes ejercicios");
    // AC2 · sustituciones + movilidad/antagonista/escalados
    expect(p).toContain("propón sustituciones");
    expect(p).toContain("movilidad, estiramientos");
    expect(p).toContain("grupo antagonista");
    expect(p).toContain("escalados apropiados");
    // AC3 · equilibrio entre sesiones (el alma)
    expect(p).toContain("REPARTE la carga");
    expect(p).toContain("no apiles el mismo grupo muscular en días consecutivos");
    // AC4 · coach conversacional, no vuelca la semana
    expect(p).toContain("NO vuelques la semana entera");
    expect(p).toContain("deja que él decida");
    // AC5 · solo lectura, nunca afirma haber guardado
    expect(p).toContain("SOLO LECTURA");
    expect(p).toContain("NUNCA afirmes que has modificado, guardado o registrado la sesión");
    // AC7 · seguridad: orientativo, fisio/coach, no diagnostica
    expect(p).toContain("ORIENTATIVA");
    expect(p).toContain("fisio o su coach");
    expect(p).toContain("no diagnostiques ni prescribas tratamiento");
    // sección de datos con el contenido real
    expect(p).toContain("TU ENTRENO (semana en curso):");
    expect(p).toContain("Back Squat 5x3");
  });

  it("AC8: sin trainingContext, el prompt es BYTE-IDÉNTICO al de hoy (sin bloque ni sección)", () => {
    const withUndef = chatSystemPrompt(chatArgs);
    const withEmpty = chatSystemPrompt({ ...chatArgs, trainingContext: "" });
    const withNull = chatSystemPrompt({ ...chatArgs, trainingContext: null });
    expect(withEmpty).toBe(withUndef);
    expect(withNull).toBe(withUndef);
    expect(withUndef).not.toContain("Adaptar el entreno:");
    expect(withUndef).not.toContain("TU ENTRENO (semana en curso):");
  });

  it("re-validación F05: el contrato del chat sigue intacto cuando no hay intención", () => {
    const p = chatSystemPrompt(chatArgs);
    // guardarraíles compartidos y contrato C1 siguen presentes (prompt congelado)
    expect(p).toContain(sharedGuardrails());
    expect(p).toContain("criterio REALISTA");
    expect(p).toContain("de solo lectura");
  });
});
