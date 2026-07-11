/*
  Utilidades compartidas de ingesta de Apple Health (Health Auto Export) — PURAS.
  Tipos y helpers usados por el parser CSV (respaldo) y el JSON (endpoint).
  Fuente de verdad de la tabla de mapeo: 03-DATOS §4.2.
*/

/** Un día de métricas del reloj/báscula (todo opcional; solo llega lo que trae la fuente). */
export interface HealthDay {
  date: string; // 'YYYY-MM-DD'
  steps?: number | null;
  activeKcal?: number | null;
  basalKcal?: number | null;
  hrvMs?: number | null;
  sleepH?: number | null;
  restingHr?: number | null;
  vo2max?: number | null;
  waterL?: number | null;
  weight?: number | null;
  bodyFatPct?: number | null;
}

/** Campos numéricos de HealthDay (todos menos `date`). */
export type HealthField = Exclude<keyof HealthDay, "date">;

/** Campos que se GUARDAN como enteros en health_metrics (03-DATOS §1). */
export const INTEGER_FIELDS: ReadonlySet<HealthField> = new Set<HealthField>([
  "steps",
  "activeKcal",
  "basalKcal",
  "restingHr",
]);

/** kJ → kcal (÷4,184). Se aplica a energía activa/basal si la unidad es kJ. */
export const KJ_PER_KCAL = 4.184;

/**
 * Normaliza una cabecera/nombre para detección por substring: quita acentos,
 * pasa a minúsculas y colapsa espacios. Más tolerante que la comparación literal
 * de la spec (p. ej. «Cardíaca» y «cardiaca» coinciden) sin romper la distinción
 * «peso (» vs «paso».
 */
export function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Número con coma decimal → punto (03-DATOS §4.2). Tolerante a separador de
 * miles: «1.234,5» → 1234.5; «67,5» → 67.5; «13300» → 13300. Vacío → null.
 */
export function parseNumberEs(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let t = raw.trim();
  if (t === "") return null;
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  if (hasComma && hasDot) t = t.replace(/\./g, "").replace(",", "."); // punto = miles
  else if (hasComma) t = t.replace(",", "."); // coma = decimal
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Detección de campo por substrings sobre la cabecera YA normalizada.
 * Orden y substrings EXACTOS de 03-DATOS §4.2. «weight» exige el paréntesis
 * abierto («peso (») para NO colisionar con «Longitud del Paso al Caminar».
 * El objetivo especial "date" se detecta aparte.
 */
const FIELD_MATCHERS: ReadonlyArray<{ field: HealthField; needles: string[] }> = [
  { field: "weight", needles: ["peso (", "weight (", "body mass"] },
  { field: "bodyFatPct", needles: ["grasa corporal", "body fat"] },
  { field: "activeKcal", needles: ["energia activa", "active energy"] },
  {
    field: "basalKcal",
    // «basal» a secas colisiona con «Temperatura Basal del Cuerpo»: exigimos el
    // contexto de energía (energia basal / basal energy) además de «en reposo».
    needles: ["energia en reposo", "resting energy", "energia basal", "basal energy"],
  },
  { field: "steps", needles: ["conteo de pasos", "step count", "steps ("] },
  { field: "waterL", needles: ["agua (", "water ("] },
  { field: "hrvMs", needles: ["variabilidad", "variability"] },
  { field: "sleepH", needles: ["dormido]", "asleep]"] },
  { field: "restingHr", needles: ["cardiaca en reposo", "resting heart"] },
  { field: "vo2max", needles: ["vo2"] },
];

const DATE_NEEDLES = ["fecha", "date"];

export function detectDateColumn(headerNorm: string): boolean {
  return DATE_NEEDLES.some((n) => headerNorm.includes(n));
}

export function detectField(headerNorm: string): HealthField | null {
  for (const { field, needles } of FIELD_MATCHERS) {
    if (needles.some((n) => headerNorm.includes(n))) return field;
  }
  return null;
}

/** ¿La cabecera indica kJ? (energía activa/basal → convertir a kcal). */
export const headerIsKj = (headerNorm: string): boolean =>
  headerNorm.includes("(kj)") || headerNorm.includes("kj)");

/** ¿La cabecera indica mL? (agua → convertir a L). */
export const headerIsMl = (headerNorm: string): boolean =>
  headerNorm.includes("(ml)") || headerNorm.includes("ml)");

/** Convierte un valor bruto de un campo a la unidad canónica (kcal, L, entero…). */
export function canonicalize(
  field: HealthField,
  value: number,
  opts: { isKj?: boolean; isMl?: boolean },
): number {
  let v = value;
  if ((field === "activeKcal" || field === "basalKcal") && opts.isKj) {
    v = v / KJ_PER_KCAL;
  }
  if (field === "waterL" && opts.isMl) {
    v = v / 1000;
  }
  return INTEGER_FIELDS.has(field) ? Math.round(v) : v;
}

/** Extrae 'YYYY-MM-DD' del inicio de un valor de fecha (o null si no lo hay). */
export function extractDayKey(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

/** Todos los campos numéricos de HealthDay (para iterar sin tocar `date`). */
export const HEALTH_FIELDS: readonly HealthField[] = [
  "steps",
  "activeKcal",
  "basalKcal",
  "hrvMs",
  "sleepH",
  "restingHr",
  "vo2max",
  "waterL",
  "weight",
  "bodyFatPct",
];

/** Fusiona dos HealthDay de la misma fecha; el segundo pisa donde trae valor. */
export function mergeHealthDay(a: HealthDay, b: HealthDay): HealthDay {
  const out: HealthDay = { ...a };
  for (const k of HEALTH_FIELDS) {
    const v = b[k];
    if (v != null) out[k] = v;
  }
  return out;
}
