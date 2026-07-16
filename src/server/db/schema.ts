import {
  boolean,
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

// Origen del dato de un producto (F07). 'etiqueta' = leído de la tabla nutricional
// del envase (F-IA-11, la fuente autorizada); 'manual' = tecleado a mano; 'legacy'
// = migrado de los antiguos favorites (foto congelada de una estimación, badge
// «antiguo» → se asciende re-fotografiando).
export const productSourceEnum = pgEnum("product_source", [
  "etiqueta",
  "manual",
  "legacy",
]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

// Tipo de sesión de entrenamiento (doc 10 B1) — GENÉRICO (cualquier deporte);
// `key`/`nombre` son libres (T1-T6 en The Progrm, "Series umbral" en running…).
export const trainingTipoEnum = pgEnum("training_tipo", [
  "fuerza",
  "halterofilia",
  "gimnasticos",
  "metabolico",
  "aerobico",
  "mixto",
  "descanso",
  "otro",
]);

export const trainingSourceEnum = pgEnum("training_source", [
  "pdf",
  "foto",
  "texto",
]);

// Tipo de medida de una marca de rendimiento (F03 · marcas). Fija la DIRECCIÓN de
// "mejor" (peso/reps/distancia → más es mejor; tiempo → menos es mejor) y la unidad
// por defecto. Debe coincidir 1:1 con MEASURE_TYPES en src/lib/marks.ts.
export const markMeasureEnum = pgEnum("mark_measure", [
  "weight",
  "time",
  "reps",
  "distance",
]);

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
  // Sesión real del plan de entreno importado (doc 10 B1). Se conserva junto a
  // sessionLabel/sessionKcal (label desnormalizado). onDelete "set null": borrar
  // un plan NUNCA borra datos del día (los días son sagrados, principio 7).
  sessionRef: integer("session_ref").references(() => trainingSessions.id, {
    onDelete: "set null",
  }),
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
  // Gramos como dato de primera clase (F06): cantidad actual + base inmutable de
  // referencia para reescalar macros/kcal (factor = grams / baseG). Todas nullable
  // (aditivas): baseG null = entrada fija sin escalado ("4 huevos", café, backfill
  // no parseable). El escalado SIEMPRE parte de base*, nunca de valores ya escalados.
  grams: integer(),
  baseG: integer("base_g"),
  baseKcal: integer("base_kcal"),
  baseProt: real("base_prot"),
  baseCarb: real("base_carb"),
  baseFat: real("base_fat"),
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

// ── products (F07 · evoluciona favorites) ──
// Un único concepto "producto": editable, AGNÓSTICO de comida, con macros por base
// de gramos (baseG, típicamente 100 g de la etiqueta) que REESCALAN al añadirlo
// (reusa scaleMacros/entryBaseFields de F06). baseG null/0 = fijo (por unidad, sin
// stepper). `pinned` marca los que salen como chips de acceso rápido en el sheet.
// Editar un producto NO reescribe entradas ya registradas (macros horneadas por día).
export const products = pgTable("products", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  baseG: integer("base_g"),
  baseKcal: integer("base_kcal").notNull(),
  baseProt: real("base_prot").notNull(),
  baseCarb: real("base_carb").notNull(),
  baseFat: real("base_fat").notNull(),
  grupo: grpEnum(),
  source: productSourceEnum().notNull(),
  pinned: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

// ── training_plans / training_sessions (doc 10 B1) ──
// Semana de entrenamiento importada (PDF/foto/texto). `validFrom/validTo` acotan
// el periodo (null = abierta); la sesión de cada día se referencia desde
// days.sessionRef. Agnóstico de deporte (ver trainingTipoEnum).
export const trainingPlans = pgTable("training_plans", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  programa: text().notNull(),
  etiqueta: text().notNull(),
  validFrom: date("valid_from", { mode: "string" }).notNull(),
  validTo: date("valid_to", { mode: "string" }),
  source: trainingSourceEnum().notNull(),
});

export const trainingSessions = pgTable("training_sessions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  planId: integer("plan_id")
    .notNull()
    .references(() => trainingPlans.id, { onDelete: "cascade" }),
  key: text().notNull(),
  nombre: text().notNull(),
  tipo: trainingTipoEnum().notNull(),
  contenido: text().notNull(),
  kcalMin: integer("kcal_min"),
  kcalMax: integer("kcal_max"),
  duracionMin: integer("duracion_min"),
  sort: integer().notNull().default(0),
});

// ── performance_marks / mark_entries (F03 · marcas / registros de rendimiento) ──
// Marca agnóstica de deporte (nombre libre, sin catálogo): 1RM sentadilla, Fran
// (tiempo), 5k, dominadas máximas… `measureType` fija dirección de "mejor" + unidad.
// "Última" y "mejor" NO se guardan: se derivan en lectura (lib/marks.ts) → sin
// desincronización. Para el tiempo, `value` se guarda en SEGUNDOS.
export const performanceMarks = pgTable("performance_marks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  measureType: markMeasureEnum("measure_type").notNull(),
  unit: text().notNull(),
  // Familia OPCIONAL (F04 · migración 0005 aditiva): etiqueta libre para agrupar
  // (Snatch, Squat, Carrera…). Se CAPTURA ahora; el filtro/agrupación por familia
  // es futuro. null = sin familia. NO entra en el prompt de IA por ahora.
  family: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const markEntries = pgTable("mark_entries", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  markId: integer("mark_id")
    .notNull()
    .references(() => performanceMarks.id, { onDelete: "cascade" }),
  value: real().notNull(),
  // Día de la marca ('YYYY-MM-DD' Europe/Madrid vía lib/dates; nunca toISOString).
  recordedOn: date("recorded_on", { mode: "string" }).notNull(),
  note: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
