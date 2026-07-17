import { z } from "zod";
import { db, schema } from "@/server/db";
import { productImportRow } from "../products-map";
import { mealEntryImportRow, planOptionImportRow } from "./backup-map";

/*
  Export/restore JSON completo (F4.5 / principio 7: los datos son sagrados).

  El export vuelca todas las tablas con sus ids. El restore REEMPLAZA el contenido
  reconstruyendo la integridad referencial: las tablas con id de identidad se
  reinsertan SIN id (Postgres asigna nuevos) y las FKs se remapean por el id
  antiguo del archivo (diet_version → plan_options, chat_thread → chat_message).

  Limitación consciente: el driver neon-http no soporta transacciones interactivas,
  así que el restore es secuencial (delete-all + insert). Es una operación manual y
  confirmada sobre un backup propio (usuario único) — mismo patrón que migrate:poc.
*/

export const EXPORT_APP = "fuelboard";
export const EXPORT_VERSION = 1 as const;

export interface FullExport {
  app: typeof EXPORT_APP;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function exportAll(): Promise<FullExport> {
  const [
    dietVersions,
    planOptions,
    days,
    mealEntries,
    healthMetrics,
    workouts,
    medMeasurements,
    favorites,
    products,
    dayTemplates,
    settings,
    chatThreads,
    chatMessages,
    trainingPlans,
    trainingSessions,
    performanceMarks,
    markEntries,
  ] = await Promise.all([
    db.select().from(schema.dietVersions),
    db.select().from(schema.planOptions),
    db.select().from(schema.days),
    db.select().from(schema.mealEntries),
    db.select().from(schema.healthMetrics),
    db.select().from(schema.workouts),
    db.select().from(schema.medMeasurements),
    db.select().from(schema.favorites),
    db.select().from(schema.products),
    db.select().from(schema.dayTemplates),
    db.select().from(schema.settings),
    db.select().from(schema.chatThreads),
    db.select().from(schema.chatMessages),
    db.select().from(schema.trainingPlans),
    db.select().from(schema.trainingSessions),
    db.select().from(schema.performanceMarks),
    db.select().from(schema.markEntries),
  ]);

  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      dietVersions,
      planOptions,
      days,
      mealEntries,
      healthMetrics,
      workouts,
      medMeasurements,
      favorites,
      products,
      dayTemplates,
      settings,
      chatThreads,
      chatMessages,
      trainingPlans,
      trainingSessions,
      performanceMarks,
      markEntries,
    },
  };
}

// ── Validación tolerante del archivo de restore ──
const anyRow = z.record(z.string(), z.unknown());
const importSchema = z.object({
  app: z.string().optional(),
  version: z.number().optional(),
  data: z.object({
    dietVersions: z.array(anyRow).default([]),
    planOptions: z.array(anyRow).default([]),
    days: z.array(anyRow).default([]),
    mealEntries: z.array(anyRow).default([]),
    healthMetrics: z.array(anyRow).default([]),
    workouts: z.array(anyRow).default([]),
    medMeasurements: z.array(anyRow).default([]),
    favorites: z.array(anyRow).default([]),
    products: z.array(anyRow).default([]),
    dayTemplates: z.array(anyRow).default([]),
    settings: z.array(anyRow).default([]),
    chatThreads: z.array(anyRow).default([]),
    chatMessages: z.array(anyRow).default([]),
    trainingPlans: z.array(anyRow).default([]),
    trainingSessions: z.array(anyRow).default([]),
    performanceMarks: z.array(anyRow).default([]),
    markEntries: z.array(anyRow).default([]),
  }),
});

export type ImportData = z.infer<typeof importSchema>["data"];
export type TableCounts = Record<keyof ImportData, number>;

export interface ImportPreview {
  incoming: TableCounts;
  current: TableCounts;
}

function countRows(data: ImportData): TableCounts {
  const out = {} as TableCounts;
  for (const k of Object.keys(data) as (keyof ImportData)[]) out[k] = data[k].length;
  return out;
}

/** Valida el archivo y devuelve los datos + el conteo (para la vista previa). */
export function parseImport(raw: unknown): ImportData {
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("El archivo no es un export de Fuelboard válido.");
  }
  return parsed.data.data;
}

export async function previewImport(data: ImportData): Promise<ImportPreview> {
  const current = await exportAll().then((e) => countRows(e.data as ImportData));
  return { incoming: countRows(data), current };
}

// ── Helpers de coerción por columna ──
const n = (v: unknown): number | null =>
  v == null || v === "" ? null : Number(v);
const s = (v: unknown): string | null => (v == null ? null : String(v));
const dt = (v: unknown): Date => (v ? new Date(String(v)) : new Date());

