import { dayKey, isoWeekday } from "@/lib/dates";
import {
  BLOAT_LABELS,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  phaseLabel,
  type SessionByWeekday,
} from "@/lib/macros";
import {
  bestEntry,
  formatMarkValue,
  formatNumber,
  formatSeconds,
  latestEntry,
  MEASURE_TYPE_LABELS,
  sortEntriesAsc,
} from "@/lib/marks";
import { TRAINING_TIPO_LABELS } from "@/lib/training";
import type { MarkDTO } from "@/server/db/queries/marks";
import type { AdherenceResult } from "@/server/analytics/adherence";
import type { DeficitResult } from "@/server/analytics/deficit";
import type { MedWithDelta } from "@/server/analytics/medDeltas";
import type { DailyRecord } from "@/server/analytics/types";
import type { DatedEntry, DayView } from "@/server/db/queries/day";
import type { EffectiveTargets, PlanOptionDTO } from "@/server/db/queries/plan";
import { planOptionsList } from "./prompts";

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
 * `calendarFallback`: si el día no tiene sesión registrada, la sesión que toca
 * según el calendario semanal (doc 10 A4; se usa solo para el día en curso).
 */
export function dayLine(
  r: DailyRecord,
  calendarFallback?: string | null,
): string {
  const parts: string[] = [r.date];
  parts.push(
    r.logged
      ? `${Math.round(r.kcal)} kcal (${Math.round(r.prot)}P/${Math.round(r.carb)}C/${Math.round(r.fat)}F)`
      : "sin registro",
  );
  if (r.weight != null) parts.push(`peso ${num(r.weight, 1)} kg`);
  if (r.sessionLabel) parts.push(r.sessionLabel);
  else if (calendarFallback)
    parts.push(`sin sesión registrada (calendario: ${calendarFallback})`);
  parts.push(`fase ${phaseLabel(r.phase)}`);
  if (r.bloat) parts.push(`hinchazón ${BLOAT_LABELS[r.bloat].toLowerCase()}`);
  if (r.waterL != null) parts.push(`agua ${num(r.waterL, 1)} L`);
  if (r.sleepH != null && r.sleepH > 0) parts.push(`sueño ${num(r.sleepH, 1)} h`);
  if (r.hrvMs != null) parts.push(`HRV ${Math.round(r.hrvMs)}`);
  if (r.notes?.trim()) parts.push(`notas: "${r.notes.trim()}"`);
  return parts.join(" · ");
}

/**
 * Últimos `n` días (con datos) como bloque de líneas. `calendar` (doc 10 A4):
 * para el día en curso sin sesión registrada, anota la sesión que toca según el
 * calendario semanal (mismo tratamiento que el coach para chat/visita).
 */
export function dayLines(
  records: readonly DailyRecord[],
  n: number,
  calendar?: { sessionByWeekday: SessionByWeekday; today: string },
): string {
  const rows = records.slice(-n);
  if (rows.length === 0) return "Sin registros todavía.";
  return rows
    .map((r) => {
      const fallback =
        calendar && r.date === calendar.today
          ? (calendar.sessionByWeekday[String(isoWeekday(r.date))] ?? "Descanso")
          : null;
      return dayLine(r, fallback);
    })
    .join("\n");
}

/**
 * Detalle de comidas por item de los últimos días (F02): además de los totales
 * por día (dayLines), el chat ve QUÉ comió en cada comida, con el mismo grano que
 * el coach. Agrupado por fecha, hoy primero. Vacío ("") si no hay comidas en el
 * rango → el prompt omite la sección y el guardarraíl anti-invención cubre el resto.
 */
