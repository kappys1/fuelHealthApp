/*
  Utilidades de macros: escalado por gramos, redondeo y formato.
  Reglas (CLAUDE.md / 05-DISENO §3 / 03-DATOS):
  - kcal: enteras. Macros: se pueden GUARDAR con 1 decimal; en UI van SIN decimales.
  - Los totales cuadran con la suma VISIBLE → redondear al final, no por item.
  - Escalado (§3): factor = gramos / base_g; aplica a kcal y los 3 macros.
    base_g null = unidades fijas ("4 huevos") → no se escala.
*/

export interface Macros {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

/** Escalado por gramos (03-DATOS §3). base_g null/0 → unidades fijas, sin escalar. */
export function scaleMacros(
  base: Macros,
  grams: number,
  baseG: number | null | undefined,
): Macros {
  if (baseG == null || baseG === 0) return { ...base };
  const factor = grams / baseG;
  return {
    kcal: base.kcal * factor,
    prot: base.prot * factor,
    carb: base.carb * factor,
    fat: base.fat * factor,
  };
}

export const roundKcal = (n: number): number => Math.round(n);
/** Redondeo de macro para PERSISTIR (1 decimal permitido). */
export const roundMacroStore = (n: number): number => Math.round(n * 10) / 10;
/** Redondeo de macro para MOSTRAR (entero, sin teatro de precisión). */
export const displayMacro = (n: number): number => Math.round(n);

/** Suma de una lista de macros (sin redondear; redondear al mostrar). */
export function sumMacros(items: readonly Macros[]): Macros {
  return items.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      prot: acc.prot + m.prot,
      carb: acc.carb + m.carb,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, prot: 0, carb: 0, fat: 0 },
  );
}

/** Escala y redondea para guardar una entrada (kcal entera, macros 1 decimal). */
export function scaledForStore(
  base: Macros,
  grams: number,
  baseG: number | null | undefined,
): Macros {
  const s = scaleMacros(base, grams, baseG);
  return {
    kcal: roundKcal(s.kcal),
    prot: roundMacroStore(s.prot),
    carb: roundMacroStore(s.carb),
    fat: roundMacroStore(s.fat),
  };
}

/** Formato compacto de macros para la UI: "46P/0C/5F" (enteros). */
export function formatMacros(m: Macros): string {
  return `${displayMacro(m.prot)}P/${displayMacro(m.carb)}C/${displayMacro(m.fat)}F`;
}

// ── Gramos como dato de primera clase (F06) ──
/*
  Persistencia de la BASE inmutable + cantidad actual de una entrada del día
  (meal_entries). Regla (03-DATOS §3 / spec F06): todo reescalado se calcula
  SIEMPRE desde la base con scaleMacros(base, grams, baseG); NUNCA sobre valores
  ya reescalados → sin deriva de redondeo al editar la cantidad ida y vuelta.
  baseG null = entrada fija (sin escalado): "4 huevos", café, backfill no parseable.
*/

/** Campos de base+cantidad que persiste una entrada (todos null = entrada fija). */
export interface EntryBaseFields {
  grams: number | null;
  baseG: number | null;
  baseKcal: number | null;
  baseProt: number | null;
  baseCarb: number | null;
  baseFat: number | null;
}

/**
 * Construye los campos de base+cantidad para PERSISTIR una entrada escalable.
 * `base` son las macros a `baseG` (la referencia inmutable); `grams` la cantidad
 * actual. baseG null/0 → entrada fija (todos los campos null, sin stepper).
 */
export function entryBaseFields(
  base: Macros,
  grams: number,
  baseG: number | null | undefined,
): EntryBaseFields {
  if (baseG == null || baseG === 0) {
    return {
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    };
  }
  return {
    grams: Math.round(grams),
    baseG: Math.round(baseG),
    baseKcal: roundKcal(base.kcal),
    baseProt: roundMacroStore(base.prot),
    baseCarb: roundMacroStore(base.carb),
    baseFat: roundMacroStore(base.fat),
  };
}

