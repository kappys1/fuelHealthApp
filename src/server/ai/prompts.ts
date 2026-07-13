import { weekdayName } from "@/lib/dates";
import { type MealKey, MEAL_LABELS } from "@/lib/macros";
import {
  type AthleteProfile,
  currentObjective,
  deriveAge,
} from "@/lib/profile";
import type { PlanOptionDTO } from "@/server/db/queries/plan";

/*
  PROMPTS CONGELADOS — copiados LITERALES de 04-IA.md. Solo se interpolan
  variables. Prohibido "mejorarlos" sin re-probar (CLAUDE.md). Cualquier cambio
  de redacción aquí invalida los AC de la Fase 2.

  ATHLETE_CONTEXT es DINÁMICO (doc 10 A2 · principio 9): la plantilla está
  congelada; los valores salen del perfil vigente (nada hardcodeado). `edad` se
  deriva de la fecha de nacimiento y `diasEntrenoSemana` se calcula fuera (del
  mapeo de sesiones) y se interpola aquí.
*/

/**
 * Contexto de atleta COMPLETO (04-IA / doc 10 A2). Plantilla congelada, valores
 * del perfil. Usado en features conversacionales (coach F-IA-6, WOD F-IA-5,
 * preparar-visita F-IA-7, chat F-IA-8). pesoReciente = último peso (fallback 92).
 */
export function athleteContext(
  p: AthleteProfile,
  pesoReciente: number,
  trainingDays: number,
  today: string,
): string {
  const edad = deriveAge(p.fechaNacimiento, today);
  const obj = currentObjective(p);
  const nivel = p.nivel?.trim() ? ` ${p.nivel.trim()}` : "";
  const edadPart = edad != null ? `${edad} años, ` : "";
  const alturaPart = p.alturaCm != null ? `${p.alturaCm} cm, ` : "";
  const supl = p.suplementos?.length ? p.suplementos.join(", ") : "ninguno";
  const objPart = obj
    ? ` **Objetivo actual (desde ${obj.desde}): ${obj.texto}.**`
    : "";
  const nota = p.notaClinica?.trim() ? ` ${p.notaClinica.trim()}.` : "";
  const lesiones = p.lesiones?.length
    ? ` Lesiones: ${p.lesiones.join(", ")}.`
    : "";
  return `Atleta: ${p.deporte}${nivel}, ${edadPart}${alturaPart}${pesoReciente} kg. Programa: ${p.programa}; entrena ${p.franjaEntreno}, ${trainingDays} días/semana.${objPart} Suplementos que toma: ${supl}.${nota}${lesiones}`;
}

/**
 * Versión COMPACTA del contexto (doc 10 A2) para las features de estimación
 * (F-IA-1/2/3/4/9). Incluye la cláusula anti-sesgo: el perfil es contexto, NO
 * ajusta las estimaciones (los macros son del alimento, no de la persona).
 * `photoScaleException`: en F-IA-1 la altura/complexión SÍ sirve de referencia de
 * escala de raciones (excepción explícita de A2).
 */
export function athleteContextCompact(
  p: AthleteProfile,
  pesoReciente: number,
  opts?: { photoScaleException?: boolean },
): string {
  const obj = currentObjective(p);
  const objText = obj ? obj.texto : "sin objetivo definido";
  const alturaPart = p.alturaCm != null ? `${p.alturaCm} cm, ` : "";
  const base = `Contexto del usuario: ${p.deporte}, ${alturaPart}${pesoReciente} kg, objetivo: ${objText}. El perfil es contexto del usuario; NO ajustes las estimaciones nutricionales según el perfil — los macros son del alimento, no de la persona.`;
  if (opts?.photoScaleException) {
    return `${base} (La altura/complexión SÍ puede servirte como referencia de escala para estimar el tamaño de las raciones en la foto.)`;
  }
  return base;
}

/** listaOpciones = opciones de esa comida «Nombre (baseG g → kcal kcal, prot g prot)» ; separadas. */
export function planOptionsList(options: PlanOptionDTO[]): string {
  if (options.length === 0) return "libre";
  return options
    .map((o) =>
      o.baseG != null
        ? `${o.name} (${o.baseG} g → ${o.kcal} kcal, ${o.prot} g prot)`
        : `${o.name} (${o.kcal} kcal, ${o.prot} g prot)`,
    )
    .join("; ");
}

