import { sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { dateZ } from "@/lib/schemas";
import { db, schema } from "@/server/db";
import { productImportRow } from "../products-map";
import {
  bloatEventImportRow,
  mealEntryImportRow,
  planOptionImportRow,
} from "./backup-map";

/*
  Export/restore JSON completo (F4.5 / principio 7: los datos son sagrados).

  El export vuelca todas las tablas con sus ids. El restore REEMPLAZA el contenido
  reconstruyendo la integridad referencial: las tablas con id de identidad se
  reinsertan SIN id (Postgres asigna nuevos) y las FKs se remapean por el id
  antiguo del archivo (diet_version → plan_options, chat_thread → chat_message).

  El restore conserva los ids del export y usa `db.batch`: neon-http envía todas
  las sentencias como una única transacción no interactiva. Un fallo revierte el
  borrado y todas las inserciones.
*/

export const EXPORT_APP = "fuelboard";
export const EXPORT_VERSION = 2 as const;

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
    bloatEvents,
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
    db.select().from(schema.bloatEvents),
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
      bloatEvents,
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
const v1DataShape = {
  dietVersions: z.array(anyRow),
  planOptions: z.array(anyRow),
  days: z.array(anyRow),
  mealEntries: z.array(anyRow),
  healthMetrics: z.array(anyRow),
  workouts: z.array(anyRow),
  medMeasurements: z.array(anyRow),
  favorites: z.array(anyRow),
  products: z.array(anyRow),
  dayTemplates: z.array(anyRow),
  settings: z.array(anyRow),
  chatThreads: z.array(anyRow),
  chatMessages: z.array(anyRow),
  trainingPlans: z.array(anyRow),
  trainingSessions: z.array(anyRow),
  performanceMarks: z.array(anyRow),
  markEntries: z.array(anyRow),
};
const v2DataShape = {
  ...v1DataShape,
  bloatEvents: z.array(anyRow),
};
const importSchema = z.discriminatedUnion("version", [
  z.object({
    app: z.literal(EXPORT_APP),
    version: z.literal(1),
    exportedAt: z.string().optional(),
    data: z.object({ ...v1DataShape, bloatEvents: z.array(anyRow).default([]) }),
  }),
  z.object({
    app: z.literal(EXPORT_APP),
    version: z.literal(EXPORT_VERSION),
    exportedAt: z.string().optional(),
    data: z.object(v2DataShape),
  }),
]);

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

const ID_TABLES = [
  "dietVersions",
  "planOptions",
  "bloatEvents",
  "mealEntries",
  "workouts",
  "medMeasurements",
  "favorites",
  "products",
  "dayTemplates",
  "chatThreads",
  "chatMessages",
  "trainingPlans",
  "trainingSessions",
  "performanceMarks",
  "markEntries",
] as const satisfies readonly (keyof ImportData)[];

function importError(table: keyof ImportData, index: number, field: string): never {
  throw new Error(`Archivo inválido: ${table}[${index}].${field}.`);
}

function assertField(
  data: ImportData,
  table: keyof ImportData,
  field: string,
  valid: (value: unknown) => boolean,
): void {
  data[table].forEach((row, index) => {
    if (!valid(row[field])) importError(table, index, field);
  });
}

const isId = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0;
const isFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);
const isNullableNumber = (value: unknown) => value == null || isFiniteNumber(value);
const isString = (value: unknown) => typeof value === "string";
const isNullableString = (value: unknown) => value == null || isString(value);
const isDate = (value: unknown) => dateZ.safeParse(value).success;
const isNullableDate = (value: unknown) => value == null || isDate(value);
const isTime = (value: unknown) =>
  typeof value === "string" &&
  /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(value);
const isEnum = (values: readonly string[]) => (value: unknown) =>
  typeof value === "string" && values.includes(value);
const isNullableEnum = (values: readonly string[]) => (value: unknown) =>
  value == null || isEnum(values)(value);

