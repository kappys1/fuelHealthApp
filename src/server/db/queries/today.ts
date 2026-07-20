import { isoWeekday, shiftDayKey } from "@/lib/dates";
import { PHASE_NEXT, type PhaseKey, type SessionByWeekday } from "@/lib/macros";
import type { DerivedTargets } from "@/server/analytics/planDerived";
import {
  coachContextHash,
  coachReadingView,
  type CoachReadingView,
} from "@/server/ai/coach-reading";
import { getCoachReading } from "./coach-reading";
import {
  type DayView,
  getDayView,
  getStreak,
  latestWeightOnOrBefore,
  phaseOnDate,
} from "./day";
import {
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
import {
  getHealthBaseline,
  getHealthSyncView,
  type HealthSyncView,
} from "./health";
import type { HealthBaseline } from "@/server/analytics/healthBaseline";
import { listBloatEvents, type BloatEventDTO } from "./bloat";

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
  /** Métricas crudas del día comparadas con los 30 días naturales anteriores. */
  baseline: HealthBaseline;
  /** Confianza de la última importación de Apple Health. */
  healthSync: HealthSyncView | null;
  /** Lectura persistida; null hasta que el usuario la solicite explícitamente. */
  coachReading: CoachReadingView | null;
  /** Marcadores temporales reales; no incluye el resumen legacy sin hora. */
  bloatEvents: BloatEventDTO[];
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
    baseline,
    healthSync,
    cachedCoachReading,
    bloatEvents,
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
    getHealthBaseline(date),
    getHealthSyncView(),
    getCoachReading(date, "hoy"),
    listBloatEvents(date),
  ]);

  const wd = String(isoWeekday(date));
  const defaultSession = sessionByWeekday[wd] ?? "Descanso";
  const trainingSessions = trainingPlan?.sessions ?? [];
  const targets = plan?.targets ?? {
    kcal: 1800,
    prot: 110,
    carb: 0,
    fat: 0,
    carbDerived: true,
    fatDerived: true,
  };

  // Sugerir la siguiente fase solo si hoy aún no la tiene y ayer fue especial
  // (todas las PhaseKey son especiales; Normal se guarda como null).
  const suggestedPhase =
    view.day?.phase == null && prevPhase != null ? PHASE_NEXT[prevPhase] : null;

  return {
    date,
    view,
    targets,
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
    healthSync,
    coachReading: coachReadingView(
      cachedCoachReading,
      coachContextHash(view, targets),
    ),
    bloatEvents,
  };
}
