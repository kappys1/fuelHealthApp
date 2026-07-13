import { and, asc, eq } from "drizzle-orm";
import type { BloatKey, MealKey, PhaseKey } from "@/lib/macros";
import { dayKey } from "@/lib/dates";
import { db, schema } from "@/server/db";
import type { TemplateItem } from "@/server/db/schema";
import { getVersionForDate } from "./plan";

type SourceEnum = (typeof schema.mealSourceEnum.enumValues)[number];
type GrpEnum = (typeof schema.grpEnum.enumValues)[number];

// ── days ──
export async function ensureDay(date: string): Promise<void> {
  await db
    .insert(schema.days)
    .values({ date })
    .onConflictDoNothing({ target: schema.days.date });
}

export interface DayPatch {
  weight?: number | null;
  waterL?: number | null;
  bodyFatPct?: number | null;
  sessionLabel?: string | null;
  sessionKcal?: number | null;
  /** FK a la sesión real del plan de entreno (doc 10 B3); null = genérica/manual. */
  sessionRef?: number | null;
  phase?: PhaseKey | null;
  bloat?: BloatKey | null;
  notes?: string | null;
}

export async function upsertDayFields(date: string, patch: DayPatch): Promise<void> {
  await db
    .insert(schema.days)
    .values({ date, ...patch })
    .onConflictDoUpdate({ target: schema.days.date, set: patch });
}

// ── meal_entries ──
export interface NewEntry {
  meal: MealKey;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  source: string;
  photoUrl?: string | null;
}

export async function addEntries(date: string, entries: NewEntry[]) {
  if (entries.length === 0) return [];
  await ensureDay(date);
  return db
    .insert(schema.mealEntries)
    .values(
      entries.map((e) => ({
        date,
        meal: e.meal,
        name: e.name,
        kcal: e.kcal,
        prot: e.prot,
        carb: e.carb,
        fat: e.fat,
        source: e.source as SourceEnum,
        photoUrl: e.photoUrl ?? null,
      })),
    )
    .returning();
}

export interface EntryPatch {
  meal?: MealKey;
  name?: string;
  kcal?: number;
  prot?: number;
  carb?: number;
  fat?: number;
}

export async function updateEntry(id: number, patch: EntryPatch) {
  const [row] = await db
    .update(schema.mealEntries)
    .set(patch)
    .where(eq(schema.mealEntries.id, id))
    .returning();
  return row ?? null;
}

export async function deleteEntry(id: number) {
  const [row] = await db
    .delete(schema.mealEntries)
    .where(eq(schema.mealEntries.id, id))
    .returning();
  return row ?? null;
}

/** Copiar ayer (F2.5): duplica las entradas del día anterior en `date`. */
export async function copyEntriesFrom(fromDate: string, toDate: string) {
  const src = await db
    .select()
    .from(schema.mealEntries)
    .where(eq(schema.mealEntries.date, fromDate));
  if (src.length === 0) return [];
  return addEntries(
    toDate,
    src.map((e) => ({
      meal: e.meal as MealKey,
      name: e.name,
      kcal: e.kcal,
      prot: e.prot,
      carb: e.carb,
      fat: e.fat,
      source: e.source,
      photoUrl: null, // no re-vinculamos la foto al copiar
    })),
  );
}

