import { isoWeekday } from "@/lib/dates";
import type { SessionByWeekday } from "@/lib/macros";
import type { DerivedTargets } from "@/server/analytics/planDerived";
import {
  type DayView,
  getDayView,
  getStreak,
  latestWeightOnOrBefore,
} from "./day";
import {
  type FavoriteDTO,
  getSessionByWeekday,
  listFavorites,
  listTemplates,
  recentDistinctEntries,
  type RecentDTO,
  type TemplateDTO,
} from "./lookups";
import {
  type EffectiveTargets,
  getPlanContext,
  type PlanOptionDTO,
} from "./plan";

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
  favorites: FavoriteDTO[];
  recents: RecentDTO[];
  templates: TemplateDTO[];
  streak: number;
  sessionByWeekday: SessionByWeekday;
  /** Sesión sugerida para esta fecha por el mapeo día-semana (09 §5). */
  defaultSession: string;
  /** Último peso conocido (para precargar el check-in matinal, 09 §5). */
  lastWeight: number | null;
}

export async function getTodayPayload(date: string): Promise<TodayPayload> {
  const [view, plan, favorites, recents, templates, streak, sessionByWeekday, lastWeight] =
    await Promise.all([
      getDayView(date),
      getPlanContext(date),
      listFavorites(),
      recentDistinctEntries(50),
      listTemplates(),
      getStreak(),
      getSessionByWeekday(),
      latestWeightOnOrBefore(date),
    ]);

  const wd = String(isoWeekday(date));
  const defaultSession = sessionByWeekday[wd] ?? "Descanso";

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
    favorites,
    recents,
    templates,
    streak,
    sessionByWeekday,
    defaultSession,
    lastWeight,
  };
}
