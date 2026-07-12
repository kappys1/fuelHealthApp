import { type MealKey, MEAL_LABELS } from "@/lib/macros";
import type { PlanOptionDTO } from "@/server/db/queries/plan";

/*
  PROMPTS CONGELADOS — copiados LITERALES de 04-IA.md. Solo se interpolan
  variables. Prohibido "mejorarlos" sin re-probar (CLAUDE.md). Cualquier cambio
  de redacción aquí invalida los AC de la Fase 2.
*/

/** Contexto de atleta reutilizable (04-IA). pesoReciente = último peso (fallback 92). */
export function athleteContext(pesoReciente: number): string {
  return `Atleta de CrossFit avanzado: ${pesoReciente} kg, 175 cm, 33 años. Entrena 19:30-21:30, 6 días/semana (The Progrm). Objetivo: recomposición corporal (perder grasa, mantener/ganar músculo), rendimiento y evitar hinchazón/retención. Toma creatina, beta-alanina y citrulina.`;
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
  return `Eres un nutricionista deportivo. Analiza la foto de esta comida ("${mealLabel}") de un plan de ${args.kcalObjetivo} kcal y ${args.protObjetivo} g de proteína diarios. Opciones pautadas para esta comida: ${args.listaOpciones}. Identifica CADA alimento por separado, estima su ración en gramos y sus macros.${noteClause} Valora si el conjunto encaja con lo pautado (tipo de alimento y tamaño de ración). Responde SOLO con JSON válido, sin markdown ni texto extra: {"items": [{"nombre": string corto SIN gramos (ej. "Hamburguesa ternera magra"), "gramos": number (ración estimada en g o ml), "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}], "encaja_plan": boolean, "comentario": string breve indicando si la ración se pasa, se queda corta o encaja}`;
}

// ── F-IA-2 · Estimar macros desde texto ──
export function estimatePrompt(descripcion: string): string {
  return `Eres un nutricionista. Estima kcal, proteína, hidratos y grasa totales de: "${descripcion}". Usa valores medios de tablas de composición de alimentos (España). Si la descripción es ambigua (p. ej. tipo de leche o corte de carne), asume siempre la variante más común en España, de forma consistente. Responde SOLO con JSON válido, sin markdown: {"kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}`;
}

// ── F-IA-3 · Estimar nueva opción del plan ──
export function planOptionPrompt(nombre: string, gramos?: number | null): string {
  const gramosClause = gramos != null ? ` (ración: ${gramos} g)` : "";
  return `Eres un nutricionista. Alimento: "${nombre}"${gramosClause}. Estima kcal, proteína, hidratos y grasa de esa ración con valores medios de tablas de composición (España), y clasifícalo en un grupo: "Hidratos", "Proteína", "Verdura", "Grasa" u "Otros". Si la descripción es ambigua (p. ej. tipo de leche o corte de carne), asume siempre la variante más común en España, de forma consistente. Responde SOLO con JSON válido, sin markdown: {"kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number, "grupo": string}`;
}

// ── F-IA-4 · Volcado del día ──
export function dayDumpPrompt(texto: string, kcal: number, prot: number): string {
  return `Registro dictado de comidas de un día (plan de ${kcal} kcal, ${prot} g proteína). Texto del usuario: "${texto}". Trocéalo en items de comida. Para cada item asigna: comida ("almuerzo","comida","merienda","cena" o "extra" si no está claro), nombre corto, y estima kcal, proteína, hidratos y grasa con valores medios de tablas españolas (ante ambigüedad, la variante más común, de forma consistente). Responde SOLO con JSON válido, sin markdown: {"items":[{"comida":string,"nombre":string,"kcal":number,"proteina_g":number,"carbohidratos_g":number,"grasa_g":number}]}`;
}

// ── F-IA-5 · Analizar sesión pegada (WOD) ──
export function wodPrompt(textoPegado: string, pesoReciente: number): string {
  return `${athleteContext(pesoReciente)} Sesión de entrenamiento:\n\n${textoPegado}\n\nEstima la duración total típica y el gasto energético de la sesión completa (fuerza, WOD y accesorios, incluyendo descansos entre series; sin contar EPOC). Sé conservador. Responde SOLO con JSON válido, sin markdown: {"nombre": string (etiqueta corta, ej. "Halterofilia + WOD"), "duracion_min": number, "kcal_min": number, "kcal_max": number, "comentario": string breve}`;
}

