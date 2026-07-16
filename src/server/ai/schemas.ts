import { z } from "zod";

/*
  Schemas Zod de las respuestas de IA (formas EXACTAS de 04-IA). Los números se
  coercionan (la IA a veces emite "12" como string) y el redondeo/normalización
  final vive en la UI/route, no aquí. `grupo` y `comida` se validan como string y
  se normalizan contra los enums de la app en el llamador.
*/

const num = z.coerce.number().finite();

// ── F-IA-1 · Análisis de foto ──
export const photoItemZ = z.object({
  nombre: z.string(),
  gramos: num,
  kcal: num,
  proteina_g: num,
  carbohidratos_g: num,
  grasa_g: num,
});
export const photoResultZ = z.object({
  items: z.array(photoItemZ),
  encaja_plan: z.boolean(),
  comentario: z.string(),
});
export type PhotoResult = z.infer<typeof photoResultZ>;
export type PhotoItem = z.infer<typeof photoItemZ>;

// ── F-IA-2 · Estimar macros desde texto ──
export const estimateZ = z.object({
  kcal: num,
  proteina_g: num,
  carbohidratos_g: num,
  grasa_g: num,
});
export type EstimateResult = z.infer<typeof estimateZ>;

// ── F-IA-3 · Estimar nueva opción del plan ──
export const planOptionAiZ = z.object({
  kcal: num,
  proteina_g: num,
  carbohidratos_g: num,
  grasa_g: num,
  grupo: z.string(),
});
export type PlanOptionAiResult = z.infer<typeof planOptionAiZ>;

// ── F-IA-4 · Volcado del día ──
export const dayDumpItemZ = z.object({
  comida: z.string(),
  nombre: z.string(),
  // Gramos como dato de primera clase (F06 Fase 2): la IA estima la ración cuando
  // es razonable; si el item no tiene cantidad estimable ("un puñado", "sopa")
  // devuelve null → el item queda fijo (sin stepper). NUNCA inventa una cifra.
  gramos: num.nullable(),
  kcal: num,
  proteina_g: num,
  carbohidratos_g: num,
  grasa_g: num,
});
export const dayDumpZ = z.object({
  items: z.array(dayDumpItemZ),
});
export type DayDumpResult = z.infer<typeof dayDumpZ>;
export type DayDumpItem = z.infer<typeof dayDumpItemZ>;

// ── F-IA-5 · Analizar sesión pegada (WOD) ──
export const wodZ = z.object({
  nombre: z.string(),
  duracion_min: num,
  kcal_min: num,
  kcal_max: num,
  comentario: z.string(),
});
export type WodResult = z.infer<typeof wodZ>;

// ── F-IA-9 · Importar dieta desde foto/PDF ──
export const dietImportOptionZ = z.object({
  nombre: z.string(),
  grupo: z.string(),
  gramos: num.nullable(),
  kcal: num,
  proteina_g: num,
  carbohidratos_g: num,
  grasa_g: num,
});
export const dietImportComidaZ = z.object({
  comida: z.string(),
  opciones: z.array(dietImportOptionZ),
});
export const dietImportZ = z.object({
  kcal_totales: num.nullable(),
  proteina_total: num.nullable(),
  comidas: z.array(dietImportComidaZ),
});
export type DietImportResult = z.infer<typeof dietImportZ>;
export type DietImportOption = z.infer<typeof dietImportOptionZ>;

// ── F-IA-10 · Importar semana de entrenamiento ──
// `tipo` se valida como string y se normaliza contra el enum en el cliente/route
// (el modelo puede devolver "Halterofilia", "gimnásticos", etc.).
export const trainingImportSessionZ = z.object({
  clave: z.string(),
  nombre: z.string(),
  tipo: z.string(),
  contenido: z.string(),
  duracion_min: num,
  kcal_min: num,
  kcal_max: num,
});
export const trainingImportZ = z.object({
  programa: z.string().nullable(),
  etiqueta: z.string().nullable(),
  sesiones: z.array(trainingImportSessionZ),
});
export type TrainingImportResult = z.infer<typeof trainingImportZ>;
export type TrainingImportSession = z.infer<typeof trainingImportSessionZ>;

// ── F-IA-11 · Leer etiqueta nutricional (F07 · Mis productos) ──
// Es una LECTURA, no una estimación: `null` donde el dato NO figura en la etiqueta
// (base_g y macros nullable). `nombre` y `grupo` siempre vienen (grupo se normaliza
// contra el enum en el cliente).
export const labelReadZ = z.object({
  nombre: z.string(),
  base_g: num.nullable(),
  kcal: num.nullable(),
  proteina_g: num.nullable(),
  carbohidratos_g: num.nullable(),
  grasa_g: num.nullable(),
  grupo: z.string(),
});
export type LabelReadResult = z.infer<typeof labelReadZ>;