function assertUniqueIds(data: ImportData, table: (typeof ID_TABLES)[number]): void {
  const ids = new Set<number>();
  data[table].forEach((row, index) => {
    if (!isId(row.id) || ids.has(row.id as number)) importError(table, index, "id");
    ids.add(row.id as number);
  });
}

function assertForeignKey(
  data: ImportData,
  table: keyof ImportData,
  field: string,
  parent: keyof ImportData,
  parentField = "id",
  nullable = false,
): void {
  const keys = new Set(data[parent].map((row) => row[parentField]));
  data[table].forEach((row, index) => {
    const value = row[field];
    if (nullable && value == null) return;
    if (!keys.has(value)) importError(table, index, field);
  });
}

/** Preflight completo: la vista previa nunca acepta datos que el restore rechazará. */
function validateImportData(data: ImportData): void {
  ID_TABLES.forEach((table) => assertUniqueIds(data, table));

  const dateFields: [keyof ImportData, string][] = [
    ["dietVersions", "effectiveFrom"],
    ["days", "date"],
    ["bloatEvents", "date"],
    ["mealEntries", "date"],
    ["healthMetrics", "date"],
    ["workouts", "date"],
    ["medMeasurements", "date"],
    ["trainingPlans", "validFrom"],
    ["markEntries", "recordedOn"],
  ];
  dateFields.forEach(([table, field]) => assertField(data, table, field, isDate));
  assertField(data, "trainingPlans", "validTo", isNullableDate);
  assertField(data, "trainingPlans", "importRequestId", isNullableString);
  assertField(data, "trainingPlans", "importFingerprint", isNullableString);
  assertField(data, "bloatEvents", "occurredAt", isTime);

  const requiredNumbers: [keyof ImportData, string[]][] = [
    ["dietVersions", ["kcalTarget", "protTarget"]],
    ["planOptions", ["kcal", "prot", "carb", "fat", "sort"]],
    ["mealEntries", ["kcal", "prot", "carb", "fat"]],
    ["favorites", ["kcal", "prot", "carb", "fat"]],
    ["products", ["baseKcal", "baseProt", "baseCarb", "baseFat"]],
    ["trainingSessions", ["sort"]],
    ["markEntries", ["value"]],
  ];
  requiredNumbers.forEach(([table, fields]) =>
    fields.forEach((field) => assertField(data, table, field, isFiniteNumber)),
  );

  const nullableNumbers: [keyof ImportData, string[]][] = [
    ["dietVersions", ["carbTarget", "fatTarget"]],
    ["planOptions", ["baseG"]],
    ["days", ["weight", "waterL", "bodyFatPct", "sessionKcal", "sessionRef"]],
    ["mealEntries", ["grams", "baseG", "baseKcal", "baseProt", "baseCarb", "baseFat", "clientMutationIndex"]],
    ["healthMetrics", ["steps", "activeKcal", "basalKcal", "hrvMs", "sleepH", "restingHr", "vo2max", "waterL", "weight", "bodyFatPct"]],
    ["workouts", ["durationMin", "avgHr", "activeKcal"]],
    ["medMeasurements", ["fatKg", "muscleKg", "weightKg"]],
    ["products", ["baseG"]],
    ["trainingSessions", ["kcalMin", "kcalMax", "duracionMin"]],
  ];
  nullableNumbers.forEach(([table, fields]) =>
    fields.forEach((field) => assertField(data, table, field, isNullableNumber)),
  );

  const stringFields: [keyof ImportData, string[]][] = [
    ["planOptions", ["name"]],
    ["mealEntries", ["name"]],
    ["workouts", ["type"]],
    ["favorites", ["name"]],
    ["products", ["name"]],
    ["dayTemplates", ["name"]],
    ["settings", ["key"]],
    ["chatThreads", ["title"]],
    ["chatMessages", ["content"]],
    ["trainingPlans", ["programa", "etiqueta"]],
    ["trainingSessions", ["key", "nombre", "contenido"]],
    ["performanceMarks", ["name", "unit"]],
  ];
  stringFields.forEach(([table, fields]) =>
    fields.forEach((field) => assertField(data, table, field, isString)),
  );
  assertField(data, "days", "notes", isNullableString);

  assertField(data, "planOptions", "meal", isEnum(schema.mealEnum.enumValues));
  assertField(data, "planOptions", "grp", isEnum(schema.grpEnum.enumValues));
  assertField(data, "days", "phase", isNullableEnum(schema.phaseEnum.enumValues));
  assertField(data, "days", "bloat", isNullableEnum(schema.bloatEnum.enumValues));
  assertField(data, "bloatEvents", "severity", isEnum(schema.bloatEnum.enumValues));
  assertField(data, "mealEntries", "meal", isEnum(schema.mealEnum.enumValues));
  assertField(data, "mealEntries", "source", isEnum(schema.mealSourceEnum.enumValues));
  assertField(data, "healthMetrics", "source", isEnum(schema.healthSourceEnum.enumValues));
  assertField(data, "favorites", "meal", isEnum(schema.mealEnum.enumValues));
  assertField(data, "products", "grupo", isNullableEnum(schema.grpEnum.enumValues));
  assertField(data, "products", "source", isEnum(schema.productSourceEnum.enumValues));
  assertField(data, "chatMessages", "role", isEnum(schema.chatRoleEnum.enumValues));
  assertField(data, "trainingPlans", "source", isEnum(schema.trainingSourceEnum.enumValues));
  assertField(data, "trainingSessions", "tipo", isEnum(schema.trainingTipoEnum.enumValues));
  assertField(data, "performanceMarks", "measureType", isEnum(schema.markMeasureEnum.enumValues));

  assertForeignKey(data, "planOptions", "dietVersionId", "dietVersions");
  assertForeignKey(data, "bloatEvents", "date", "days", "date");
  assertForeignKey(data, "mealEntries", "date", "days", "date");
  assertForeignKey(data, "trainingSessions", "planId", "trainingPlans");
  assertForeignKey(data, "days", "sessionRef", "trainingSessions", "id", true);
  assertForeignKey(data, "chatMessages", "threadId", "chatThreads");
  assertForeignKey(data, "markEntries", "markId", "performanceMarks");
}

