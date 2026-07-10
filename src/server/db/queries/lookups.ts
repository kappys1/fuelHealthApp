import { desc, eq } from "drizzle-orm";
import type { MealKey, SessionByWeekday } from "@/lib/macros";
import { DEFAULT_SESSION_BY_WEEKDAY } from "@/lib/macros";
import { db, schema } from "@/server/db";
import type { TemplateItem } from "@/server/db/schema";

export interface FavoriteDTO {
  id: number;
  meal: MealKey;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export interface RecentDTO {
  meal: MealKey;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export interface TemplateDTO {
  id: number;
  name: string;
  items: TemplateItem[];
}

export async function listFavorites(): Promise<FavoriteDTO[]> {
  return (await db
    .select()
    .from(schema.favorites)
    .orderBy(desc(schema.favorites.id))) as FavoriteDTO[];
}

/**
 * Últimas N entradas DISTINTAS por (meal, name) — corpus de la búsqueda universal
 * (09 §4 / 07 §3). Se queda con la aparición más reciente de cada nombre.
 */
export async function recentDistinctEntries(limit = 50): Promise<RecentDTO[]> {
  const rows = await db
    .select({
      meal: schema.mealEntries.meal,
      name: schema.mealEntries.name,
      kcal: schema.mealEntries.kcal,
      prot: schema.mealEntries.prot,
      carb: schema.mealEntries.carb,
      fat: schema.mealEntries.fat,
      createdAt: schema.mealEntries.createdAt,
    })
    .from(schema.mealEntries)
    .orderBy(desc(schema.mealEntries.createdAt), desc(schema.mealEntries.id))
    .limit(500);

  const seen = new Set<string>();
  const out: RecentDTO[] = [];
  for (const r of rows) {
    const key = `${r.meal}::${r.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      meal: r.meal as MealKey,
      name: r.name,
      kcal: r.kcal,
      prot: r.prot,
      carb: r.carb,
      fat: r.fat,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function listTemplates(): Promise<TemplateDTO[]> {
  return (await db
    .select()
    .from(schema.dayTemplates)
    .orderBy(desc(schema.dayTemplates.id))) as TemplateDTO[];
}

// ── settings (key/value jsonb) ──
export async function getSetting<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key));
  return (row?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export const SESSION_MAP_KEY = "sessionByWeekday";

export async function getSessionByWeekday(): Promise<SessionByWeekday> {
  const stored = await getSetting<SessionByWeekday>(SESSION_MAP_KEY);
  return { ...DEFAULT_SESSION_BY_WEEKDAY, ...(stored ?? {}) };
}
