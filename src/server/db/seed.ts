import { config } from "dotenv";
// Cargar env ANTES de crear el cliente Neon (scripts fuera de Next).
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { FAVS, PLAN } from "./plan-seed";
import * as schema from "./schema";

/*
  Seed del plan Regenera (1.800 kcal / 110 g prot). Los valores viven en
  ./plan-seed.ts (fuente compartida con los tests de derivados).
  Idempotente: reejecutar NO duplica (borra la versión semilla y reinserta;
  upsert de favoritos por (meal, name)).
*/

const SEED_NOTE = "seed:regenera-v1";
const EFFECTIVE_FROM = "2025-01-01";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Falta DATABASE_URL. Ejecuta `vercel env pull .env.local` o rellena .env.local.",
    );
  }
  const db = drizzle({
    client: neon(process.env.DATABASE_URL),
    schema,
    casing: "snake_case",
  });

  // Idempotencia: borrar la versión semilla previa (cascade → plan_options).
  await db
    .delete(schema.dietVersions)
    .where(eq(schema.dietVersions.note, SEED_NOTE));

  const inserted = await db
    .insert(schema.dietVersions)
    .values({
      effectiveFrom: EFFECTIVE_FROM,
      kcalTarget: 1800,
      protTarget: 110,
      carbTarget: null, // se derivan del plan en Fase 1
      fatTarget: null,
      note: SEED_NOTE,
    })
    .returning();

  const version = inserted[0];
  if (!version) throw new Error("No se pudo crear la diet_version semilla.");

  await db.insert(schema.planOptions).values(
    PLAN.map((p, i) => ({ ...p, dietVersionId: version.id, sort: i })),
  );

  for (const f of FAVS) {
    await db
      .insert(schema.favorites)
      .values(f)
      .onConflictDoUpdate({
        target: [schema.favorites.meal, schema.favorites.name],
        set: { kcal: f.kcal, prot: f.prot, carb: f.carb, fat: f.fat },
      });
  }

  // ── Verificación ──
  const opts = await db
    .select()
    .from(schema.planOptions)
    .where(eq(schema.planOptions.dietVersionId, version.id));

  const missingMacros = opts.filter((x) =>
    [x.kcal, x.prot, x.carb, x.fat].some((v) => v === null || v === undefined),
  );
  const byMeal = opts.reduce<Record<string, number>>((acc, x) => {
    acc[x.meal] = (acc[x.meal] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`✔ diet_version #${version.id} (${SEED_NOTE}) 1800 kcal / 110 P`);
  console.log(`✔ plan_options insertadas: ${opts.length}`);
  console.log(`  por comida: ${JSON.stringify(byMeal)}`);
  console.log(`✔ favorites (upsert): ${FAVS.length}`);
  if (missingMacros.length > 0) {
    console.error(
      `✗ ${missingMacros.length} opciones SIN las 4 macros completas`,
    );
    process.exit(1);
  }
  console.log("✔ Todas las opciones tienen kcal/prot/carb/fat.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
