import { asc, desc, eq } from "drizzle-orm";
import { dayKey } from "@/lib/dates";
import type { GrpKey, MealKey } from "@/lib/macros";
import {
  DEFAULT_TRAINING_BY_WEEKDAY,
  type TrainingByWeekday,
} from "@/lib/training-slot";
import {
  type AthleteProfile,
  DEFAULT_ATHLETE_PROFILE,
  normalizeLesiones,
} from "@/lib/profile";
import { db, schema } from "@/server/db";
import type { TemplateItem } from "@/server/db/schema";

// Producto (F07): agnóstico de comida, macros por base de gramos (baseG null =
// fijo). `pinned` = sale como chip de acceso rápido en el sheet.
export interface ProductDTO {
  id: number;
  name: string;
  baseG: number | null;
  baseKcal: number;
  baseProt: number;
  baseCarb: number;
  baseFat: number;
  grupo: GrpKey | null;
  source: "etiqueta" | "manual" | "estimado" | "legacy";
  // Unidad de visualización (F10): rótulo del baseG/stepper; no afecta al escalado.
  unit: "g" | "ml" | "ud";
  pinned: boolean;
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

/**
 * Todos los productos (F07). Orden: fijados primero (chips de acceso rápido), luego
 * por nombre. El sheet filtra `pinned` para los chips; el catálogo los muestra todos.
 */
export async function listProducts(): Promise<ProductDTO[]> {
  return (await db
    .select()
    .from(schema.products)
    .orderBy(desc(schema.products.pinned), asc(schema.products.name))) as ProductDTO[];
}

/**
 * Producto por nombre EXACTO (F12): destino de la escritura confirmada del chat.
 * `name` es unique en el schema → 0 o 1 fila. Si existe, la escritura actualiza; si
 * no, crea. Devuelve solo el id (basta para updateProduct). null si no existe.
 */
export async function getProductByName(
  name: string,
): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.name, name));
  return row ?? null;
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

export const TRAINING_MAP_KEY = "trainingByWeekday";
export const TRAINING_MAP_REVIEWED_KEY = "trainingByWeekdayReviewed";

export async function getTrainingByWeekday(): Promise<TrainingByWeekday> {
  const stored = await getSetting<TrainingByWeekday>(TRAINING_MAP_KEY);
  return { ...DEFAULT_TRAINING_BY_WEEKDAY, ...(stored ?? {}) };
}

export async function getTrainingByWeekdayReviewed(): Promise<boolean> {
  return (await getSetting<boolean>(TRAINING_MAP_REVIEWED_KEY)) ?? false;
}

export async function setTrainingByWeekday(
  value: TrainingByWeekday,
): Promise<void> {
  await db.batch([
    db
      .insert(schema.settings)
      .values({ key: TRAINING_MAP_KEY, value })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value },
      }),
    db
      .insert(schema.settings)
      .values({ key: TRAINING_MAP_REVIEWED_KEY, value: true })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: true },
      }),
  ]);
}

export const CHAT_WEB_SEARCH_KEY = "chatWebSearch";

/**
 * Interruptor global de búsqueda web del chat (F05 Fase 1, default ON). Freno de
 * COSTE, no toggle por mensaje (P3: la fricción mata el sistema): mientras está
 * ON el disparo de `googleSearch` es automático; OFF apaga la web por completo
 * (vuelta a Fase 0 — sin tool y sin párrafo web, ambos atados a este flag). Vive
 * en la tabla `settings` (sin migración; export/restore ya la vuelca).
 */
export async function getChatWebSearch(): Promise<boolean> {
  const stored = await getSetting<boolean>(CHAT_WEB_SEARCH_KEY);
  return stored ?? true;
}

export const ATHLETE_PROFILE_KEY = "athleteProfile";

/** Perfil de atleta (doc 10 A1). Merge superficial sobre defaults: campos nuevos
 *  añadidos en el futuro caen al default sin migración.
 *  F26: `lesiones` se normaliza EN LA LECTURA — la fila que hay en la BD hoy
 *  guarda chips (`string[]`) y nadie la ha reescrito todavía. */
export async function getAthleteProfile(): Promise<AthleteProfile> {
  const stored = await getSetting<Partial<AthleteProfile>>(ATHLETE_PROFILE_KEY);
  const { franjaEntreno: _legacyFranja, ...current } = (stored ?? {}) as
    Partial<AthleteProfile> & { franjaEntreno?: unknown };
  void _legacyFranja;
  const profile = { ...DEFAULT_ATHLETE_PROFILE, ...current };
  return { ...profile, lesiones: normalizeLesiones(profile.lesiones, dayKey()) };
}
