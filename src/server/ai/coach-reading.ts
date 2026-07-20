import { createHash } from "node:crypto";
import type { DayView } from "@/server/db/queries/day";

export const COACH_MODES = ["hoy", "ayer"] as const;
export type CoachMode = (typeof COACH_MODES)[number];

export interface CoachReading {
  baseDate: string;
  targetDate: string;
  mode: CoachMode;
  text: string;
  generatedAt: string;
  contextHash: string;
}

export interface CoachReadingView extends CoachReading {
  stale: boolean;
}

export function coachReadingKey(baseDate: string, mode: CoachMode): string {
  return `coachReading:${baseDate}:${mode}`;
}

/**
 * Huella determinista de los datos que cambian la lectura diaria. Se limita al
 * contexto del día y objetivos: la IA no se invoca aquí y el hash no sale al UI.
 */
export function coachContextHash(
  view: DayView,
  targets: { kcal: number; prot: number; carb: number; fat: number },
): string {
  const payload = {
    date: view.date,
    day: view.day,
    health: view.health,
    session: view.session,
    entries: [...view.entries]
      .sort((a, b) => a.id - b.id)
      .map(({ createdAt, ...entry }) => {
        void createdAt;
        return entry;
      }),
    targets: {
      kcal: targets.kcal,
      prot: targets.prot,
      carb: targets.carb,
      fat: targets.fat,
    },
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function coachReadingView(
  reading: CoachReading | null,
  contextHash: string,
): CoachReadingView | null {
  return reading ? { ...reading, stale: reading.contextHash !== contextHash } : null;
}
