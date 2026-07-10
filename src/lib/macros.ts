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