/**
 * Parser conservador del sufijo de cantidad al FINAL del nombre: "· NN g" /
 * "· NN ml" (también "gr"/"gramos"). Devuelve la cantidad y el nombre sin sufijo,
 * o null si no hay un patrón claro (ante duda, la entrada queda fija — nunca se
 * inventa una base). No matchea si el nombre quedaría vacío al quitar el sufijo.
 */
export function parseGramsSuffix(
  name: string,
): { grams: number; cleanName: string } | null {
  const m = name.match(/\s*·\s*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos|ml)\.?\s*$/i);
  if (!m || m.index === undefined || m[1] === undefined) return null;
  const grams = Math.round(Number(m[1].replace(",", ".")));
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const cleanName = name.slice(0, m.index).trim();
  if (cleanName === "") return null;
  return { grams, cleanName };
}

/**
 * Backfill de una entrada existente: si su nombre lleva "· NN g|ml", la convierte
 * en escalable (grams = baseG = NN, base = sus macros actuales) y limpia el sufijo
 * del nombre. Si no hay patrón claro, queda fija (base null) conservando el nombre
 * y las macros intactas. Función pura: la usan migrate:poc y el script de backfill.
 */
export function backfillEntryGrams(entry: {
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}): { name: string } & EntryBaseFields {
  const parsed = parseGramsSuffix(entry.name);
  if (!parsed) {
    return {
      name: entry.name,
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    };
  }
  return {
    name: parsed.cleanName,
    grams: parsed.grams,
    baseG: parsed.grams,
    baseKcal: roundKcal(entry.kcal),
    baseProt: roundMacroStore(entry.prot),
    baseCarb: roundMacroStore(entry.carb),
    baseFat: roundMacroStore(entry.fat),
  };
}

// ── Productos (F07) ──
/*
  Un producto tiene macros por base de gramos (baseG, típicamente 100 g de la
  etiqueta). Al añadirlo al día se reescala a la cantidad elegida SIEMPRE desde la
  base inmutable (reusa la maquinaria de F06). baseG null/0 = producto fijo (por
  unidad): se añade tal cual, sin escalar y sin base (como los antiguos favoritos).
*/
export interface ProductBase {
  baseG: number | null;
  baseKcal: number;
  baseProt: number;
  baseCarb: number;
  baseFat: number;
}

/**
 * Construye macros (para mostrar/guardar) + campos de base (F06) de una entrada a
 * partir de un producto y una cantidad. Con baseG → reescala desde la base (la
 * entrada queda escalable). Con baseG null → entrada fija: macros = base tal cual,
 * campos de base null (AC2). Los gramos son la palanca; las macros derivan (AC1).
 */
export function productToEntryFields(
  p: ProductBase,
  grams: number,
): Macros & EntryBaseFields {
  const base: Macros = {
    kcal: p.baseKcal,
    prot: p.baseProt,
    carb: p.baseCarb,
    fat: p.baseFat,
  };
  if (p.baseG == null || p.baseG === 0) {
    return {
      kcal: roundKcal(base.kcal),
      prot: roundMacroStore(base.prot),
      carb: roundMacroStore(base.carb),
      fat: roundMacroStore(base.fat),
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    };
  }
  return {
    ...scaledForStore(base, grams, p.baseG),
    ...entryBaseFields(base, grams, p.baseG),
  };
}

