import { z } from "zod";
import { isDayKey } from "@/lib/dates";
import { MEASURE_TYPES } from "@/lib/marks";
import { TRAINING_TIPOS } from "@/lib/training";

// Zod compartido de los boundaries (API routes). Coincide con los enums del schema.
export const mealZ = z.enum(["almuerzo", "comida", "merienda", "cena", "extra"]);
export const grpZ = z.enum([
  "Verdura",
  "Hidratos",
  "Proteína",
  "Grasa",
  "Otros",
  "Opción única",
]);
export const phaseZ = z.enum(["carga", "competicion", "recuperacion"]);
export const bloatZ = z.enum(["ninguna", "leve", "moderada", "alta"]);
export const dateZ = z.string().refine(isDayKey, "Fecha inválida.");
export const localTimeZ = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Hora inválida.")
  .transform((value) => (value.length === 5 ? `${value}:00` : value));
export const bloatEventCreateZ = z.object({
  date: dateZ,
  severity: bloatZ,
  occurredAt: localTimeZ,
});
export const bloatEventPatchZ = z
  .object({
    severity: bloatZ.optional(),
    occurredAt: localTimeZ.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No hay cambios.");
export const sourceZ = z.enum(["plan", "foto", "manual", "ia", "fav", "plantilla"]);

// Tope del mensaje del chat: cabe un menú de comedor entero pegado. Compartido
// para que cliente (aviso en vivo) y servidor (validación) no se desincronicen.
export const CHAT_MAX_CHARS = 8000;

export const newEntryZ = z.object({
  meal: mealZ,
  name: z.string().min(1).max(600),
  kcal: z.number().int().min(0).max(20000),
  prot: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
  source: sourceZ,
  // Ruta autenticada propia (/api/photos/view?p=…), no una URL absoluta pública:
  // la store de fotos es privada y se sirve con sesión (02 §3.2).
  photoUrl: z.string().min(1).max(600).nullable().optional(),
  // Gramos como dato de primera clase (F06): base inmutable + cantidad al crear.
  grams: z.number().int().min(0).max(20000).nullable().optional(),
  baseG: z.number().int().min(0).max(20000).nullable().optional(),
  baseKcal: z.number().int().min(0).max(20000).nullable().optional(),
  baseProt: z.number().min(0).max(2000).nullable().optional(),
  baseCarb: z.number().min(0).max(2000).nullable().optional(),
  baseFat: z.number().min(0).max(2000).nullable().optional(),
});

// Productos (F07 · catálogo). grupo nullable (la etiqueta puede no clasificar);
// baseG null = producto fijo (por unidad, sin escalado).
export const productSourceZ = z.enum(["etiqueta", "manual", "legacy"]);
export const productCreateZ = z.object({
  name: z.string().min(1).max(200),
  baseG: z.number().int().min(0).max(5000).nullable(),
  baseKcal: z.number().int().min(0).max(20000),
  baseProt: z.number().min(0).max(2000),
  baseCarb: z.number().min(0).max(2000),
  baseFat: z.number().min(0).max(2000),
  grupo: grpZ.nullable(),
  source: productSourceZ,
  pinned: z.boolean(),
});
export const productPatchZ = productCreateZ.partial();

// MED (F5.1): fecha + grasa/músculo/peso en kg. Cada campo opcional (una MED
// puede no traer todos los valores); la fecha es libre (entrada retroactiva).
const medKgZ = z.number().min(0).max(500).nullable();
export const medInputZ = z.object({
  date: dateZ,
  fatKg: medKgZ,
  muscleKg: medKgZ,
  weightKg: medKgZ,
});
export const medPatchZ = medInputZ.partial();

// Variante intercambiable de una opción (F08). Macros a los gramos pautados de la
// opción (base_g). El importador la rellena; la edición manual del plan no la manda
// (Fase 2, aplazable) → default []. `nombre` corto (p. ej. "Ternera").
export const planVariantZ = z.object({
  nombre: z.string().min(1).max(80),
  kcal: z.number().int().min(0).max(20000),
  prot: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
});

export const optionZ = z.object({
  meal: mealZ,
  grp: grpZ,
  name: z.string().min(1).max(200),
  baseG: z.number().int().min(0).max(5000).nullable(),
  kcal: z.number().int().min(0).max(20000),
  prot: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
  variants: z.array(planVariantZ).max(12).default([]),
});

// Crear una versión de dieta COMPLETA desde importación (F-IA-9).
export const dietVersionCreateZ = z.object({
  effectiveFrom: dateZ,
  kcal: z.number().int().min(0).max(20000),
  prot: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000).nullable(),
  fat: z.number().min(0).max(2000).nullable(),
  options: z.array(optionZ).max(200),
});

// Crear un plan de entrenamiento COMPLETO desde importación (F-IA-10).
export const trainingSourceZ = z.enum(["pdf", "foto", "texto"]);
export const trainingTipoZ = z.enum(TRAINING_TIPOS);
export const trainingSessionCreateZ = z.object({
  key: z.string().max(40),
  nombre: z.string().min(1).max(200),
  tipo: trainingTipoZ,
  contenido: z.string().max(4000),
  kcalMin: z.number().int().min(0).max(20000).nullable(),
  kcalMax: z.number().int().min(0).max(20000).nullable(),
  duracionMin: z.number().int().min(0).max(1000).nullable(),
});
export const trainingPlanCreateZ = z.object({
  programa: z.string().min(1).max(120),
  etiqueta: z.string().min(1).max(120),
  source: trainingSourceZ,
  sessions: z.array(trainingSessionCreateZ).min(1).max(20),
  // sessionIndex apunta al índice de `sessions` (orden de la vista previa).
  assignments: z
    .array(z.object({ sessionIndex: z.number().int().min(0), date: dateZ }))
    .max(31),
});

// Marcas / registros de rendimiento (F03). `value` en unidades guardadas (segundos
// si el tipo es tiempo). measureType fija la dirección de "mejor" y la unidad.
export const measureTypeZ = z.enum(MEASURE_TYPES);
const markValueZ = z.number().min(0).max(1_000_000);
export const markCreateZ = z.object({
  name: z.string().min(1).max(120),
  measureType: measureTypeZ,
  unit: z.string().min(1).max(20),
  // Familia opcional (F04): etiqueta libre para agrupar; se captura ahora.
  family: z.string().max(60).nullable().optional(),
});
export const markEntryCreateZ = z.object({
  value: markValueZ,
  recordedOn: dateZ,
  note: z.string().max(600).nullable().optional(),
});
export const markEntryPatchZ = z.object({
  value: markValueZ.optional(),
  recordedOn: dateZ.optional(),
  note: z.string().max(600).nullable().optional(),
});
