import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { isoWeekday, shiftDayKey } from "@/lib/dates";
import { PHASE_NEXT, type PhaseKey, type SessionByWeekday } from "@/lib/macros";
import {
  type BaselineStat,
  healthBaseline,
} from "@/server/analytics/healthBaseline";
import type { DerivedTargets } from "@/server/analytics/planDerived";
import {
  type DayView,
  getDayView,
  getStreak,
  healthBaselineSeries,
  latestWeightOnOrBefore,
  phaseOnDate,
} from "./day";
import {
  getCoachCacheEntry,
  getSessionByWeekday,
  listProducts,
  listTemplates,
  type ProductDTO,
  recentDistinctEntries,
  type RecentDTO,
  type TemplateDTO,
} from "./lookups";
import {
  type EffectiveTargets,
  getPlanContext,
  type PlanOptionDTO,
} from "./plan";
import { getTrainingPlanContext, type TrainingSessionDTO } from "./training";

/**
 * Payload agregado de la pantalla Hoy: lo que el RSC pasa como initialData y lo
 * que GET /api/day devuelve al refetch. Una sola fuente de verdad.
 */
export interface TodayPayload {
  date: string;
  view: DayView;
  targets: EffectiveTargets;
  derived: DerivedTargets;
  optionsByMeal: Record<string, PlanOptionDTO[]>;
  products: ProductDTO[];
  recents: RecentDTO[];
  templates: TemplateDTO[];
  streak: number;
  sessionByWeekday: SessionByWeekday;
  /** Sesiones reales del plan de entreno que cubre esta fecha (doc 10 B3); [] si no hay. */
  trainingSessions: TrainingSessionDTO[];
  /** Sesión sugerida para esta fecha por el mapeo día-semana (09 §5). */
  defaultSession: string;
  /** Último peso conocido (para precargar el check-in matinal, 09 §5). */
  lastWeight: number | null;
  /**
   * Fase sugerida para hoy si ayer fue especial y hoy aún no tiene fase (09 §5:
   * Carga→Competición→Recuperación→Normal). `null` si no hay sugerencia.
   */
  suggestedPhase: PhaseKey | null;
  /** Baseline personal (Restyle v2 · F1): KPIs del reloj con media 30 d + delta. */
  baseline: BaselineStat[];
  /**
   * Coach on-demand cacheado (modo «hoy») para esta fecha (Restyle v2 · F1, #71).
   * `null` si no se ha analizado el día → la tarjeta muestra «Analizar mi día».
   * `ago` = «hace X» calculado en SERVIDOR (regla de pureza, DECISIONS #112).
   */
  coach: { text: string; ts: number; ago: string } | null;
}

export async function getTodayPayload(date: string): Promise<TodayPayload> {
  const [
    view,
    plan,
    products,
    recents,
    templates,
    streak,
    sessionByWeekday,
    lastWeight,
    prevPhase,
    trainingPlan,
    baselineSeries,
    coachEntry,
  ] = await Promise.all([
    getDayView(date),
    getPlanContext(date),
    listProducts(),
    recentDistinctEntries(50),
    listTemplates(),
    getStreak(),
    getSessionByWeekday(),
    latestWeightOnOrBefore(date),
    phaseOnDate(shiftDayKey(date, -1)),
    getTrainingPlanContext(date),
    healthBaselineSeries(date),
    getCoachCacheEntry(date, "hoy"),
  ]);

  const wd = String(isoWeekday(date));
  const defaultSession = sessionByWeekday[wd] ?? "Descanso";
  const trainingSessions = trainingPlan?.sessions ?? [];

  // Sugerir la siguiente fase solo si hoy aún no la tiene y ayer fue especial
  // (todas las PhaseKey son especiales; Normal se guarda como null).
  const suggestedPhase =
    view.day?.phase == null && prevPhase != null ? PHASE_NEXT[prevPhase] : null;

  const baseline = healthBaseline(baselineSeries, date);
  const coach = coachEntry
    ? {
        text: coachEntry.text,
        ts: coachEntry.ts,
        ago: formatDistanceToNow(new Date(coachEntry.ts), {
          addSuffix: true,
          locale: es,
        }),
      }
    : null;

  return {
    date,
    view,
    targets: plan?.targets ?? {
      kcal: 1800,
      prot: 110,
      carb: 0,
      fat: 0,
      carbDerived: true,
      fatDerived: true,
    },
    derived: plan?.derived ?? { kcal: 0, prot: 0, carb: 0, fat: 0, kmin: 0, kmax: 0 },
    optionsByMeal: plan?.optionsByMeal ?? {},
    products,
    recents,
    templates,
    streak,
    sessionByWeekday,
    trainingSessions,
    defaultSession,
    lastWeight,
    suggestedPhase,
    baseline,
    coach,
  };
}