// ── Variantes de opción del plan (F08) ──
/*
  Una opción de la pauta puede agrupar alimentos intercambiables con macros por
  ración materialmente distintas ("carne magra (pollo/pavo/ternera/cerdo)"). En vez
  de llenar el plan de filas (el plan es espejo de la pauta; principio 8), la opción
  guarda una lista de VARIANTES: cada una con su nombre y sus macros PARA LOS MISMOS
  gramos pautados (base_g de la opción). Lista vacía = opción normal (comportamiento
  intacto de hoy). Los campos planos de la opción valen los de la PRIMERA variante
  (el default), así el editor del plan y las filas sin variantes no cambian.
  La precisión se resuelve al REGISTRAR (chips de variante), no al importar.
*/
export interface PlanVariant {
  nombre: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

/**
 * Macros (mostrar/guardar) + campos de base (F06) de una entrada a partir de una
 * VARIANTE elegida y la cantidad. La variante aporta las macros a `baseG` (la base
 * inmutable); se reescala SIEMPRE desde ahí (reusa la maquinaria de F06). baseG
 * null/0 → entrada fija: macros = las de la variante tal cual, sin base.
 */
export function variantToEntryFields(
  v: PlanVariant,
  baseG: number | null | undefined,
  grams: number,
): Macros & EntryBaseFields {
  const base: Macros = { kcal: v.kcal, prot: v.prot, carb: v.carb, fat: v.fat };
  if (baseG == null || baseG === 0) {
    return {
      kcal: roundKcal(base.kcal),
      prot: roundMacroStore(base.prot),
      carb: roundMacroStore(base.carb),
      fat: roundMacroStore(base.fat),
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    };
  }
  return {
    ...scaledForStore(base, grams, baseG),
    ...entryBaseFields(base, grams, baseG),
  };
}

// ── Etiquetas y órdenes fijos (03-DATOS §2) ──
export const MEAL_ORDER = [
  "almuerzo",
  "comida",
  "merienda",
  "cena",
  "extra",
] as const;
export type MealKey = (typeof MEAL_ORDER)[number];

export const MEAL_LABELS: Record<MealKey, string> = {
  almuerzo: "Almuerzo",
  comida: "Comida",
  merienda: "Merienda",
  cena: "Cena",
  extra: "Extra",
};

export const GRP_ORDER = [
  "Verdura",
  "Hidratos",
  "Proteína",
  "Grasa",
  "Otros",
  "Opción única",
] as const;
export type GrpKey = (typeof GRP_ORDER)[number];

// Fases: Normal = null en BD (03-DATOS §2). El resto son valores de enum.
export type PhaseKey = "carga" | "competicion" | "recuperacion";
export const PHASE_LABELS: Record<PhaseKey, string> = {
  carga: "Carga pre-competición",
  competicion: "Competición",
  recuperacion: "Recuperación post-competición",
};
/** Fase = null se muestra como "Normal". */
export const phaseLabel = (p: PhaseKey | null | undefined): string =>
  p ? PHASE_LABELS[p] : "Normal";

/** Fases especiales: el exceso NO es desviación (principio 4). */
export const isSpecialPhase = (p: PhaseKey | null | undefined): boolean =>
  p != null && p !== undefined;

export type BloatKey = "ninguna" | "leve" | "moderada" | "alta";
export const BLOAT_LABELS: Record<BloatKey, string> = {
  ninguna: "Ninguna",
  leve: "Leve",
  moderada: "Moderada",
  alta: "Alta",
};

// Sesiones predefinidas de The Progrm (03-DATOS §2) + Competición/Descanso.
export const SESSIONS = [
  "T1 · Halterofilia + WOD",
  "T2 · Carrera + Gimnásticos",
  "T3 · Fuerza + Gimnásticos",
  "T4 · Aeróbico / Descanso activo",
  "T5 · Halterofilia + WOD",
  "T6 · Mash largo",
  "Competición",
  "Descanso",
] as const;

// Secuencia sugerida de fase tras un día especial (09 §5 defaults).
export const PHASE_NEXT: Record<PhaseKey, PhaseKey | null> = {
  carga: "competicion",
  competicion: "recuperacion",
  recuperacion: null,
};

// Mapeo por defecto día-de-semana (ISO 1=L…7=D) → sesión (09 §5 defaults;
// The Progrm es semanal). Configurable en Ajustes (settings.sessionByWeekday).
export type SessionByWeekday = Record<string, string>;
export const DEFAULT_SESSION_BY_WEEKDAY: SessionByWeekday = {
  "1": SESSIONS[0], // L → T1
  "2": SESSIONS[1], // M → T2
  "3": SESSIONS[2], // X → T3
  "4": SESSIONS[3], // J → T4
  "5": SESSIONS[4], // V → T5
  "6": SESSIONS[5], // S → T6
  "7": SESSIONS[7], // D → Descanso
};
export const WEEKDAY_LABELS: Record<string, string> = {
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
  "6": "Sábado",
  "7": "Domingo",
};