// ── F-IA-1 · Análisis de foto de comida (bloque texto; el bloque imagen lo añade el cliente) ──
export function photoPrompt(args: {
  contexto: string;
  meal: MealKey;
  kcalObjetivo: number;
  protObjetivo: number;
  listaOpciones: string;
  note?: string | null;
}): string {
  const mealLabel = MEAL_LABELS[args.meal];
  const noteClause = args.note?.trim()
    ? ` ACLARACIONES DEL USUARIO (prevalecen sobre lo que parezca verse en la foto): "${args.note.trim()}".`
    : "";
  return `${args.contexto} Eres un nutricionista deportivo. Analiza la foto de esta comida ("${mealLabel}") de un plan de ${args.kcalObjetivo} kcal y ${args.protObjetivo} g de proteína diarios. Opciones pautadas para esta comida: ${args.listaOpciones}. Identifica CADA alimento por separado, estima su ración en gramos y sus macros.${noteClause} Valora si el conjunto encaja con lo pautado (tipo de alimento y tamaño de ración). Responde SOLO con JSON válido, sin markdown ni texto extra: {"items": [{"nombre": string corto SIN gramos (ej. "Hamburguesa ternera magra"), "gramos": number (ración estimada en g o ml), "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}], "encaja_plan": boolean, "comentario": string breve indicando si la ración se pasa, se queda corta o encaja}`;
}

// ── F-IA-2 · Estimar macros desde texto ──
export function estimatePrompt(descripcion: string, contexto: string): string {
  return `${contexto} Eres un nutricionista. Estima kcal, proteína, hidratos y grasa totales de: "${descripcion}". Usa valores medios de tablas de composición de alimentos (España). Si la descripción es ambigua (p. ej. tipo de leche o corte de carne), asume siempre la variante más común en España, de forma consistente. Responde SOLO con JSON válido, sin markdown: {"kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}`;
}

// ── F-IA-3 · Estimar nueva opción del plan ──
export function planOptionPrompt(
  nombre: string,
  gramos: number | null | undefined,
  contexto: string,
): string {
  const gramosClause = gramos != null ? ` (ración: ${gramos} g)` : "";
  return `${contexto} Eres un nutricionista. Alimento: "${nombre}"${gramosClause}. Estima kcal, proteína, hidratos y grasa de esa ración con valores medios de tablas de composición (España), y clasifícalo en un grupo: "Hidratos", "Proteína", "Verdura", "Grasa" u "Otros". Si la descripción es ambigua (p. ej. tipo de leche o corte de carne), asume siempre la variante más común en España, de forma consistente. Responde SOLO con JSON válido, sin markdown: {"kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number, "grupo": string}`;
}

// ── F-IA-4 · Volcado del día ──
export function dayDumpPrompt(
  texto: string,
  kcal: number,
  prot: number,
  contexto: string,
): string {
  return `${contexto} Registro dictado de comidas de un día (plan de ${kcal} kcal, ${prot} g proteína). Texto del usuario: "${texto}". Trocéalo en items de comida. Para cada item asigna: comida ("almuerzo","comida","merienda","cena" o "extra" si no está claro), nombre corto, y estima kcal, proteína, hidratos y grasa con valores medios de tablas españolas (ante ambigüedad, la variante más común, de forma consistente). Responde SOLO con JSON válido, sin markdown: {"items":[{"comida":string,"nombre":string,"kcal":number,"proteina_g":number,"carbohidratos_g":number,"grasa_g":number}]}`;
}

// ── F-IA-5 · Analizar sesión pegada (WOD) ──
export function wodPrompt(textoPegado: string, contexto: string): string {
  return `${contexto} Sesión de entrenamiento:\n\n${textoPegado}\n\nEstima la duración total típica y el gasto energético de la sesión completa (fuerza, WOD y accesorios, incluyendo descansos entre series; sin contar EPOC). Sé conservador. Responde SOLO con JSON válido, sin markdown: {"nombre": string (etiqueta corta, ej. "Halterofilia + WOD"), "duracion_min": number, "kcal_min": number, "kcal_max": number, "comentario": string breve}`;
}

