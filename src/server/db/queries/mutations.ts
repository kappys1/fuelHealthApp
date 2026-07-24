import { asc, eq } from "drizzle-orm";
import type { BloatKey, MealKey, PhaseKey, PlanVariant } from "@/lib/macros";
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
  // Gramos como dato de primera clase (F06): base inmutable + cantidad. Opcionales
  // (entrada fija = todos null); se persisten al crear desde foto/plan.
  grams?: number | null;
  baseG?: number | null;
  baseKcal?: number | null;
  baseProt?: number | null;
  baseCarb?: number | null;
  baseFat?: number | null;
}

export async function addEntries(
  date: string,
  entries: NewEntry[],
  clientMutationId?: string,
) {
  if (entries.length === 0) return [];
  await ensureDay(date);
  return db
    .insert(schema.mealEntries)
    .values(
      entries.map((e, index) => ({
        date,
        meal: e.meal,
        name: e.name,
        kcal: e.kcal,
        prot: e.prot,
        carb: e.carb,
        fat: e.fat,
        source: e.source as SourceEnum,
        photoUrl: e.photoUrl ?? null,
        grams: e.grams ?? null,
        baseG: e.baseG ?? null,
        baseKcal: e.baseKcal ?? null,
        baseProt: e.baseProt ?? null,
        baseCarb: e.baseCarb ?? null,
        baseFat: e.baseFat ?? null,
        clientMutationId: clientMutationId ?? null,
        clientMutationIndex: clientMutationId ? index : null,
      })),
    )
    .onConflictDoNothing({
      target: [
        schema.mealEntries.clientMutationId,
        schema.mealEntries.clientMutationIndex,
      ],
    })
    .returning();
}

export interface EntryPatch {
  meal?: MealKey;
  name?: string;
  kcal?: number;
  prot?: number;
  carb?: number;
  fat?: number;
  // Cantidad editada en el editor de Hoy (F06): reescala kcal/macros desde la base
  // inmutable. La base (baseG/base*) NO se parchea nunca (es inmutable por diseño).
  grams?: number | null;
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
      // Conserva la base inmutable → las copias siguen siendo escalables (F06).
      grams: e.grams,
      baseG: e.baseG,
      baseKcal: e.baseKcal,
      baseProt: e.baseProt,
      baseCarb: e.baseCarb,
      baseFat: e.baseFat,
    })),
  );
}

// ── products (F07 · CRUD del catálogo) ──
type ProductSourceEnum = (typeof schema.productSourceEnum.enumValues)[number];
type ProductUnitEnum = (typeof schema.productUnitEnum.enumValues)[number];

export interface ProductInput {
  name: string;
  baseG: number | null;
  baseKcal: number;
  baseProt: number;
  baseCarb: number;
  baseFat: number;
  grupo: GrpEnum | null;
  source: ProductSourceEnum;
  unit: ProductUnitEnum;
  pinned: boolean;
}

export async function createProduct(p: ProductInput): Promise<{ id: number }> {
  const [row] = await db
    .insert(schema.products)
    .values(p)
    .returning({ id: schema.products.id });
  if (!row) throw new Error("No se pudo crear el producto.");
  return { id: row.id };
}

/** Edición parcial de un producto. NO toca entradas ya registradas (AC5): sus macros
 *  quedaron horneadas por día; el producto solo alimenta futuros añadidos. */
export async function updateProduct(
  id: number,
  patch: Partial<ProductInput>,
): Promise<void> {
  await db
    .update(schema.products)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.products.id, id));
}

export async function deleteProduct(id: number): Promise<void> {
  await db.delete(schema.products).where(eq(schema.products.id, id));
}

/** Alterna el pin (chip de acceso rápido) devolviendo el nuevo estado. */
export async function toggleProductPin(id: number): Promise<{ pinned: boolean }> {
  const [cur] = await db
    .select({ pinned: schema.products.pinned })
    .from(schema.products)
    .where(eq(schema.products.id, id));
  if (!cur) throw new Error("Producto no encontrado.");
  const pinned = !cur.pinned;
  await db
    .update(schema.products)
    .set({ pinned, updatedAt: new Date() })
    .where(eq(schema.products.id, id));
  return { pinned };
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
  // Variantes intercambiables (F08). Omitido/[] = opción normal. La edición manual
  // del plan no las envía (Fase 2, aplazable); las rellena el importador (F-IA-9).
  variants?: PlanVariant[];
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
      variants: opt.variants ?? [],
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
          // Copiar las variantes: cambiar objetivos NO puede perderlas (principio 7).
          variants: o.variants ?? [],
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

  try {
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
          variants: o.variants ?? [],
          sort: i,
        })),
      );
    }
  } catch (error) {
    await db
      .delete(schema.dietVersions)
      .where(eq(schema.dietVersions.id, version.id));
    throw error;
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
