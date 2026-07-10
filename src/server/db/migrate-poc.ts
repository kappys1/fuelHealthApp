import { config } from "dotenv";
// Cargar env ANTES de crear el cliente Neon (scripts fuera de Next).
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { z } from "zod";
import * as schema from "./schema";

/*
  Migración del JSON del PoC (03-DATOS §6) → Postgres.

  Entrada: fuelboard-export-YYYY-MM-DD.json = { targets, logs, med, favs,
  templates, plan?, lastExport? }.

  IDEMPOTENTE (AC §6: re-ejecutar NO duplica). Estrategia por tabla:
  - diet_versions: se borra la versión con note = 'migrated:poc' (cascade →
    plan_options) y se reinserta. effective_from = fecha del log más antiguo.
  - days: upsert por PK (date).
  - meal_entries: delete de las fechas importadas + insert (fidelidad exacta,
    incluidas entradas legítimamente duplicadas del PoC → 0 pérdidas).
  - health_metrics: upsert por PK (date), source='csv'.
  - med_measurements: insert solo si no existe ya una fila idéntica
    (date+fat+muscle+weight) → no clobbera MEDs metidas a mano, idempotente.
  - favorites: upsert por (meal, name). day_templates: upsert por name.

  Uso: pnpm migrate:poc <archivo.json>
*/

const MIGRATED_NOTE = "migrated:poc";

// ── Esquema tolerante del export del PoC (el formato puede variar) ──
const num = z.coerce.number();
const macroFields = {
  kcal: num.default(0),
  prot: num.default(0),
  carb: num.default(0),
  fat: num.default(0),
};

const mealEntrySchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    meal: z.string(),
    name: z.string().default(""),
    src: z.string().optional(),
    ...macroFields,
  })
  .passthrough();

const logDaySchema = z
  .object({
    meals: z.array(mealEntrySchema).optional(),
    weight: num.optional(),
    water: num.optional(),
    bodyFat: num.optional(),
    session: z.string().optional(),
    sessionKcal: num.optional(),
    mode: z.string().optional(),
    bloat: z.string().optional(),
    notes: z.string().optional(),
    steps: num.optional(),
    activeKcal: num.optional(),
    basalKcal: num.optional(),
    hrv: num.optional(),
    sleep: num.optional(),
    restingHR: num.optional(),
    vo2max: num.optional(),
  })
  .passthrough();

const planOptionSchema = z
  .object({
    g: z.string().optional(),
    name: z.string(),
    baseG: num.nullable().optional(),
    ...macroFields,
  })
  .passthrough();

const exportSchema = z
  .object({
    targets: z
      .object({
        kcal: num.default(1800),
        prot: num.default(110),
        carb: num.nullable().optional(),
        fat: num.nullable().optional(),
      })
      .passthrough(),
    logs: z.record(z.string(), logDaySchema).default({}),
    med: z
      .array(
        z.object({
          date: z.string(),
          fat: num.optional(),
          muscle: num.optional(),
          weight: num.optional(),
        }),
      )
      .default([]),
    favs: z
      .array(
        z.object({ meal: z.string().optional(), name: z.string(), ...macroFields }),
      )
      .default([]),
    templates: z
      .array(z.object({ name: z.string(), items: z.array(z.any()).default([]) }))
      .default([]),
    plan: z.record(z.string(), z.array(planOptionSchema)).optional(),
    lastExport: z.string().optional(),
  })
  .passthrough();

type Meal = (typeof schema.mealEnum.enumValues)[number];
type Grp = (typeof schema.grpEnum.enumValues)[number];
type Phase = (typeof schema.phaseEnum.enumValues)[number];
type Bloat = (typeof schema.bloatEnum.enumValues)[number];
type Source = (typeof schema.mealSourceEnum.enumValues)[number];

const MEALS: Meal[] = [...schema.mealEnum.enumValues];
const GRPS: Grp[] = [...schema.grpEnum.enumValues];
const SOURCES: Source[] = [...schema.mealSourceEnum.enumValues];

const asMeal = (m: string): Meal =>
  (MEALS as string[]).includes(m) ? (m as Meal) : "extra";
const asGrp = (g: string | undefined): Grp =>
  g && (GRPS as string[]).includes(g) ? (g as Grp) : "Otros";
const asSource = (s: string | undefined): Source =>
  s && (SOURCES as string[]).includes(s) ? (s as Source) : "manual";

function mapPhase(mode: string | undefined): Phase | null {
  if (!mode) return null;
  const m = mode.toLowerCase();
  if (m.includes("carga")) return "carga";
  if (m.includes("competici")) return "competicion";
  if (m.includes("recuper")) return "recuperacion";
  return null; // Normal
}