// ── F-IA-6 · Coach diario (texto plano, máx 100 palabras) ──
export function coachPrompt(args: {
  atleta: string;
  /** Día que la UI trata como "hoy" (el día visible en Hoy). */
  today: string;
  /** Día que se evalúa: = today en modo hoy; today−1 en modo ayer. */
  targetDate: string;
  mode: "hoy" | "ayer";
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  dayContext: string;
  /** Opciones del plan de las comidas pendientes (F01 Fase 1; "" si ninguna). */
  planPendiente: string;
}): string {
  // Fecha objetivo explícita (F01 Fase 0): el modelo nunca alucina qué día es.
  // Por paridad con el chat; en modo ayer se declara además el día evaluado.
  const dateLine =
    args.mode === "ayer"
      ? `HOY es ${args.today} (${weekdayName(args.today)}). Analizas AYER, ${args.targetDate} (${weekdayName(args.targetDate)}).`
      : `HOY es ${args.today} (${weekdayName(args.today)}).`;
  const header = `${dateLine}\n\n${args.atleta} Objetivos diarios: ${args.kcal} kcal, ${args.prot} g proteína, ~${args.carb} g hidratos, ~${args.fat} g grasa. En fases de Carga/Competición, superar kcal es esperado.`;
  // Guardarraíles (doc 10 A3 + F01 Fase 1): anti-suplementación (paridad con el
  // chat), prioridad del plan real (marcar «fuera de tu pauta» si sale de él) y
  // anti-entreno-fantasma (descanso/sin sesión → sin timing pre/post).
  const guardrails = `Observas y explicas; NO prescribes suplementación. Si sugieres suplementos, SOLO los de su perfil; nada fuera de esa lista. Prioriza comida real y las opciones del plan que le quedan (listadas abajo); por defecto, lo más limpio DENTRO de su pauta. Si excepcionalmente sugieres algo fuera del plan, márcalo como «fuera de tu pauta». Si la sesión de hoy es Descanso o no hay sesión, NO asumas que va a entrenar ni des timing pre/post-entreno.`;
  const planBlock = args.planPendiente.trim()
    ? `\n\nOPCIONES DEL PLAN PENDIENTES:\n${args.planPendiente.trim()}`
    : "";
  const block =
    args.mode === "hoy"
      ? `Día EN CURSO. ${args.dayContext} Di qué le falta para cuadrar el día: kcal y proteína restantes, y una sugerencia concreta con las comidas del plan que le quedan. Si algo va desviado (proteína baja, hidrato lejos del entreno, poca agua), avísalo.`
      : `Día TERMINADO. ${args.dayContext} Evalúa: qué hizo bien, en qué falló respecto a objetivos, y 1-2 acciones concretas para hoy.`;
  return `${header}\n\n${guardrails}${planBlock}\n\n${block}\n\nMáximo 100 palabras, directo, sin saludos, en español.`;
}

// ── F-IA-7 · Preparar visita al nutricionista (texto plano, máx 200 palabras) ──
export function prepareVisitPrompt(args: {
  atleta: string;
  /** Día actual, para anclar la fecha (F01 Fase 0, por paridad). */
  today: string;
  kcal: number;
  prot: number;
  meds: string;
  tendencia: string;
  filas: string;
}): string {
  return `HOY es ${args.today} (${weekdayName(args.today)}). ${args.atleta} Pauta actual del nutricionista (Regenera): ${args.kcal} kcal, ${args.prot} g proteína.\n\nMediciones del nutricionista (pliegues):\n${args.meds}\n\n${args.tendencia}\n\nRegistro de los últimos días:\n${args.filas}\n\nPrepara su visita al nutricionista: (1) análisis breve de la evolución según estos datos, (2) 4-6 preguntas concretas y bien fundamentadas para hacerle en consulta (ajuste de kcal/proteína, hinchazón, carga de competición, timing con el entreno…), basadas SOLO en lo que muestran los datos, señalando el dato que motiva cada pregunta. Máximo 200 palabras, en español, sin saludos.`;
}

