/*
  Tipos compartidos de la analítica de Tendencia (03-DATOS §3 / F6).

  Las funciones de `server/analytics/` son PURAS y sin dependencias de BD, así que
  se pueden importar también en el cliente (la pantalla Tendencia recalcula al
  cambiar el rango sin volver a pedir datos). El ensamblado desde la BD (con la
  precedencia health_metrics > days del principio 6) vive en
  `server/db/queries/trend.ts`.
*/
import type { BloatKey, PhaseKey } from "@/lib/macros";

/** Objetivos vigentes para una fecha (versión de dieta efectiva ese día, F1.5). */
export interface DayTarget {
  kcal: number;
  prot: number;
}

/**
 * Lo mínimo que necesitan las fórmulas (ma7, déficit, adherencia). Estructural:
 * un `DailyRecord` completo lo satisface, y los tests construyen objetos mínimos.
 * `phase == null` ⇒ Normal (03-DATOS §2). `logged` = el día tiene ≥1 entrada.
 */
export interface AnalyticsRecord {
  date: string; // 'YYYY-MM-DD' (Europe/Madrid)
  weight: number | null; // peso efectivo (health ?? manual)
  phase: PhaseKey | null;
  logged: boolean;
  kcal: number;
  prot: number;
  target: DayTarget;
}

/** Registro diario completo para la pantalla Tendencia y la tabla «Últimos días» (F4.4). */
export interface DailyRecord extends AnalyticsRecord {
  carb: number;
  fat: number;
  // Extras de presentación (del reloj / del día) — la analítica los ignora.
  steps: number | null;
  activeKcal: number | null;
  basalKcal: number | null;
  hrvMs: number | null;
  sleepH: number | null;
  restingHr: number | null;
  bodyFatPct: number | null;
  waterL: number | null;
  sessionLabel: string | null;
  bloat: BloatKey | null;
}
