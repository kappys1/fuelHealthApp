import { isoWeekday } from "@/lib/dates";

export const TRAINING_SLOTS = ["mañana", "tarde", "descanso"] as const;
export type TrainingSlot = (typeof TRAINING_SLOTS)[number];
export type SessionFranja = Exclude<TrainingSlot, "descanso">;
export type TrainingByWeekday = Record<string, TrainingSlot>;

export const DEFAULT_TRAINING_BY_WEEKDAY: TrainingByWeekday = {
  "1": "tarde",
  "2": "tarde",
  "3": "tarde",
  "4": "tarde",
  "5": "tarde",
  "6": "tarde",
  "7": "descanso",
};

export type TrainingSlotResolution =
  | { value: SessionFranja; origin: "sesion" | "patron" }
  | { value: "descanso"; origin: "patron" }
  | { value: "sin_dato"; origin: "sin_dato" };

/**
 * Fuente única de franja. `hasSession` incluye tanto la sesión canónica como un
 * `days.sessionLabel` manual distinto de Descanso.
 */
export function resolveTrainingSlot(args: {
  date: string;
  hasSession: boolean;
  sessionFranja: SessionFranja | null;
  trainingByWeekday: TrainingByWeekday;
}): TrainingSlotResolution {
  if (args.hasSession && args.sessionFranja) {
    return { value: args.sessionFranja, origin: "sesion" };
  }

  const pattern =
    args.trainingByWeekday[String(isoWeekday(args.date))] ??
    DEFAULT_TRAINING_BY_WEEKDAY[String(isoWeekday(args.date))]!;

  if (!args.hasSession) return { value: pattern, origin: "patron" };
  if (pattern === "descanso") return { value: "sin_dato", origin: "sin_dato" };
  return { value: pattern, origin: "patron" };
}