// ── F-IA-8 · Chat sobre tus datos (system prompt; se regenera cada turno) ──
export function chatSystemPrompt(args: {
  atleta: string;
  /** Día actual (Europe/Madrid) — ancla la fecha para «¿cómo voy hoy?» (F01 Fase 0). */
  today: string;
  planSummary: string;
  trendAdherence: string;
  meds: string;
  days30: string;
  priorSummary?: string | null;
}): string {
  // Línea de fecha primero (F01 Fase 0): sin ella, con el último dato fechado
  // hoy, el modelo alucinaba un «hoy» posterior y días inexistentes.
  const base = `HOY es ${args.today} (${weekdayName(args.today)}).\n${args.atleta} Respondes SOLO con base en los datos proporcionados. Si los datos no lo cubren, dilo. Observas y explicas; NO prescribes cambios de dieta ni suplementación — eso corresponde a su nutricionista (puedes sugerir qué preguntarle). Respuestas concisas, en español, con cifras concretas de sus datos.`;
  const sections = [
    base,
    `DIETA VIGENTE:\n${args.planSummary}`,
    `TENDENCIA Y ADHERENCIA:\n${args.trendAdherence}`,
    `MEDICIONES DEL NUTRICIONISTA (pliegues):\n${args.meds}`,
    `ÚLTIMOS 30 DÍAS (1 línea/día):\n${args.days30}`,
  ];
  if (args.priorSummary?.trim()) {
    sections.push(`RESUMEN DE LA CONVERSACIÓN PREVIA:\n${args.priorSummary.trim()}`);
  }
  return sections.join("\n\n");
}

// Resumen del hilo cuando supera 12 mensajes (F-IA-8 §6), ~100 palabras.
export function chatSummaryPrompt(transcript: string): string {
  return `Resume en un máximo de 100 palabras, en español, la siguiente conversación entre un atleta y su asistente de datos nutricionales, conservando los hechos y cifras concretas que puedan ser relevantes para continuar la conversación. Sin saludos ni preámbulos.\n\n${transcript}`;
}

// ── F-IA-9 · Importar dieta desde foto/PDF (bloque texto; imagen(es)/PDF los adjunta el cliente) ──
export function dietImportPrompt(contexto: string): string {
  return `${contexto} Eres un nutricionista. Esta imagen es la pauta dietética de un paciente. Extrae TODAS las comidas y sus opciones respetando la estructura: comidas (almuerzo/comida/merienda/cena), y en cada una las opciones con su grupo si existe (Verdura/Hidratos/Proteína/Grasa/Otros; si la comida es de opción única o conjunto, usa "Opción única"), el nombre, los gramos pautados (null si son unidades) y estima kcal, proteína, hidratos y grasa de cada ración con tablas de composición españolas. Extrae también, si aparecen, las kcal y proteína totales pautadas. Responde SOLO con JSON válido, sin markdown: {"kcal_totales": number|null, "proteina_total": number|null, "comidas": [{"comida": string, "opciones": [{"nombre": string, "grupo": string, "gramos": number|null, "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}]}]}`;
}

// ── F-IA-10 · Importar semana de entrenamiento (PDF/foto adjunto por el cliente, o texto) ──
export function trainingImportPrompt(
  contexto: string,
  texto?: string | null,
): string {
  const fuente = texto?.trim()
    ? `Programación semanal de entrenamiento (texto):\n\n${texto.trim()}\n\n`
    : "El documento adjunto es la programación semanal de entrenamiento de este atleta. ";
  return `${contexto} ${fuente}Extrae CADA sesión de la semana con: clave (ej. "T1"; si no hay, usa "Día 1", "Día 2"…), nombre corto, tipo (EXACTAMENTE uno de: fuerza, halterofilia, gimnasticos, metabolico, aerobico, mixto, descanso, otro), contenido resumido pero fiel (bloques principales), y estima la duración total en minutos y el gasto energético de la sesión completa como rango (kcal_min/kcal_max) para este atleta, con los criterios de una sesión típica: incluye descansos entre series, sé conservador y NO cuentes EPOC. Si una sesión es de descanso, tipo "descanso", duración 0 y gasto 0. Responde SOLO con JSON válido, sin markdown: {"programa": string|null, "etiqueta": string|null, "sesiones": [{"clave": string, "nombre": string, "tipo": string, "contenido": string, "duracion_min": number, "kcal_min": number, "kcal_max": number}]}`;
}
