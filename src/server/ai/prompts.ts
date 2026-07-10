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
