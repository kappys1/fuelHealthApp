/*
  Adherencia de los últimos 14 días con registro (03-DATOS §3 / F6.3) — PURO.

    n        = días con kcal registradas (en la ventana)
    normalN  = de esos, con phase == Normal
    enRango  = normalN con |kcal − objetivo| / objetivo ≤ 0,10
    protOk   = normalN con prot ≥ 0,90 × objetivoProt

  Solo los días en fase Normal cuentan para en-rango y proteína (principio 4: en
  Carga/Competición/Recuperación pasarse NO es desviación). Cada día se evalúa
  contra su objetivo vigente (F1.5), que viaja en `record.target`.
*/
import { shiftDayKey } from "@/lib/dates";
import type { AnalyticsRecord } from "./types";

export const ADHERENCE_WINDOW = 14;
export const KCAL_TOLERANCE = 0.1;
export const PROT_MIN_RATIO = 0.9;

export interface AdherenceResult {
  windowDays: number;
  n: number;
  normalN: number;
  enRango: number;
  protOk: number;
}

export function computeAdherence(
  records: readonly AnalyticsRecord[],
  today: string,
  windowDays: number = ADHERENCE_WINDOW,
): AdherenceResult {
  const lo = shiftDayKey(today, -(windowDays - 1));
  const win = records.filter(
    (r) => r.logged && r.date >= lo && r.date <= today,
  );

  const normal = win.filter(
    (r) => r.phase == null && r.target.kcal > 0 && r.target.prot > 0,
  );
  const enRango = normal.filter(
    (r) =>
      r.target.kcal > 0 &&
      Math.abs(r.kcal - r.target.kcal) / r.target.kcal <= KCAL_TOLERANCE,
  ).length;
  const protOk = normal.filter(
    (r) => r.target.prot > 0 && r.prot >= PROT_MIN_RATIO * r.target.prot,
  ).length;

  return {
    windowDays,
    n: win.length,
    normalN: normal.length,
    enRango,
    protOk,
  };
}
