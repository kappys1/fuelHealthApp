import { z } from "zod";
import {
  COACH_MODES,
  coachReadingKey,
  type CoachMode,
  type CoachReading,
} from "@/server/ai/coach-reading";
import { getSetting, setSetting } from "./lookups";

const coachReadingZ = z.object({
  baseDate: z.string(),
  targetDate: z.string(),
  mode: z.enum(COACH_MODES),
  text: z.string().min(1),
  generatedAt: z.string(),
  contextHash: z.string().min(1),
});

export async function getCoachReading(
  baseDate: string,
  mode: CoachMode,
): Promise<CoachReading | null> {
  const raw = await getSetting<unknown>(coachReadingKey(baseDate, mode));
  const parsed = coachReadingZ.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function saveCoachReading(reading: CoachReading): Promise<void> {
  await setSetting(coachReadingKey(reading.baseDate, reading.mode), reading);
}