export interface ImportResult {
  restored: TableCounts;
}

/** REEMPLAZA todo el contenido con el del archivo (delete-all + insert remapeado). */
export async function applyImport(data: ImportData): Promise<ImportResult> {
  // 1) Borrado hijos → padres (los cascades cubren, pero somos explícitos).
  await db.delete(schema.chatMessages);
  await db.delete(schema.chatThreads);
  await db.delete(schema.mealEntries);
  await db.delete(schema.planOptions);
  await db.delete(schema.days);
  // training_sessions se borra tras days (days.session_ref → training_sessions);
  // luego training_plans (padre).
  await db.delete(schema.trainingSessions);
  await db.delete(schema.trainingPlans);
  // marcas: entradas (hijas) antes que las marcas (padres).
  await db.delete(schema.markEntries);
  await db.delete(schema.performanceMarks);
  await db.delete(schema.healthMetrics);
  await db.delete(schema.workouts);
  await db.delete(schema.medMeasurements);
  await db.delete(schema.favorites);
  await db.delete(schema.products);
  await db.delete(schema.dayTemplates);
  await db.delete(schema.dietVersions);
  await db.delete(schema.settings);

  // 2) diet_versions (remapea id antiguo → nuevo).
  const versionMap = new Map<number, number>();
  for (const r of data.dietVersions) {
    const [row] = await db
      .insert(schema.dietVersions)
      .values({
        effectiveFrom: String(r.effectiveFrom),
        kcalTarget: Number(r.kcalTarget ?? 0),
        protTarget: Number(r.protTarget ?? 0),
        carbTarget: n(r.carbTarget),
        fatTarget: n(r.fatTarget),
        note: s(r.note),
      })
      .returning({ id: schema.dietVersions.id });
    if (row && r.id != null) versionMap.set(Number(r.id), row.id);
  }

  // 2b) training_plans + training_sessions (remapea ids; deben ir ANTES de days,
  // porque days.session_ref → training_sessions).
  const planMap = new Map<number, number>();
  for (const r of data.trainingPlans) {
    const [row] = await db
      .insert(schema.trainingPlans)
      .values({
        importedAt: dt(r.importedAt),
        programa: String(r.programa ?? ""),
        etiqueta: String(r.etiqueta ?? ""),
        validFrom: String(r.validFrom),
        validTo: s(r.validTo),
        source: (r.source ?? "pdf") as typeof schema.trainingSourceEnum.enumValues[number],
      })
      .returning({ id: schema.trainingPlans.id });
    if (row && r.id != null) planMap.set(Number(r.id), row.id);
  }
  const sessionMap = new Map<number, number>();
  for (const r of data.trainingSessions) {
    const [row] = await db
      .insert(schema.trainingSessions)
      .values({
        planId: planMap.get(Number(r.planId)) ?? Number(r.planId),
        key: String(r.key ?? ""),
        nombre: String(r.nombre ?? ""),
        tipo: (r.tipo ?? "otro") as typeof schema.trainingTipoEnum.enumValues[number],
        contenido: String(r.contenido ?? ""),
        kcalMin: n(r.kcalMin),
        kcalMax: n(r.kcalMax),
        duracionMin: n(r.duracionMin),
        sort: Number(r.sort ?? 0),
      })
      .returning({ id: schema.trainingSessions.id });
    if (row && r.id != null) sessionMap.set(Number(r.id), row.id);
  }

  // 3) days (PK = date, sin identidad; session_ref remapeado a la sesión nueva).
  if (data.days.length) {
    await db.insert(schema.days).values(
      data.days.map((r) => ({
        date: String(r.date),
        weight: n(r.weight),
        waterL: n(r.waterL),
        bodyFatPct: n(r.bodyFatPct),
        sessionLabel: s(r.sessionLabel),
        sessionKcal: n(r.sessionKcal),
        sessionRef:
          r.sessionRef == null
            ? null
            : (sessionMap.get(Number(r.sessionRef)) ?? Number(r.sessionRef)),
        phase: (r.phase ?? null) as typeof schema.phaseEnum.enumValues[number] | null,
        bloat: (r.bloat ?? null) as typeof schema.bloatEnum.enumValues[number] | null,
        notes: s(r.notes),
      })),
    );
  }

  // 4) plan_options (FK → diet_versions remapeada; variants F08 vía mapa puro).
  if (data.planOptions.length) {
    await db.insert(schema.planOptions).values(
      data.planOptions.map((r) =>
        planOptionImportRow(
          r,
          versionMap.get(Number(r.dietVersionId)) ?? Number(r.dietVersionId),
        ),
      ),
    );
  }

  // 5) meal_entries (FK → days; conserva createdAt + base inmutable F06).
  if (data.mealEntries.length) {
    await db.insert(schema.mealEntries).values(data.mealEntries.map(mealEntryImportRow));
  }

  // 6) health_metrics.
  if (data.healthMetrics.length) {
    await db.insert(schema.healthMetrics).values(
      data.healthMetrics.map((r) => ({
        date: String(r.date),
        steps: n(r.steps),
        activeKcal: n(r.activeKcal),
        basalKcal: n(r.basalKcal),
        hrvMs: n(r.hrvMs),
        sleepH: n(r.sleepH),
        restingHr: n(r.restingHr),
        vo2max: n(r.vo2max),
        waterL: n(r.waterL),
        weight: n(r.weight),
        bodyFatPct: n(r.bodyFatPct),
        extra: (r.extra ?? null) as Record<string, number> | null,
        source: (r.source ?? "csv") as typeof schema.healthSourceEnum.enumValues[number],
        updatedAt: dt(r.updatedAt),
      })),
    );
  }

  // 7) workouts / med / favorites / templates / settings.
  if (data.workouts.length) {
    await db.insert(schema.workouts).values(
      data.workouts.map((r) => ({
        date: String(r.date),
        type: String(r.type ?? "Entrenamiento"),
        durationMin: n(r.durationMin),
        avgHr: n(r.avgHr),
        activeKcal: n(r.activeKcal),
      })),
    );
  }
  if (data.medMeasurements.length) {
    await db.insert(schema.medMeasurements).values(
      data.medMeasurements.map((r) => ({
        date: String(r.date),
        fatKg: n(r.fatKg),
        muscleKg: n(r.muscleKg),
        weightKg: n(r.weightKg),
      })),
    );
  }
  if (data.favorites.length) {
    await db.insert(schema.favorites).values(
      data.favorites.map((r) => ({
        meal: r.meal as typeof schema.mealEnum.enumValues[number],
        name: String(r.name ?? ""),
        kcal: Number(r.kcal ?? 0),
        prot: Number(r.prot ?? 0),
        carb: Number(r.carb ?? 0),
        fat: Number(r.fat ?? 0),
      })),
    );
  }
  if (data.products.length) {
    await db.insert(schema.products).values(data.products.map(productImportRow));
  }
  if (data.dayTemplates.length) {
    await db.insert(schema.dayTemplates).values(
      data.dayTemplates.map((r) => ({
        name: String(r.name ?? ""),
        items: (Array.isArray(r.items) ? r.items : []) as typeof schema.dayTemplates.$inferInsert.items,
      })),
    );
  }
  if (data.settings.length) {
    await db.insert(schema.settings).values(
      data.settings.map((r) => ({ key: String(r.key), value: r.value ?? {} })),
    );
  }

  // 8) chat (remapea thread id).
  const threadMap = new Map<number, number>();
  for (const r of data.chatThreads) {
    const [row] = await db
      .insert(schema.chatThreads)
      .values({
        title: String(r.title ?? ""),
        createdAt: dt(r.createdAt),
        updatedAt: dt(r.updatedAt),
      })
      .returning({ id: schema.chatThreads.id });
    if (row && r.id != null) threadMap.set(Number(r.id), row.id);
  }
  if (data.chatMessages.length) {
    await db.insert(schema.chatMessages).values(
      data.chatMessages.map((r) => ({
        threadId: threadMap.get(Number(r.threadId)) ?? Number(r.threadId),
        role: r.role as typeof schema.chatRoleEnum.enumValues[number],
        content: String(r.content ?? ""),
        createdAt: dt(r.createdAt),
      })),
    );
  }

  // 9) marcas de rendimiento (remapea id antiguo → nuevo) + sus entradas (FK remapeada).
  const markMap = new Map<number, number>();
  for (const r of data.performanceMarks) {
    const [row] = await db
      .insert(schema.performanceMarks)
      .values({
        name: String(r.name ?? ""),
        measureType: (r.measureType ??
          "weight") as typeof schema.markMeasureEnum.enumValues[number],
        unit: String(r.unit ?? ""),
        family: s(r.family),
        createdAt: dt(r.createdAt),
      })
      .returning({ id: schema.performanceMarks.id });
    if (row && r.id != null) markMap.set(Number(r.id), row.id);
  }
  if (data.markEntries.length) {
    await db.insert(schema.markEntries).values(
      data.markEntries.map((r) => ({
        markId: markMap.get(Number(r.markId)) ?? Number(r.markId),
        value: Number(r.value ?? 0),
        recordedOn: String(r.recordedOn),
        note: s(r.note),
        createdAt: dt(r.createdAt),
      })),
    );
  }

  return { restored: countRows(data) };
}
