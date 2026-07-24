/*
  Lógica pura de marcas / registros de rendimiento (F03). Client-safe: NO importa el
  schema de servidor (drizzle). Los valores de `MEASURE_TYPES` deben coincidir 1:1
  con `markMeasureEnum` en `src/server/db/schema.ts` (sincronizados a mano, como
  TRAINING_TIPOS). "Última" y "mejor" se DERIVAN aquí en lectura — nunca se guardan.
*/

export const MEASURE_TYPES = ["weight", "time", "reps", "distance"] as const;
export type MeasureType = (typeof MEASURE_TYPES)[number];

export const MEASURE_TYPE_LABELS: Record<MeasureType, string> = {
  weight: "Peso",
  time: "Tiempo",
  reps: "Repeticiones",
  distance: "Distancia",
};

/** Unidad por defecto al crear una marca de cada tipo (editable). El tiempo se
 *  guarda en segundos y se muestra como mm:ss, así que su unidad es implícita. */
export const DEFAULT_UNIT: Record<MeasureType, string> = {
  weight: "kg",
  time: "min",
  reps: "reps",
  distance: "km",
};

/**
 * Dirección de "mejor" según el tipo (F03 · Alcance): en peso/reps/distancia, MÁS
 * es mejor; en tiempo, MENOS es mejor.
 */
export function higherIsBetter(measureType: MeasureType): boolean {
  return measureType !== "time";
}

/** Porcentaje de la última entrada respecto al récord, sensible a la dirección. */
export function latestRecordPercentage(
  measureType: MeasureType,
  entries: readonly MarkEntryLike[],
): number | null {
  const latest = latestEntry(entries);
  const record = bestEntry(measureType, entries);
  if (!latest || !record) return null;
  if (latest.value === 0 && record.value === 0) return 100;
  if (latest.value <= 0 || record.value <= 0) return null;
  const ratio = higherIsBetter(measureType)
    ? latest.value / record.value
    : record.value / latest.value;
  return Math.min(100, Math.max(0, ratio * 100));
}

/** Solo las marcas de peso tienen calculadora de % (determinista, cero IA). */
export function hasPercentCalculator(measureType: MeasureType): boolean {
  return measureType === "weight";
}

// ── Entradas: forma mínima que necesita la lógica de derivación ──
export interface MarkEntryLike {
  id: number;
  value: number;
  recordedOn: string; // 'YYYY-MM-DD'
}

/** Orden cronológico ascendente estable (fecha; empate → id). No muta la entrada. */
export function sortEntriesAsc<T extends MarkEntryLike>(entries: readonly T[]): T[] {
  return entries
    .slice()
    .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn) || a.id - b.id);
}

/** La entrada más reciente (titular de la lista + base de la calculadora de %). */
export function latestEntry<T extends MarkEntryLike>(
  entries: readonly T[],
): T | null {
  const asc = sortEntriesAsc(entries);
  return asc.length ? (asc[asc.length - 1] as T) : null;
}

/** La MEJOR entrada según el tipo (récord; se marca en la gráfica del detalle). */
export function bestEntry<T extends MarkEntryLike>(
  measureType: MeasureType,
  entries: readonly T[],
): T | null {
  if (entries.length === 0) return null;
  const better = higherIsBetter(measureType);
  // En empate nos quedamos con la más antigua (primer récord conseguido).
  return sortEntriesAsc(entries).reduce((best, e) =>
    better ? (e.value > best.value ? e : best) : e.value < best.value ? e : best,
  );
}

/**
 * Marcas ordenadas por la fecha de su ÚLTIMA entrada (más reciente primero) — base
 * del carril «recientes» del Historial (F04). Las marcas sin entradas van al final.
 * Empate de fecha → la registrada después (id de entrada mayor). Puro y derivado en
 * lectura; compara claves 'YYYY-MM-DD' (lib/dates, Europe/Madrid), nunca toISOString.
 */
export function marksByRecency<T extends { entries: readonly MarkEntryLike[] }>(
  marks: readonly T[],
): T[] {
  return marks
    .map((m) => ({ m, last: latestEntry(m.entries) }))
    .sort((a, b) => {
      if (!a.last && !b.last) return 0;
      if (!a.last) return 1;
      if (!b.last) return -1;
      return (
        b.last.recordedOn.localeCompare(a.last.recordedOn) ||
        b.last.id - a.last.id
      );
    })
    .map((x) => x.m);
}

export interface LatestChange {
  /** value(última) − value(anterior), en unidades guardadas (segundos si tiempo). */
  delta: number;
  /** ¿la última mejora respecto a la anterior según el tipo? */
  better: boolean;
}

/**
 * Cambio de la ÚLTIMA entrada respecto a la INMEDIATAMENTE anterior (cronológica).
 * Es el indicador "¿estás mejorando o perdiendo?" (F03 · caso real). El récord
 * histórico ("mejor") se muestra aparte, en la gráfica. null si hay <2 entradas o
 * si no hay cambio (delta 0). (La "mejor absoluta" — nuevo PR — se ve como el punto
 * marcado en la gráfica; aquí comparamos vs la vez anterior, no vs el récord.)
 */