function mapBloat(b: string | undefined): Bloat | null {
  if (!b) return null;
  const x = b.toLowerCase();
  if (x.startsWith("ningun")) return "ninguna";
  if (x.startsWith("leve")) return "leve";
  if (x.startsWith("moder")) return "moderada";
  if (x.startsWith("alta")) return "alta";
  return null;
}

const isDayKey = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: pnpm migrate:poc <archivo.json>");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Falta DATABASE_URL. Ejecuta `vercel env pull .env.local` o rellena .env.local.",
    );
  }

  const raw = JSON.parse(readFileSync(file, "utf8"));
  const data = exportSchema.parse(raw);

  const db = drizzle({
    client: neon(process.env.DATABASE_URL),
    schema,
    casing: "snake_case",
  });

  // ── Fechas de log ordenadas (solo claves YYYY-MM-DD) ──
  const logDates = Object.keys(data.logs).filter(isDayKey).sort();
  const earliest = logDates[0] ?? data.lastExport ?? "2025-01-01";

  const summary = {
    dietVersion: 0,
    planOptions: 0,
    days: 0,
    entries: 0,
    healthMetrics: 0,
    med: 0,
    favorites: 0,
    templates: 0,
  };

  // ── 1) diet_version 'migrated:poc' (idempotente: borrar + reinsertar) ──
  await db
    .delete(schema.dietVersions)
    .where(eq(schema.dietVersions.note, MIGRATED_NOTE));

  const [version] = await db
    .insert(schema.dietVersions)
    .values({
      effectiveFrom: earliest,
      kcalTarget: Math.round(data.targets.kcal),
      protTarget: data.targets.prot,
      carbTarget: data.targets.carb ?? null,
      fatTarget: data.targets.fat ?? null,
      note: MIGRATED_NOTE,
    })
    .returning();
  if (!version) throw new Error("No se pudo crear la diet_version migrada.");
  summary.dietVersion = 1;

  // ── 2) plan → plan_options de esa versión ──
  if (data.plan) {
    const opts = Object.entries(data.plan).flatMap(([meal, list]) =>
      list.map((p, i) => ({
        dietVersionId: version.id,
        meal: asMeal(meal),
        grp: asGrp(p.g),
        name: p.name,
        baseG: p.baseG ?? null,
        kcal: Math.round(p.kcal),
        prot: p.prot,
        carb: p.carb,
        fat: p.fat,
        sort: i,
      })),
    );
    if (opts.length > 0) {
      await db.insert(schema.planOptions).values(opts);
      summary.planOptions = opts.length;
    }
  }

  // ── 3) days (upsert por PK) — solo fechas con campos manuales o comidas ──
  const daysWithManual = logDates.filter((d) => {
    const l = data.logs[d];
    if (!l) return false;
    return (
      (l.meals && l.meals.length > 0) ||
      l.weight != null ||
      l.water != null ||
      l.bodyFat != null ||
      l.session != null ||
      l.sessionKcal != null ||
      l.mode != null ||
      l.bloat != null ||
      l.notes != null
    );
  });

  for (const d of daysWithManual) {
    const l = data.logs[d];
    if (!l) continue;
    const row = {
      date: d,
      weight: l.weight ?? null,
      waterL: l.water ?? null,
      bodyFatPct: l.bodyFat ?? null,
      sessionLabel: l.session ?? null,
      sessionKcal: l.sessionKcal != null ? Math.round(l.sessionKcal) : null,
      phase: mapPhase(l.mode),
      bloat: mapBloat(l.bloat),
      notes: l.notes ?? null,
    };
    await db
      .insert(schema.days)
      .values(row)
      .onConflictDoUpdate({ target: schema.days.date, set: row });
    summary.days++;
  }

  // ── 4) meal_entries (delete de fechas importadas + insert) ──
  const datesWithMeals = logDates.filter(
    (d) => (data.logs[d]?.meals?.length ?? 0) > 0,
  );
  if (datesWithMeals.length > 0) {
    await db
      .delete(schema.mealEntries)
      .where(inArray(schema.mealEntries.date, datesWithMeals));

    const entries = datesWithMeals.flatMap((d) =>
      (data.logs[d]?.meals ?? []).map((m, i) => {
        // createdAt desde el id del PoC (ms epoch) para preservar el orden.
        const idNum = typeof m.id === "number" ? m.id : Number(m.id);
        const createdAt =
          Number.isFinite(idNum) && idNum > 1e12
            ? new Date(Math.floor(idNum))
            : new Date(`${d}T12:00:00Z`);
        return {
          date: d,
          meal: asMeal(m.meal),
          name: m.name,
          kcal: Math.round(m.kcal),
          prot: m.prot,
          carb: m.carb,
          fat: m.fat,
          source: asSource(m.src),
          photoUrl: null,
          createdAt: Number.isFinite(idNum)
            ? createdAt
            : new Date(`${d}T12:00:${String(i).padStart(2, "0")}Z`),
        };
      }),
    );
    if (entries.length > 0) {
      await db.insert(schema.mealEntries).values(entries);
      summary.entries = entries.length;
    }
  }

  // ── 5) health_metrics (upsert por PK) ──
  for (const d of logDates) {
    const l = data.logs[d];
    if (!l) continue;
    const hasHealth =
      l.steps != null ||
      l.activeKcal != null ||
      l.basalKcal != null ||
      l.hrv != null ||
      l.sleep != null ||
      l.restingHR != null ||
      l.vo2max != null;
    if (!hasHealth) continue;
    const row = {
      date: d,
      steps: l.steps != null ? Math.round(l.steps) : null,
      activeKcal: l.activeKcal != null ? Math.round(l.activeKcal) : null,
      basalKcal: l.basalKcal != null ? Math.round(l.basalKcal) : null,
      hrvMs: l.hrv ?? null,
      sleepH: l.sleep ?? null,
      restingHr: l.restingHR != null ? Math.round(l.restingHR) : null,
      vo2max: l.vo2max ?? null,
      waterL: null,
      weight: null,
      bodyFatPct: null,
      source: "csv" as const,
    };
    await db
      .insert(schema.healthMetrics)
      .values(row)
      .onConflictDoUpdate({
        target: schema.healthMetrics.date,
        set: { ...row, updatedAt: new Date() },
      });
    summary.healthMetrics++;
  }

  // ── 6) med_measurements (insert si no existe fila idéntica) ──
  for (const m of data.med) {
    if (!isDayKey(m.date)) continue;
    const existing = await db
      .select({ id: schema.medMeasurements.id })
      .from(schema.medMeasurements)
      .where(
        and(
          eq(schema.medMeasurements.date, m.date),
          eq(schema.medMeasurements.fatKg, m.fat ?? 0),
          eq(schema.medMeasurements.muscleKg, m.muscle ?? 0),
          eq(schema.medMeasurements.weightKg, m.weight ?? 0),
        ),
      );
    if (existing.length > 0) continue;
    await db.insert(schema.medMeasurements).values({
      date: m.date,
      fatKg: m.fat ?? null,
      muscleKg: m.muscle ?? null,
      weightKg: m.weight ?? null,
    });
    summary.med++;
  }

  // ── 7) favorites (upsert por meal+name) ──
  for (const f of data.favs) {
    const meal = asMeal(f.meal ?? "almuerzo");
    await db
      .insert(schema.favorites)
      .values({ meal, name: f.name, kcal: Math.round(f.kcal), prot: f.prot, carb: f.carb, fat: f.fat })
      .onConflictDoUpdate({
        target: [schema.favorites.meal, schema.favorites.name],
        set: { kcal: Math.round(f.kcal), prot: f.prot, carb: f.carb, fat: f.fat },
      });
    summary.favorites++;
  }

  // ── 8) day_templates (upsert por name) ──
  for (const t of data.templates) {
    const items = (t.items as unknown[]).map((it) => {
      const x = it as Record<string, unknown>;
      return {
        meal: asMeal(String(x.meal ?? "extra")),
        name: String(x.name ?? ""),
        kcal: Math.round(Number(x.kcal ?? 0)),
        prot: Number(x.prot ?? 0),
        carb: Number(x.carb ?? 0),
        fat: Number(x.fat ?? 0),
      };
    });
    await db
      .insert(schema.dayTemplates)
      .values({ name: t.name, items })
      .onConflictDoUpdate({ target: schema.dayTemplates.name, set: { items } });
    summary.templates++;
  }

  // ── Resumen de conteos ──
  console.log("\n── Migración PoC completada ──");
  console.log(`  Archivo:         ${file}`);
  console.log(`  diet_version:    #${version.id} (${earliest}, ${version.kcalTarget} kcal / ${version.protTarget} P, carb ${version.carbTarget ?? "—"} / fat ${version.fatTarget ?? "—"})`);
  console.log(`  plan_options:    ${summary.planOptions}`);
  console.log(`  days:            ${summary.days}`);
  console.log(`  meal_entries:    ${summary.entries}`);
  console.log(`  health_metrics:  ${summary.healthMetrics}`);
  console.log(`  med:             ${summary.med}`);
  console.log(`  favorites:       ${summary.favorites}`);
  console.log(`  templates:       ${summary.templates}`);

  // Cordura: total kcal por día con comidas (para cruzar con el JSON original).
  console.log("\n  Totales kcal por día con comidas (verifica contra el JSON):");
  for (const d of datesWithMeals) {
    const meals = data.logs[d]?.meals ?? [];
    const kcal = meals.reduce((a, m) => a + Math.round(m.kcal), 0);
    console.log(`    ${d}: ${kcal} kcal · ${meals.length} entradas`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
