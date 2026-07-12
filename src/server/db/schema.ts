import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/*
  Esquema Fuelboard — fuente de verdad: docs/specs/03-DATOS.md §1.
  Convenciones:
  - kcal: enteras (integer). Macros (prot/carb/fat): real (guardar 1 decimal OK).
  - Claves de día: `date` en modo string 'YYYY-MM-DD' (Europe/Madrid) — ver lib/dates.
  - `days` y `health_metrics` van separados a propósito (manual vs importado);
    la vista efectiva los fusiona con precedencia health_metrics > days.
*/

// ── Enumeraciones fijas (03-DATOS §1/§2) ──
export const mealEnum = pgEnum("meal", [
  "almuerzo",
  "comida",
  "merienda",
  "cena",
  "extra",
]);

export const grpEnum = pgEnum("grp", [
  "Verdura",
  "Hidratos",
  "Proteína",
  "Grasa",
  "Otros",
  "Opción única",
]);

// Normal se representa como null en BD (03-DATOS §2); el valor 'normal' se
// mantiene en el enum por compatibilidad con §1.
export const phaseEnum = pgEnum("phase", [
  "normal",
  "carga",
  "competicion",
  "recuperacion",
]);

export const bloatEnum = pgEnum("bloat", [
  "ninguna",
  "leve",
  "moderada",
  "alta",
]);

export const mealSourceEnum = pgEnum("meal_source", [
  "plan",
  "foto",
  "manual",
  "ia",
  "fav",
  "plantilla",
]);

export const healthSourceEnum = pgEnum("health_source", ["endpoint", "csv"]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

// ── diet_versions ──
export const dietVersions = pgTable("diet_versions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  kcalTarget: integer("kcal_target").notNull(),
  protTarget: real("prot_target").notNull(),
  carbTarget: real("carb_target"),
  fatTarget: real("fat_target"),
  note: text(),
});

// ── plan_options ──
export const planOptions = pgTable("plan_options", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  dietVersionId: integer("diet_version_id")
    .notNull()
    .references(() => dietVersions.id, { onDelete: "cascade" }),
  meal: mealEnum().notNull(),
  grp: grpEnum().notNull(),
  name: text().notNull(),
  baseG: integer("base_g"),
  kcal: integer().notNull(),
  prot: real().notNull(),
  carb: real().notNull(),
  fat: real().notNull(),
  sort: integer().notNull().default(0),
});

// ── days (métricas manuales del día) ──
export const days = pgTable("days", {
  date: date({ mode: "string" }).primaryKey(),
  weight: real(),
  waterL: real("water_l"),
  bodyFatPct: real("body_fat_pct"),
  sessionLabel: text("session_label"),
  sessionKcal: integer("session_kcal"),
  phase: phaseEnum(),
  bloat: bloatEnum(),
  notes: text(),
});

// ── meal_entries ──
export const mealEntries = pgTable("meal_entries", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date({ mode: "string" })
    .notNull()
    .references(() => days.date, { onDelete: "cascade" }),
  meal: mealEnum().notNull(),
  name: text().notNull(),
  kcal: integer().notNull(),
  prot: real().notNull(),
  carb: real().notNull(),
  fat: real().notNull(),
  source: mealSourceEnum().notNull(),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── health_metrics (importado de Apple Health) ──
export const healthMetrics = pgTable("health_metrics", {
  date: date({ mode: "string" }).primaryKey(),
  steps: integer(),
  activeKcal: integer("active_kcal"),
  basalKcal: integer("basal_kcal"),
  hrvMs: real("hrv_ms"),
  sleepH: real("sleep_h"),
  restingHr: integer("resting_hr"),
  vo2max: real(),
  waterL: real("water_l"),
  weight: real(),
  bodyFatPct: real("body_fat_pct"),
  // Catch-all de métricas de Apple Health que no modelamos como columnas (masa
  // magra, tiempo de ejercicio, SpO2, frecuencia respiratoria, temperatura de
  // muñeca, etc.): se guardan TODAS para que el coach/chat/entrenador (fases
  // siguientes) puedan usarlas aunque hoy no se muestren. Clave = nombre HAE
  // normalizado; valor = agregado del día.
  extra: jsonb().$type<Record<string, number>>(),
  source: healthSourceEnum().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── workouts ──
export const workouts = pgTable("workouts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date({ mode: "string" }).notNull(),
  type: text().notNull(),
  durationMin: integer("duration_min"),
  avgHr: integer("avg_hr"),
  activeKcal: integer("active_kcal"),
});

// ── med_measurements ──
export const medMeasurements = pgTable("med_measurements", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date({ mode: "string" }).notNull(),
  fatKg: real("fat_kg"),
  muscleKg: real("muscle_kg"),
  weightKg: real("weight_kg"),
});

// ── favorites ──
export const favorites = pgTable(
  "favorites",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    meal: mealEnum().notNull(),
    name: text().notNull(),
    kcal: integer().notNull(),
    prot: real().notNull(),
    carb: real().notNull(),
    fat: real().notNull(),
  },
  (t) => [unique("favorites_meal_name_unique").on(t.meal, t.name)],
);

// ── day_templates ──
export interface TemplateItem {
  meal: (typeof mealEnum.enumValues)[number];
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export const dayTemplates = pgTable("day_templates", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  items: jsonb().$type<TemplateItem[]>().notNull(),
});

// ── chat_threads / chat_messages ──
export const chatThreads = pgTable("chat_threads", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  // Resumen cacheado de los mensajes anteriores a los últimos 12 (F-IA-8 §6).
  summary: text(),
  // Nº de mensajes que cubre el resumen cacheado (para invalidarlo por lotes).
  summaryMsgCount: integer("summary_msg_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => chatThreads.id, { onDelete: "cascade" }),
  role: chatRoleEnum().notNull(),
  content: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── settings (key/value jsonb: lastExport, prefs de tema, etc.) ──
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
});