// ── favorites (toggle por meal+name, F2.4) ──
export interface FavInput {
  meal: MealKey;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export async function toggleFavorite(
  fav: FavInput,
): Promise<{ favorited: boolean }> {
  const existing = await db
    .select({ id: schema.favorites.id })
    .from(schema.favorites)
    .where(
      and(eq(schema.favorites.meal, fav.meal), eq(schema.favorites.name, fav.name)),
    );
  if (existing[0]) {
    await db.delete(schema.favorites).where(eq(schema.favorites.id, existing[0].id));
    return { favorited: false };
  }
  await db.insert(schema.favorites).values(fav);
  return { favorited: true };
}

export async function deleteFavorite(id: number) {
  await db.delete(schema.favorites).where(eq(schema.favorites.id, id));
}

// ── plan: opciones (in-place en la versión vigente) y targets (nueva versión) ──
export interface OptionInput {
  meal: MealKey;
  grp: string;
  name: string;
  baseG: number | null;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export async function addPlanOption(date: string, opt: OptionInput) {
  const version = await getVersionForDate(date);
  if (!version) throw new Error("No hay versión de dieta vigente.");
  const existing = await db
    .select({ sort: schema.planOptions.sort })
    .from(schema.planOptions)
    .where(eq(schema.planOptions.dietVersionId, version.id))
    .orderBy(asc(schema.planOptions.sort));
  const nextSort = existing.length;
  const [row] = await db
    .insert(schema.planOptions)
    .values({
      dietVersionId: version.id,
      meal: opt.meal,
      grp: opt.grp as GrpEnum,
      name: opt.name,
      baseG: opt.baseG,
      kcal: opt.kcal,
      prot: opt.prot,
      carb: opt.carb,
      fat: opt.fat,
      sort: nextSort,
    })
    .returning();
  return row;
}

export async function updatePlanOption(id: number, patch: Partial<OptionInput>) {
  const [row] = await db
    .update(schema.planOptions)
    .set(patch as Record<string, unknown>)
    .where(eq(schema.planOptions.id, id))
    .returning();
  return row ?? null;
}

export async function deletePlanOption(id: number) {
  await db.delete(schema.planOptions).where(eq(schema.planOptions.id, id));
}

export interface TargetsInput {
  kcal: number;
  prot: number;
  carb: number | null;
  fat: number | null;
}

/**
 * Cambio de objetivos (F1.5): crea una NUEVA versión de dieta con effective_from
 * = hoy, copiando las opciones de la versión vigente. Los días pasados siguen
 * evaluándose contra su versión de entonces.
 */
export async function createVersionWithTargets(t: TargetsInput) {
  const today = dayKey();
  const current = await getVersionForDate(today);

  const [version] = await db
    .insert(schema.dietVersions)
    .values({
      effectiveFrom: today,
      kcalTarget: t.kcal,
      protTarget: t.prot,
      carbTarget: t.carb,
      fatTarget: t.fat,
      note: "user",
    })
    .returning();
  if (!version) throw new Error("No se pudo crear la versión de dieta.");

  if (current) {
    const opts = await db
      .select()
      .from(schema.planOptions)
      .where(eq(schema.planOptions.dietVersionId, current.id))
      .orderBy(asc(schema.planOptions.sort));
    if (opts.length > 0) {
      await db.insert(schema.planOptions).values(
        opts.map((o) => ({
          dietVersionId: version.id,
          meal: o.meal,
          grp: o.grp,
          name: o.name,
          baseG: o.baseG,
          kcal: o.kcal,
          prot: o.prot,
          carb: o.carb,
          fat: o.fat,
          sort: o.sort,
        })),
      );
    }
  }
  return version;
}

/**
 * Crea una versión de dieta COMPLETA desde una importación (F-IA-9): inserta la
 * versión + todas sus opciones. Distinta de createVersionWithTargets (que copia
 * las opciones vigentes); aquí las opciones vienen de la pauta importada. Nada se
 * persiste hasta que el usuario confirma la vista previa.
 */
export interface ImportedVersion {
  effectiveFrom: string;
  kcal: number;
  prot: number;
  carb: number | null;
  fat: number | null;
  options: OptionInput[];
}

export async function createDietVersionFull(v: ImportedVersion) {
  const [version] = await db
    .insert(schema.dietVersions)
    .values({
      effectiveFrom: v.effectiveFrom,
      kcalTarget: v.kcal,
      protTarget: v.prot,
      carbTarget: v.carb,
      fatTarget: v.fat,
      note: "imported:photo",
    })
    .returning();
  if (!version) throw new Error("No se pudo crear la versión de dieta.");

  if (v.options.length > 0) {
    await db.insert(schema.planOptions).values(
      v.options.map((o, i) => ({
        dietVersionId: version.id,
        meal: o.meal,
        grp: o.grp as GrpEnum,
        name: o.name,
        baseG: o.baseG,
        kcal: o.kcal,
        prot: o.prot,
        carb: o.carb,
        fat: o.fat,
        sort: i,
      })),
    );
  }
  return version;
}

// ── templates (F2.6) ──
export async function saveTemplateFromDate(name: string, date: string) {
  const entries = await db
    .select()
    .from(schema.mealEntries)
    .where(eq(schema.mealEntries.date, date))
    .orderBy(asc(schema.mealEntries.createdAt));
  const items: TemplateItem[] = entries.map((e) => ({
    meal: e.meal,
    name: e.name,
    kcal: e.kcal,
    prot: e.prot,
    carb: e.carb,
    fat: e.fat,
  }));
  const [row] = await db
    .insert(schema.dayTemplates)
    .values({ name, items })
    .onConflictDoUpdate({ target: schema.dayTemplates.name, set: { items } })
    .returning();
  return row;
}

export async function applyTemplate(id: number, date: string) {
  const [tpl] = await db
    .select()
    .from(schema.dayTemplates)
    .where(eq(schema.dayTemplates.id, id));
  if (!tpl) return [];
  return addEntries(
    date,
    tpl.items.map((it) => ({
      meal: it.meal as MealKey,
      name: it.name,
      kcal: it.kcal,
      prot: it.prot,
      carb: it.carb,
      fat: it.fat,
      source: "plantilla",
    })),
  );
}

export async function deleteTemplate(id: number) {
  await db.delete(schema.dayTemplates).where(eq(schema.dayTemplates.id, id));
}

// ── med_measurements (F5.1) — CRUD; entrada retroactiva (fecha libre) ──
export interface MedInput {
  date: string;
  fatKg: number | null;
  muscleKg: number | null;
  weightKg: number | null;
}

export async function addMed(m: MedInput) {
  const [row] = await db.insert(schema.medMeasurements).values(m).returning();
  return row;
}

export async function updateMed(id: number, patch: Partial<MedInput>) {
  const [row] = await db
    .update(schema.medMeasurements)
    .set(patch)
    .where(eq(schema.medMeasurements.id, id))
    .returning();
  return row ?? null;
}

export async function deleteMed(id: number) {
  await db.delete(schema.medMeasurements).where(eq(schema.medMeasurements.id, id));
}
