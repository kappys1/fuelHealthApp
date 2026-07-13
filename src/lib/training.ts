import { SESSIONS } from "@/lib/macros";

/*
  Helpers puros de entrenamiento (doc 10 Fase B). Client-safe: NO importa el schema
  de servidor (drizzle). Los valores de `TRAINING_TIPOS` deben coincidir 1:1 con
  `trainingTipoEnum` en `src/server/db/schema.ts` (se mantienen sincronizados a mano).
*/

export const TRAINING_TIPOS = [
  "fuerza",
  "halterofilia",
  "gimnasticos",
  "metabolico",
  "aerobico",
  "mixto",
  "descanso",
  "otro",
] as const;
export type TrainingTipo = (typeof TRAINING_TIPOS)[number];

export const TRAINING_TIPO_LABELS: Record<TrainingTipo, string> = {
  fuerza: "Fuerza",
  halterofilia: "Halterofilia",
  gimnasticos: "Gimnásticos",
  metabolico: "Metabólico",
  aerobico: "Aeróbico",
  mixto: "Mixto",
  descanso: "Descanso",
  otro: "Otro",
};

/**
 * kcal de sesión para `days.sessionKcal` a partir del rango estimado (F-IA-5):
 * media redondeada; si falta un extremo usa el otro; null si no hay datos.
 */
export function sessionKcal(
  min: number | null | undefined,
  max: number | null | undefined,
): number | null {
  const lo = min ?? null;
  const hi = max ?? null;
  if (lo == null && hi == null) return null;
  if (lo == null) return Math.round(hi as number);
  if (hi == null) return Math.round(lo);
  return Math.round((lo + hi) / 2);
}

/**
 * Periodo del plan (`valid_from`/`valid_to`) a partir de las fechas asignadas a las
 * sesiones. Las claves 'YYYY-MM-DD' ordenan lexicográficamente. null si no hay fechas.
 */
export function planSpanFromAssignments(
  dates: readonly string[],
): { validFrom: string; validTo: string } | null {
  const valid = dates
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .slice()
    .sort();
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (!first || !last) return null;
  return { validFrom: first, validTo: last };
}

/**
 * Opciones del dropdown de sesión (doc 10 B3):
 * - CON semana importada → sus sesiones reales (por nombre) + Competición + Descanso.
 *   Las genéricas T1–T6 se ocultan (eran ruido cuando ya hay plan).
 * - SIN semana → la lista genérica SESSIONS (T1–T6 + Competición + Descanso).
 * Deduplica conservando el orden.
 */
export function orderedSessionOptions(
  planSessionNames: readonly string[],
): string[] {
  if (planSessionNames.length === 0) return [...SESSIONS];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (v: string) => {
    const t = v.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const n of planSessionNames) add(n);
  add("Competición");
  add("Descanso");
  return out;
}

/**
 * Patch de día al elegir una sesión en el dropdown (doc 10 B3). Si el label es una
 * sesión real del plan, ancla `sessionRef` + su kcal estimada; si es genérica/
 * Competición/Descanso, `sessionRef` = null (y limpia la kcal estimada del plan).
 */
export function sessionPatchFor(
  label: string,
  sessions: readonly {
    id: number;
    nombre: string;
    kcalMin: number | null;
    kcalMax: number | null;
  }[],
): { sessionLabel: string; sessionRef: number | null; sessionKcal: number | null } {
  const s = sessions.find((x) => x.nombre === label);
  if (s) {
    return {
      sessionLabel: s.nombre,
      sessionRef: s.id,
      sessionKcal: sessionKcal(s.kcalMin, s.kcalMax),
    };
  }
  return { sessionLabel: label, sessionRef: null, sessionKcal: null };
}