/** Versión extendida del contexto de atleta (F-IA-7 / F-IA-8): añade el matiz clínico. */
export function athleteContextExtended(pesoReciente: number): string {
  return `${athleteContext(pesoReciente)} Le cuesta la grasa abdominal baja.`;
}

// ── F-IA-6 · Coach diario (texto plano, máx 100 palabras) ──
export function coachPrompt(args: {
  mode: "hoy" | "ayer";
  pesoReciente: number;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  dayContext: string;
}): string {
  const header = `${athleteContext(args.pesoReciente)} Objetivos diarios: ${args.kcal} kcal, ${args.prot} g proteína, ~${args.carb} g hidratos, ~${args.fat} g grasa. En fases de Carga/Competición, superar kcal es esperado.`;
  const block =
    args.mode === "hoy"
      ? `Día EN CURSO. ${args.dayContext} Di qué le falta para cuadrar el día: kcal y proteína restantes, y una sugerencia concreta con las comidas del plan que le quedan. Si algo va desviado (proteína baja, hidrato lejos del entreno, poca agua), avísalo.`
      : `Día TERMINADO. ${args.dayContext} Evalúa: qué hizo bien, en qué falló respecto a objetivos, y 1-2 acciones concretas para hoy.`;
  return `${header}\n\n${block}\n\nMáximo 100 palabras, directo, sin saludos, en español.`;
}

// ── F-IA-7 · Preparar visita al nutricionista (texto plano, máx 200 palabras) ──
export function prepareVisitPrompt(args: {
  pesoReciente: number;
  kcal: number;
  prot: number;
  meds: string;
  tendencia: string;
  filas: string;
}): string {
  return `${athleteContextExtended(args.pesoReciente)} Pauta actual del nutricionista (Regenera): ${args.kcal} kcal, ${args.prot} g proteína.\n\nMediciones del nutricionista (pliegues):\n${args.meds}\n\n${args.tendencia}\n\nRegistro de los últimos días:\n${args.filas}\n\nPrepara su visita al nutricionista: (1) análisis breve de la evolución según estos datos, (2) 4-6 preguntas concretas y bien fundamentadas para hacerle en consulta (ajuste de kcal/proteína, hinchazón, carga de competición, timing con el entreno…), basadas SOLO en lo que muestran los datos, señalando el dato que motiva cada pregunta. Máximo 200 palabras, en español, sin saludos.`;
}

// ── F-IA-8 · Chat sobre tus datos (system prompt; se regenera cada turno) ──
export function chatSystemPrompt(args: {
  pesoReciente: number;
  planSummary: string;
  trendAdherence: string;
  meds: string;
  days30: string;
  priorSummary?: string | null;
}): string {
  const base = `${athleteContextExtended(args.pesoReciente)} Respondes SOLO con base en los datos proporcionados. Si los datos no lo cubren, dilo. Observas y explicas; NO prescribes cambios de dieta ni suplementación — eso corresponde a su nutricionista (puedes sugerir qué preguntarle). Respuestas concisas, en español, con cifras concretas de sus datos.`;
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
export function dietImportPrompt(): string {
  return `Eres un nutricionista. Esta imagen es la pauta dietética de un paciente. Extrae TODAS las comidas y sus opciones respetando la estructura: comidas (almuerzo/comida/merienda/cena), y en cada una las opciones con su grupo si existe (Verdura/Hidratos/Proteína/Grasa/Otros; si la comida es de opción única o conjunto, usa "Opción única"), el nombre, los gramos pautados (null si son unidades) y estima kcal, proteína, hidratos y grasa de cada ración con tablas de composición españolas. Extrae también, si aparecen, las kcal y proteína totales pautadas. Responde SOLO con JSON válido, sin markdown: {"kcal_totales": number|null, "proteina_total": number|null, "comidas": [{"comida": string, "opciones": [{"nombre": string, "grupo": string, "gramos": number|null, "kcal": number, "proteina_g": number, "carbohidratos_g": number, "grasa_g": number}]}]}`;
}