export function latestChange(
  measureType: MeasureType,
  entries: readonly MarkEntryLike[],
): LatestChange | null {
  const asc = sortEntriesAsc(entries);
  const last = asc[asc.length - 1];
  const prev = asc[asc.length - 2];
  if (!last || !prev) return null;
  const delta = last.value - prev.value;
  if (delta === 0) return null;
  const better = higherIsBetter(measureType) ? delta > 0 : delta < 0;
  return { delta, better };
}

/** X % de un valor (calculadora de marcas de peso). 85 % de 110 = 93,5. */
export function percentOf(value: number, pct: number): number {
  return (value * pct) / 100;
}

// ── Familias (F11): agrupación libre de marcas; grafía canónica única ──

/**
 * Familias únicas, no vacías, ordenadas (es) — alimentan los chips del FamilyPicker
 * al crear y al editar una marca. Pura; acepta cualquier forma con `family`.
 */
export function uniqueFamilies(
  marks: readonly { family: string | null }[],
): string[] {
  const set = new Set<string>();
  for (const m of marks) {
    const f = m.family?.trim();
    if (f) set.add(f);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Canoniza una familia tecleada contra las existentes (F11): si lo escrito coincide
 * case-insensitive (tras trim) con una familia ya usada, adopta SU grafía exacta —
 * así "snatch"/"SNATCH" no fragmentan el grupo "Snatch". Si no hay coincidencia,
 * devuelve el texto tal cual (trim). Vacío → null (sin familia). Pura, client-safe.
 */
export function canonicalizeFamily(
  input: string,
  existing: readonly string[],
): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const key = trimmed.toLowerCase();
  const match = existing.find((f) => f.trim().toLowerCase() === key);
  return match ?? trimmed;
}

export interface DoubleReference {
  /** Valor de la ÚLTIMA entrada (vigente): cifra primaria/destacada. */
  last: number;
  /** Valor del RÉCORD (mejor según el tipo). */
  record: number;
  /** ¿récord ≠ última? → mostrar las dos referencias; si no, una sola línea. */
  distinct: boolean;
}

/**
 * Base de la calculadora de % con doble referencia (F04): la ÚLTIMA (vigente) y el
 * RÉCORD. `distinct` es true cuando difieren en valor (récord viejo por encima de la
 * última) → la UI muestra ambas cifras; si coinciden (una sola entrada, o la última
 * ya es el récord) → una sola línea. La última manda (protege contra programar sobre
 * un récord antiguo). Puro y derivado en lectura. null si no hay entradas.
 */
export function doubleReference(
  measureType: MeasureType,
  entries: readonly MarkEntryLike[],
): DoubleReference | null {
  const last = latestEntry(entries);
  const record = bestEntry(measureType, entries);
  if (!last || !record) return null;
  return { last: last.value, record: record.value, distinct: record.value !== last.value };
}

// ── Tiempo: se guarda en segundos, se muestra/edita como mm:ss (o h:mm:ss) ──

/**
 * Parsea "m:ss", "h:mm:ss" o un número suelto (segundos) a segundos. Devuelve null
 * si la cadena no es válida. Acepta coma o punto decimal en los segundos.
 */
export function parseTimeToSeconds(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (s === "") return null;
  if (!s.includes(":")) {
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const parts = s.split(":");
  if (parts.length > 3) return null;
  let total = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0) return null;
    total = total * 60 + n;
  }
  return total;
}

/** Formatea segundos como "m:ss" (o "h:mm:ss" a partir de 1 h). Redondea al segundo. */
export function formatSeconds(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Formatea un número sin teatro de precisión (máx 2 decimales, sin ceros de cola). */
export function formatNumber(value: number): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

/**
 * Parsea lo que teclea el usuario a un valor guardable (número). Tiempo → segundos
 * (acepta mm:ss); resto → número (acepta coma decimal). null si no es válido.
 */
export function parseMarkValue(
  measureType: MeasureType,
  input: string,
): number | null {
  if (measureType === "time") return parseTimeToSeconds(input);
  const trimmed = input.trim();
  if (trimmed === "") return null; // Number("") === 0 colaría como valor
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Valor de una marca listo para editar en un input: tiempo → mm:ss; resto → número. */
export function markValueToInput(
  measureType: MeasureType,
  value: number,
): string {
  return measureType === "time" ? formatSeconds(value) : String(value);
}

/** Valor de una marca listo para mostrar: tiempo → mm:ss; resto → número + unidad. */
export function formatMarkValue(
  measureType: MeasureType,
  value: number,
  unit: string,
): string {
  if (measureType === "time") return formatSeconds(value);
  return `${formatNumber(value)} ${unit}`.trim();
}
