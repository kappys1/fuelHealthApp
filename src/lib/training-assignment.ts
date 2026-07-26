import { isoWeekday } from "@/lib/dates";
import type {
  SessionFranja,
  TrainingByWeekday,
} from "@/lib/training-slot";

export interface TrainingAssignmentState {
  date: string;
  franja: SessionFranja | null;
  source: "auto" | "manual";
}

function patternFranja(
  date: string,
  pattern: TrainingByWeekday,
): SessionFranja | null {
  if (!date) return null;
  const slot = pattern[String(isoWeekday(date))] ?? "descanso";
  return slot === "descanso" ? null : slot;
}

export function createTrainingAssignment(
  date: string,
  pattern: TrainingByWeekday,
): TrainingAssignmentState {
  return {
    date,
    franja: patternFranja(date, pattern),
    source: "auto",
  };
}

export function changeAssignmentDate(
  current: TrainingAssignmentState,
  date: string,
  pattern: TrainingByWeekday,
): TrainingAssignmentState {
  if (!date) return createTrainingAssignment("", pattern);
  if (current.source === "manual") return { ...current, date };
  return createTrainingAssignment(date, pattern);
}

export function overrideAssignmentFranja(
  current: TrainingAssignmentState,
  franja: SessionFranja,
): TrainingAssignmentState {
  return { ...current, franja, source: "manual" };
}
