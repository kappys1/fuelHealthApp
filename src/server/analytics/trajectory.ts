/*
  Trayectoria mensual (F22 · Fase 1) — PURO.

  Responde «¿lo estoy haciendo bien a largo plazo?»: el mismo ritmo de la cifra que
  manda, aplicado a los 3 últimos MESES NATURALES CERRADOS (jul · jun · may). No hay
  fórmula nueva: es `computeDeficit` llamado una vez por mes con la ventana del mes.

  Por qué meses naturales y no bloques rodantes de 30 d: un bloque rodante cambia
  cada día que pasa; «julio» es un hecho fijo, se compara consigo mismo mes a mes y
  es el idioma del nutricionista. El mes EN CURSO no aparece: ya es el titular.

  Gate idéntico al titular (≥8 pesajes, span ≥7 d) aplicado POR MES. Un mes que no
  llega sale `—`; nunca se estima. Con <2 meses válidos la línea entera se omite:
  con un solo punto no hay trayectoria que leer.

  Cada pesaje pertenece a un único mes (ventanas disjuntas, sin solape con el
  titular). Los 6 días previos al borde solo alimentan el suavizado de la ma7 —igual
  que en el titular—, no se cuentan como muestra del mes.
*/
import {
  endOfMonthKey,
  monthKeyOf,
  monthLabel,
  shiftMonthKey,
  startOfMonthKey,
} from "@/lib/dates";
import { computeDeficit } from "./deficit";
import type { AnalyticsRecord } from "./types";

/** Meses cerrados que se muestran en la trayectoria. */
export const TRAJECTORY_MONTHS = 3;
/** Meses válidos mínimos para que la línea tenga sentido. */
export const MIN_TRAJECTORY_MONTHS = 2;

export interface TrajectoryMonth {
  /** Clave de mes 'YYYY-MM'. */
  monthKey: string;
  /** Rótulo corto ("jul"). */
  label: string;
  /** kg/semana del mes, o null si el mes no llega al gate (se muestra "—"). */
  kgPerWeek: number | null;
  /** Déficit kcal/día del mes, o null. */
  deficitKcal: number | null;
  weighins: number;
}

export interface Trajectory {
  /** Del más reciente al más antiguo. Vacío si no hay línea que mostrar. */
  months: TrajectoryMonth[];
  /** ¿Hay ≥2 meses válidos? Si no, la UI omite la línea entera. */
  enough: boolean;
}

export function computeTrajectory(
  records: readonly AnalyticsRecord[],
  today: string,
  monthsBack: number = TRAJECTORY_MONTHS,
): Trajectory {
  const currentMonth = monthKeyOf(today);
  const months: TrajectoryMonth[] = [];

  for (let back = 1; back <= monthsBack; back++) {
    const monthKey = shiftMonthKey(currentMonth, -back);
    const result = computeDeficit(records, {
      from: startOfMonthKey(monthKey),
      to: endOfMonthKey(monthKey),
    });
    months.push({
      monthKey,
      label: monthLabel(monthKey),
      kgPerWeek: result.enough ? result.kgPerWeek : null,
      deficitKcal: result.enough ? result.deficitKcal : null,
      weighins: result.weighins,
    });
  }

  const valid = months.filter((month) => month.kgPerWeek != null).length;
  return {
    months: valid >= MIN_TRAJECTORY_MONTHS ? months : [],
    enough: valid >= MIN_TRAJECTORY_MONTHS,
  };
}