export function recentMealsDetail(entries: readonly DatedEntry[]): string {
  if (entries.length === 0) return "";
  const byDate = new Map<string, DatedEntry[]>();
  for (const e of entries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const dates = [...byDate.keys()].sort().reverse(); // hoy primero
  return dates
    .map((d) => {
      const items = (byDate.get(d) ?? [])
        .map(
          (e) =>
            `- [${e.meal}] ${e.name}: ${Math.round(e.kcal)} kcal (${Math.round(e.prot)}P/${Math.round(e.carb)}C/${Math.round(e.fat)}F)`,
        )
        .join("\n");
      return `${d}:\n${items}`;
    })
    .join("\n");
}

/**
 * Marcas de rendimiento (F03) para el contexto de Chat/Visita (NO Coach diario):
 * cada marca con su última entrada, récord y progresión reciente (últimas 5), para
 * que la IA pueda hablar de PROGRESIÓN bajo demanda. Es interpolación de datos
 * (principio 9); el guardarraíl anti-sobreatribución vive en el prompt. Vacío si no
 * hay marcas con registros → el prompt omite la sección.
 */
export function marksContext(marks: readonly MarkDTO[]): string {
  const lines: string[] = [];
  for (const m of marks) {
    if (m.entries.length === 0) continue;
    const asc = sortEntriesAsc(m.entries);
    const latest = latestEntry(asc);
    const best = bestEntry(m.measureType, asc);
    if (!latest || !best) continue;
    const recent = asc.slice(-5);
    const prog =
      m.measureType === "time"
        ? recent.map((e) => formatSeconds(e.value)).join("→")
        : `${recent.map((e) => formatNumber(e.value)).join("→")} ${m.unit}`;
    const parts = [
      `${m.name} (${MEASURE_TYPE_LABELS[m.measureType]})`,
      `última ${formatMarkValue(m.measureType, latest.value, m.unit)} (${latest.recordedOn})`,
    ];
    if (best.id !== latest.id) {
      parts.push(
        `récord ${formatMarkValue(m.measureType, best.value, m.unit)} (${best.recordedOn})`,
      );
    }
    parts.push(`progresión: ${prog}`);
    lines.push(`- ${parts.join("; ")}.`);
  }
  return lines.join("\n");
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
 * Opciones del plan de las comidas AÚN pendientes del día (F01 Fase 1, coach
 * F-IA-6): una línea por comida pendiente con sus opciones pautadas (nombre,
 * gramos, kcal, prot). Así el coach sugiere DENTRO de la dieta en vez de inventar
 * comida. Vacío si no queda ninguna comida del plan pendiente. `pending` = claves
 * de comida que aún no tienen entrada registrada (día en curso) o todas (día nuevo).
 */
export function pendingPlanOptions(
  optionsByMeal: Record<string, PlanOptionDTO[]>,
  pending: readonly MealKey[],
): string {
  const lines: string[] = [];
  for (const meal of MEAL_ORDER) {
    if (meal === "extra" || !pending.includes(meal)) continue;
    const opts = optionsByMeal[meal] ?? [];
    if (opts.length === 0) continue;
    lines.push(`${MEAL_LABELS[meal]}: ${planOptionsList(opts)}`);
  }
  return lines.join("\n");
}

/**
 * Contexto del día EN CURSO / TERMINADO para el coach (F-IA-6): comidas con
 * macros por item, totales, peso, sesión (+kcal), fase, agua, hinchazón, notas y
 * métricas del reloj (pasos, activas, basales, HRV, sueño).
 */
export function dayContext(
  view: DayView,
  calendar?: { sessionByWeekday: SessionByWeekday; date: string },
): string {
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

  // Sesión sin registrar: emitir la que toca según el calendario semanal para que
  // el coach no rellene el hueco asumiendo entreno (doc 10 A4 · bug del descanso).
  if (!day?.sessionLabel && calendar) {
    const label =
      calendar.sessionByWeekday[String(isoWeekday(calendar.date))] ?? "Descanso";
    const when = calendar.date === dayKey() ? "hoy toca" : "ese día tocaba";
    lines.push(
      `Sesión: sin registrar (según tu calendario semanal, ${when}: ${label}).`,
    );
  }

  const ctx: string[] = [];
  const weight = day?.weight ?? health?.weight ?? null;
  if (weight != null) ctx.push(`peso ${num(weight, 1)} kg`);
  if (view.session) {
    // Sesión REAL del plan de entreno (doc 10 B3): nombre + tipo + gasto estimado.
    const s = view.session;
    const tipo = TRAINING_TIPO_LABELS[s.tipo];
    ctx.push(
      day?.sessionKcal != null
        ? `sesión ${s.nombre} · ${tipo} (~${day.sessionKcal} kcal, contexto ±25%)`
        : `sesión ${s.nombre} · ${tipo}`,
    );
  } else if (day?.sessionLabel) {
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