/** Valida el archivo y devuelve los datos + el conteo (para la vista previa). */
export function parseImport(raw: unknown): ImportData {
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("El archivo no es un export de Fuelboard válido.");
  }
  validateImportData(parsed.data.data);
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
const dt = (v: unknown): Date =>
  v instanceof Date ? new Date(v.getTime()) : v ? new Date(String(v)) : new Date();

export interface ImportResult {
  restored: TableCounts;
}

/** REEMPLAZA todo el contenido con el del archivo (delete-all + insert remapeado). */
export async function applyImport(data: ImportData): Promise<ImportResult> {
  const queries: BatchItem<"pg">[] = [
    db.delete(schema.chatMessages),
    db.delete(schema.chatThreads),
    db.delete(schema.mealEntries),
    db.delete(schema.planOptions),
    db.delete(schema.bloatEvents),
    db.delete(schema.days),
    db.delete(schema.trainingSessions),
    db.delete(schema.trainingPlans),
    db.delete(schema.markEntries),
    db.delete(schema.performanceMarks),
    db.delete(schema.healthMetrics),
    db.delete(schema.workouts),
    db.delete(schema.medMeasurements),
    db.delete(schema.favorites),
    db.delete(schema.products),
    db.delete(schema.dayTemplates),
    db.delete(schema.dietVersions),
    db.delete(schema.settings),
  ];

  if (data.dietVersions.length) {
    queries.push(
      db.insert(schema.dietVersions).overridingSystemValue().values(
        data.dietVersions.map((r) => ({
          id: Number(r.id),
          effectiveFrom: String(r.effectiveFrom),
          kcalTarget: Number(r.kcalTarget),
          protTarget: Number(r.protTarget),
          carbTarget: n(r.carbTarget),
          fatTarget: n(r.fatTarget),
          note: s(r.note),
        })),
      ),
    );
  }
  if (data.trainingPlans.length) {
    queries.push(
      db.insert(schema.trainingPlans).overridingSystemValue().values(
        data.trainingPlans.map((r) => ({
          id: Number(r.id),
          importedAt: dt(r.importedAt),
          programa: String(r.programa),
          etiqueta: String(r.etiqueta),
          validFrom: String(r.validFrom),
          validTo: s(r.validTo),
          source: r.source as typeof schema.trainingSourceEnum.enumValues[number],
          importRequestId: s(r.importRequestId),
          importFingerprint: s(r.importFingerprint),
        })),
      ),
    );
  }
  if (data.trainingSessions.length) {
    queries.push(
      db.insert(schema.trainingSessions).overridingSystemValue().values(
        data.trainingSessions.map((r) => ({
          id: Number(r.id),
          planId: Number(r.planId),
          key: String(r.key),
          nombre: String(r.nombre),
          tipo: r.tipo as typeof schema.trainingTipoEnum.enumValues[number],
          contenido: String(r.contenido),
          kcalMin: n(r.kcalMin),
          kcalMax: n(r.kcalMax),
          duracionMin: n(r.duracionMin),
          sort: Number(r.sort),
        })),
      ),
    );
  }
  if (data.days.length) {
    queries.push(
      db.insert(schema.days).values(
        data.days.map((r) => ({
          date: String(r.date),
          weight: n(r.weight),
          waterL: n(r.waterL),
          bodyFatPct: n(r.bodyFatPct),
          sessionLabel: s(r.sessionLabel),
          sessionKcal: n(r.sessionKcal),
          sessionRef: n(r.sessionRef),
          phase: (r.phase ?? null) as typeof schema.phaseEnum.enumValues[number] | null,
          bloat: (r.bloat ?? null) as typeof schema.bloatEnum.enumValues[number] | null,
          notes: s(r.notes),
        })),
      ),
    );
  }
  if (data.bloatEvents.length) {
    queries.push(
      db.insert(schema.bloatEvents).overridingSystemValue().values(
        data.bloatEvents.map((r) => ({ id: Number(r.id), ...bloatEventImportRow(r) })),
      ),
    );
  }
  if (data.planOptions.length) {
    queries.push(
      db.insert(schema.planOptions).overridingSystemValue().values(
        data.planOptions.map((r) => ({
          id: Number(r.id),
          ...planOptionImportRow(r, Number(r.dietVersionId)),
        })),
      ),
    );
  }
  if (data.mealEntries.length) {
    queries.push(
      db.insert(schema.mealEntries).overridingSystemValue().values(
        data.mealEntries.map((r) => ({ id: Number(r.id), ...mealEntryImportRow(r) })),
      ),
    );
  }
  if (data.healthMetrics.length) {
    queries.push(
      db.insert(schema.healthMetrics).values(
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
          source: r.source as typeof schema.healthSourceEnum.enumValues[number],
          updatedAt: dt(r.updatedAt),
        })),
      ),
    );
  }
  if (data.workouts.length) {
    queries.push(
      db.insert(schema.workouts).overridingSystemValue().values(
        data.workouts.map((r) => ({
          id: Number(r.id),
          date: String(r.date),
          type: String(r.type),
          durationMin: n(r.durationMin),
          avgHr: n(r.avgHr),
          activeKcal: n(r.activeKcal),
        })),
      ),
    );
  }
  if (data.medMeasurements.length) {
    queries.push(
      db.insert(schema.medMeasurements).overridingSystemValue().values(
        data.medMeasurements.map((r) => ({
          id: Number(r.id),
          date: String(r.date),
          fatKg: n(r.fatKg),
          muscleKg: n(r.muscleKg),
          weightKg: n(r.weightKg),
        })),
      ),
    );
  }
  if (data.favorites.length) {
    queries.push(
      db.insert(schema.favorites).overridingSystemValue().values(
        data.favorites.map((r) => ({
          id: Number(r.id),
          meal: r.meal as typeof schema.mealEnum.enumValues[number],
          name: String(r.name),
          kcal: Number(r.kcal),
          prot: Number(r.prot),
          carb: Number(r.carb),
          fat: Number(r.fat),
        })),
      ),
    );
  }
  if (data.products.length) {
    queries.push(
      db.insert(schema.products).overridingSystemValue().values(
        data.products.map((r) => ({ id: Number(r.id), ...productImportRow(r) })),
      ),
    );
  }
  if (data.dayTemplates.length) {
    queries.push(
      db.insert(schema.dayTemplates).overridingSystemValue().values(
        data.dayTemplates.map((r) => ({
          id: Number(r.id),
          name: String(r.name),
          items: (Array.isArray(r.items) ? r.items : []) as typeof schema.dayTemplates.$inferInsert.items,
        })),
      ),
    );
  }
  if (data.settings.length) {
    queries.push(
      db.insert(schema.settings).values(
        data.settings.map((r) => ({ key: String(r.key), value: r.value ?? {} })),
      ),
    );
  }
  if (data.chatThreads.length) {
    queries.push(
      db.insert(schema.chatThreads).overridingSystemValue().values(
        data.chatThreads.map((r) => ({
          id: Number(r.id),
          title: String(r.title),
          summary: s(r.summary),
          summaryMsgCount: Number(r.summaryMsgCount ?? 0),
          createdAt: dt(r.createdAt),
          updatedAt: dt(r.updatedAt),
        })),
      ),
    );
  }
  if (data.chatMessages.length) {
    queries.push(
      db.insert(schema.chatMessages).overridingSystemValue().values(
        data.chatMessages.map((r) => ({
          id: Number(r.id),
          threadId: Number(r.threadId),
          role: r.role as typeof schema.chatRoleEnum.enumValues[number],
          turnId: typeof r.turnId === "string" ? r.turnId : null,
          content: String(r.content),
          createdAt: dt(r.createdAt),
        })),
      ),
    );
  }
  if (data.performanceMarks.length) {
    queries.push(
      db.insert(schema.performanceMarks).overridingSystemValue().values(
        data.performanceMarks.map((r) => ({
          id: Number(r.id),
          name: String(r.name),
          measureType: r.measureType as typeof schema.markMeasureEnum.enumValues[number],
          unit: String(r.unit),
          family: s(r.family),
          createdAt: dt(r.createdAt),
        })),
      ),
    );
  }
  if (data.markEntries.length) {
    queries.push(
      db.insert(schema.markEntries).overridingSystemValue().values(
        data.markEntries.map((r) => ({
          id: Number(r.id),
          markId: Number(r.markId),
          value: Number(r.value),
          recordedOn: String(r.recordedOn),
          note: s(r.note),
          createdAt: dt(r.createdAt),
        })),
      ),
    );
  }

  const identityTables = [
    "diet_versions",
    "plan_options",
    "bloat_events",
    "meal_entries",
    "workouts",
    "med_measurements",
    "favorites",
    "products",
    "day_templates",
    "chat_threads",
    "chat_messages",
    "training_plans",
    "training_sessions",
    "performance_marks",
    "mark_entries",
  ] as const;
  for (const table of identityTables) {
    const identifier = sql.raw(`"${table}"`);
    const sequence = sql.raw(`pg_get_serial_sequence('${table}', 'id')`);
    queries.push(
      db.select({
        value: sql<number>`setval(${sequence}, coalesce((select max(id) from ${identifier}), 1), exists(select 1 from ${identifier}))`,
      }).from(sql`(select 1) as reset_source`),
    );
  }

  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { restored: countRows(data) };
}
