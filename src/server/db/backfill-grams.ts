import { config } from "dotenv";
// Cargar env ANTES de crear el cliente Neon (scripts fuera de Next).
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { backfillEntryGrams } from "../../lib/macros";
import * as schema from "./schema";

/*
  Backfill de gramos (F06 · Fase 1) sobre las entradas YA registradas en la BD.

  Convierte en escalables las entradas cuyo nombre lleva un sufijo claro "· NN g|ml"
  (patrón conservador de parseGramsSuffix): grams = baseG = NN, base = sus macros
  actuales, y limpia el sufijo del nombre. Las que no matchean quedan fijas (base
  null) sin tocarse.

  IDEMPOTENTE: solo procesa filas con base_g NULL; tras actualizar, el nombre ya no
  lleva sufijo → una segunda pasada no re-matchea. Las macros NO se modifican (solo
  se copian a la base) → 0 pérdidas (principio 7).

  Uso: pnpm backfill:grams          (aplica)
       pnpm backfill:grams --dry    (solo reporta, no escribe)
*/

async function main() {
  const dry = process.argv.includes("--dry");
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

  // Solo candidatas: aún sin base (base_g NULL). Idempotencia natural.
  const rows = await db
    .select()
    .from(schema.mealEntries)
    .where(isNull(schema.mealEntries.baseG));

  let matched = 0;
  const examples: string[] = [];
  for (const r of rows) {
    const bf = backfillEntryGrams({
      name: r.name,
      kcal: r.kcal,
      prot: r.prot,
      carb: r.carb,
      fat: r.fat,
    });
    if (bf.baseG == null) continue; // sin patrón claro → queda fija
    matched++;
    if (examples.length < 10) examples.push(`  "${r.name}" → "${bf.name}" · ${bf.grams} g`);
    if (!dry) {
      await db
        .update(schema.mealEntries)
        .set({
          name: bf.name,
          grams: bf.grams,
          baseG: bf.baseG,
          baseKcal: bf.baseKcal,
          baseProt: bf.baseProt,
          baseCarb: bf.baseCarb,
          baseFat: bf.baseFat,
        })
        .where(eq(schema.mealEntries.id, r.id));
    }
  }

  console.log(`\n── Backfill de gramos (F06) ${dry ? "[DRY-RUN]" : ""} ──`);
  console.log(`  Candidatas (base_g null): ${rows.length}`);
  console.log(`  Backfilleadas:            ${matched}`);
  console.log(`  Fijas (sin patrón):       ${rows.length - matched}`);
  if (examples.length > 0) {
    console.log("\n  Ejemplos:");
    console.log(examples.join("\n"));
  }
  if (dry) console.log("\n  (dry-run: no se escribió nada)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
