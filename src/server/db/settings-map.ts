import {
  DEFAULT_SESSION_BY_WEEKDAY,
  type SessionByWeekday,
} from "@/lib/macros";
import {
  DEFAULT_TRAINING_BY_WEEKDAY,
  TRAINING_SLOTS,
  type TrainingByWeekday,
} from "@/lib/training-slot";

export interface SettingRow {
  [field: string]: unknown;
  key: string;
  value: unknown;
}

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validTrainingPattern(value: unknown): value is TrainingByWeekday {
  return (
    isRecord(value) &&
    WEEKDAYS.every(
      (day) =>
        typeof value[day] === "string" &&
        TRAINING_SLOTS.includes(value[day] as (typeof TRAINING_SLOTS)[number]),
    )
  );
}

function legacyPattern(value: unknown): SessionByWeekday {
  const raw = isRecord(value) ? value : {};
  return Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      typeof raw[day] === "string"
        ? raw[day]
        : DEFAULT_SESSION_BY_WEEKDAY[day]!,
    ]),
  );
}

export function trainingPatternFromLegacy(value: unknown): TrainingByWeekday {
  const legacy = legacyPattern(value);
  return Object.fromEntries(
    WEEKDAYS.map((day) => {
      const label = legacy[day]!.trim().toLowerCase();
      return [day, label === "" || label === "descanso" ? "descanso" : "tarde"];
    }),
  );
}

function legacyFromTrainingPattern(pattern: TrainingByWeekday): SessionByWeekday {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      pattern[day] === "descanso"
        ? "Descanso"
        : DEFAULT_SESSION_BY_WEEKDAY[day]!,
    ]),
  );
}

export function settingsArrayToRecord(
  rows: readonly Record<string, unknown>[],
): Record<string, unknown> {
  return Object.fromEntries(rows.map((row) => [String(row.key), row.value]));
}

/**
 * Compatibilidad de transición de F20. Durante Fase 0 conserva/sintetiza la
 * clave legacy porque sigue siendo la fuente activa, y añade la canónica para
 * que el cutover posterior no pierda días.
 */
export function normalizeTrainingSettings(
  rows: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  const settings = new Map(
    rows.map((row) => [String(row.key), row.value] as const),
  );
  const canonicalRaw = settings.get("trainingByWeekday");
  const canonical = validTrainingPattern(canonicalRaw)
    ? canonicalRaw
    : trainingPatternFromLegacy(settings.get("sessionByWeekday"));

  settings.set("trainingByWeekday", canonical);
  if (typeof settings.get("trainingByWeekdayReviewed") !== "boolean") {
    settings.set("trainingByWeekdayReviewed", false);
  }
  if (!settings.has("sessionByWeekday")) {
    settings.set("sessionByWeekday", legacyFromTrainingPattern(canonical));
  }

  return [...settings].map(([key, value]) => ({ key, value }));
}
