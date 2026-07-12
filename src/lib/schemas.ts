import { z } from "zod";

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
export const sourceZ = z.enum(["plan", "foto", "manual", "ia", "fav", "plantilla"]);
export const dateZ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");

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
});

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

export const optionZ = z.object({
  meal: mealZ,
  grp: grpZ,
  name: z.string().min(1).max(200),
  baseG: z.number().int().min(0).max(5000).nullable(),
  kcal: z.number().int().min(0).max(20000),
  prot: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
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
