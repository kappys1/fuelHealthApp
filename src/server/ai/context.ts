import { BLOAT_LABELS, MEAL_LABELS, MEAL_ORDER, phaseLabel } from "@/lib/macros";
import type { AdherenceResult } from "@/server/analytics/adherence";
import type { DeficitResult } from "@/server/analytics/deficit";
import type { MedWithDelta } from "@/server/analytics/medDeltas";
import type { DailyRecord } from "@/server/analytics/types";
import type { DayView } from "@/server/db/queries/day";
import type { EffectiveTargets, PlanOptionDTO } from "@/server/db/queries/plan";

/*
  Ensamblado de CONTEXTO para las features conversacionales de IA (coach F-IA-6,
  preparar-visita F-IA-7, chat F-IA-8). Formatea datos ya leídos de la BD en las
  líneas EXACTAS que piden los prompts de 04-IA. No llama a la IA ni a la BD.
*/

const num = (n: number, d = 0) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: d });

/**
 * Una línea por día (F-IA-7 / F-IA-8): kcal y macros o «sin registro», peso,
 * sesión, fase, hinchazón, notas entrecomilladas, agua, sueño, HRV.
 */
export function dayLine(r: DailyRecord): string {
  const parts: string[] = [r.date];
  parts.push(
    r.logged
      ? `${Math.round(r.kcal)} kcal (${Math.round(r.prot)}P/${Math.round(r.carb)}C/${Math.round(r.fat)}F)`
      : "sin registro",
  );
  if (r.weight != null) parts.push(`peso ${num(r.weight, 1)} kg`);
  if (r.sessionLabel) parts.push(r.sessionLabel);
  parts.push(`fase ${phaseLabel(r.phase)}`);
  if (r.bloat) parts.push(`hinchazón ${BLOAT_LABELS[r.bloat].toLowerCase()}`);
  if (r.waterL != null) parts.push(`agua ${num(r.waterL, 1)} L`);
  if (r.sleepH != null && r.sleepH > 0) parts.push(`sueño ${num(r.sleepH, 1)} h`);
  if (r.hrvMs != null) parts.push(`HRV ${Math.round(r.hrvMs)}`);
  if (r.notes?.trim()) parts.push(`notas: "${r.notes.trim()}"`);
  return parts.join(" · ");
}

/** Últimos `n` días (con datos) como bloque de líneas. */
export function dayLines(records: readonly DailyRecord[], n: number): string {
  const rows = records.slice(-n);
  if (rows.length === 0) return "Sin registros todavía.";
  return rows.map(dayLine).join("\n");
}

/** Historial MED completo (se compara solo consigo mismo, principio 5). */
export function medLines(meds: readonly MedWithDelta[]): string {
  if (meds.length === 0) return "Sin mediciones registradas.";
  return meds
    .map((m) => {
      const bits = [m.date];
      if (m.fatKg != null) bits.push(`grasa ${num(m.fatKg, 2)} kg`);
      if (m.muscleKg != null) bits.push(`músculo ${num(m.muscleKg, 2)} kg`);
      if (m.weightKg != null) bits.push(`peso ${num(m.weightKg, 1)} kg`);
      return bits.join(" · ");
    })
    .join("\n");
}

/** Resumen de tendencia para F-IA-7 (o «Aún sin tendencia fiable»). */
export function trendSummary(deficit: DeficitResult): string {
  if (!deficit.enough || deficit.kgPerWeek == null) {
    return "Aún sin tendencia fiable.";
  }
  const kg = deficit.kgPerWeek;
  const kgStr = `${kg > 0 ? "+" : ""}${num(kg, 2)} kg/semana`;
  return `${kgStr}, déficit real ~${num(deficit.deficitKcal ?? 0)} kcal/día, gasto real estimado ${num(deficit.tdee ?? 0)} kcal/día.`;
}

