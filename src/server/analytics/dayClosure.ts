/*
  Cierre del día para el coach (F-IA-6), DETERMINISTA y en SERVIDOR.

  Causa raíz (ai-tuner, 25-jul, export de 5 mensajes reales 20-24 jul): el coach
  tenía «compulsión de cuadrar» — sugería comida para huecos triviales («faltan
  10 kcal → salmón», «67 kcal → 3 g de AOVE», «19 kcal → 15 g de pollo») porque el
  prompt pedía «una sugerencia concreta para cuadrar» INCONDICIONALMENTE. Arreglo
  por DATO, no por prompt (jerarquía del skill: dato > diseño > prompt): el
  servidor decide QUÉ procede (cerrar, priorizar proteína, no tocar, comentar un
  exceso) y el prompt del coach solo gobierna el TONO.

  Tres capas, todas puras (sin IA ni BD):
   (1) classifyClosure — clase del cierre por umbrales fijos sobre el veredicto.
   (2) objectiveStance — doctrina (techo/banda/suelo) DERIVADA del texto del
       objetivo vigente del perfil (principio 9: nada cableado; cuando cambie el
       objetivo, cambia la doctrina sin tocar código).
   (3) trainingTiming — relación de la hora actual con la franja de entreno de hoy.

  Umbrales y palabras clave son DISCUTIBLES (DECISIONS 25-jul).
*/
import type { GaugeVerdict } from "./gaugeVerdict";
import type { TrainingSlotResolution } from "@/lib/training-slot";

// ── (1) Clase del cierre ─────────────────────────────────────────────────────

/** Umbrales de clasificación del cierre (discutibles; DECISIONS 25-jul). */
export const CLOSURE_THRESHOLDS = {
  /** Por debajo de estas kcal restantes (con proteína cubierta) el día está cerrado. */
  sinHuecoKcal: 100,
  /** Proteína restante (g) desde la que cerrar proteína es la prioridad. */
  protPrioritariaG: 10,
  /** kcal restantes desde las que el hueco se considera material (con proteína ok). */
  huecoMaterialKcal: 150,
  /** Hidrato restante (g) desde el que el timing pre-entreno es relevante. */
  carbMaterialG: 20,
} as const;

export type ClosureClass =
  | "sin_hueco"
  | "proteina_prioritaria"
  | "hueco_material"
  | "exceso";

/**
 * Clase del cierre a partir del veredicto determinista del FuelGauge. Orden de
 * precedencia (importa):
 *   1. exceso — ya por encima del techo de kcal. Manda sobre todo: el techo de
 *      kcal manda sobre cerrar macros, así que aquí NO se prescribe añadir aunque
 *      falte proteína (doctrina fija del skill).
 *   2. proteina_prioritaria — proteína restante ≥ umbral (la proteína es un suelo
 *      en cualquier objetivo).
 *   3. hueco_material — proteína ok y kcal restantes ≥ umbral material.
 *   4. sin_hueco — proteína ok y kcal restantes por debajo del umbral material
 *      (incluye la banda intermedia [sinHuecoKcal, huecoMaterialKcal): un hueco
 *      pequeño con proteína cubierta se trata como día cerrado; quedarse algo
 *      corto no es un hueco que rellenar).
 */
export function classifyClosure(
  v: GaugeVerdict,
  t: typeof CLOSURE_THRESHOLDS = CLOSURE_THRESHOLDS,
): ClosureClass {
  if (v.over) return "exceso";
  if (v.prot.remaining >= t.protPrioritariaG) return "proteina_prioritaria";
  if (v.kcalRemaining >= t.huecoMaterialKcal) return "hueco_material";
  return "sin_hueco";
}

// ── (2) Doctrina por objetivo vigente ────────────────────────────────────────

/**
 * Doctrina del cierre según el objetivo vigente:
 *   deficit       → el objetivo es un TECHO (quedarse corto es correcto).
 *   mantenimiento → una BANDA (±10 %: huecos y excesos pequeños no se comentan).
 *   superavit     → un SUELO (quedarse corto es el fallo).
 *   desconocido   → sin objetivo mapeable → conservador (no empujar; como techo).
 */
export type Stance = "deficit" | "mantenimiento" | "superavit" | "desconocido";

// Palabras clave (sin acentos, minúsculas) por doctrina. DÉFICIT tiene prioridad:
// una recomposición dice «perder grasa» y «ganando músculo» a la vez, y su
// doctrina es techo (definición). DISCUTIBLE (DECISIONS 25-jul).
const DEFICIT_KEYS = [
  "definici",
  "deficit",
  "recomp",
  "perder grasa",
  "perder peso",
  "perdida de grasa",
  "adelgaz",
  "cutting",
  "secar",
];
const SURPLUS_KEYS = [
  "volumen",
  "superavit",
  "ganar masa",
  "ganar musculo",
  "ganancia muscular",
  "hipertrofia",
  "bulk",
];
const MAINTENANCE_KEYS = ["mantenimiento", "mantener", "sostener"];

/** Fracción de banda para mantenimiento (±10 % del objetivo de kcal). */
export const MAINTENANCE_BAND = 0.1;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function objectiveStance(texto: string | null | undefined): Stance {
  if (!texto?.trim()) return "desconocido";
  const t = normalize(texto);
  if (DEFICIT_KEYS.some((k) => t.includes(k))) return "deficit";
  if (SURPLUS_KEYS.some((k) => t.includes(k))) return "superavit";
  if (MAINTENANCE_KEYS.some((k) => t.includes(k))) return "mantenimiento";
  return "desconocido";
}

// ── (3) Timing respecto a la franja de entreno de hoy ─────────────────────────

export type TimingRel = TrainingSlotResolution["value"];

export interface TrainingTiming {
  rel: TimingRel;
}

/**
 * Adaptador puro entre la resolución canónica y la directriz de cierre. No
 * inventa horas, ni afirma si la sesión ya ocurrió.
 */
export function trainingTiming(
  value: TrainingSlotResolution["value"],
): TrainingTiming {
  return { rel: value };
}