/** Tendencia + adherencia para el chat (F-IA-8 §3): mismas cifras que la pantalla. */
export function trendAndAdherence(
  deficit: DeficitResult,
  adherence: AdherenceResult,
): string {
  const a = `Adherencia (14 d): ${adherence.n} días con registro; en fase Normal ${adherence.enRango}/${adherence.normalN} en rango de kcal y ${adherence.protOk}/${adherence.normalN} con proteína suficiente.`;
  return `${trendSummary(deficit)}\n${a}`;
}

/** Dieta vigente para el chat (F-IA-8 §2): objetivos + resumen del plan por comidas. */
export function planSummary(
  targets: EffectiveTargets,
  optionsByMeal: Record<string, PlanOptionDTO[]>,
): string {
  const lines = [
    `Objetivos: ${targets.kcal} kcal, ${Math.round(targets.prot)} g proteína, ~${Math.round(targets.carb)} g hidratos, ~${Math.round(targets.fat)} g grasa.`,
  ];
  for (const meal of MEAL_ORDER) {
    if (meal === "extra") continue;
    const opts = optionsByMeal[meal] ?? [];
    if (opts.length === 0) continue;
    const names = opts
      .map((o) => (o.baseG != null ? `${o.name} (${o.baseG} g)` : o.name))
      .join(", ");
    lines.push(`${MEAL_LABELS[meal]}: ${names}.`);
  }
  return lines.join("\n");
}

/**
 * Contexto del día EN CURSO / TERMINADO para el coach (F-IA-6): comidas con
 * macros por item, totales, peso, sesión (+kcal), fase, agua, hinchazón, notas y
 * métricas del reloj (pasos, activas, basales, HRV, sueño).
 */
export function dayContext(view: DayView): string {
  const { day, health, entries } = view;
  const lines: string[] = [];

  if (entries.length === 0) {
    lines.push("Comidas: ninguna registrada aún.");
  } else {
    lines.push("Comidas:");
    for (const e of entries) {
      lines.push(
        `- [${e.meal}] ${e.name}: ${Math.round(e.kcal)} kcal (${Math.round(e.prot)}P/${Math.round(e.carb)}C/${Math.round(e.fat)}F)`,
      );
    }
    const tot = entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        prot: acc.prot + e.prot,
        carb: acc.carb + e.carb,
        fat: acc.fat + e.fat,
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 },
    );
    lines.push(
      `Totales: ${Math.round(tot.kcal)} kcal · ${Math.round(tot.prot)} g prot · ${Math.round(tot.carb)} g hidr · ${Math.round(tot.fat)} g grasa.`,
    );
  }

  const ctx: string[] = [];
  const weight = day?.weight ?? health?.weight ?? null;
  if (weight != null) ctx.push(`peso ${num(weight, 1)} kg`);
  if (day?.sessionLabel) {
    ctx.push(
      day.sessionKcal != null
        ? `sesión ${day.sessionLabel} (~${day.sessionKcal} kcal, contexto ±25%)`
        : `sesión ${day.sessionLabel}`,
    );
  }
  ctx.push(`fase ${phaseLabel(day?.phase ?? null)}`);
  const waterL = day?.waterL ?? health?.waterL ?? null;
  if (waterL != null) ctx.push(`agua ${num(waterL, 1)} L`);
  if (day?.bloat) ctx.push(`hinchazón ${BLOAT_LABELS[day.bloat].toLowerCase()}`);
  if (health?.steps != null) ctx.push(`${num(health.steps)} pasos`);
  if (health?.activeKcal != null) ctx.push(`${health.activeKcal} kcal activas`);
  if (health?.basalKcal != null) ctx.push(`${health.basalKcal} kcal basales`);
  if (health?.hrvMs != null) ctx.push(`HRV ${Math.round(health.hrvMs)} ms`);
  if (health?.sleepH != null && health.sleepH > 0)
    ctx.push(`sueño ${num(health.sleepH, 1)} h`);
  if (ctx.length) lines.push(`Contexto: ${ctx.join(" · ")}.`);

  if (day?.notes?.trim()) lines.push(`Notas: "${day.notes.trim()}".`);

  return lines.join("\n");
}
