import { config } from "dotenv";
// Cargar env ANTES de crear el cliente Neon (scripts fuera de Next).
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { favoritesToProducts } from "./products-map";
import * as schema from "./schema";

/*
  Migración favorites → products (F07 · Fase 0). 0 pérdidas (principio 7).

  Copia cada favorito a la tabla `products` como `source:'legacy'`, `baseG:null`
  (fijo, foto congelada de la estimación), `pinned:true` (sigue saliendo como chip)
  y `grupo:null`. Las colisiones de nombre (el mismo nombre pudo estar en 2 comidas,
  favorites era unique por (meal,name)) se dedupean conservando el más reciente
  (mayor id) y se LOGUEAN — nada se descarta en silencio.

  `favorites` NO se toca: queda deprecada (ya no la lee la app) y se elimina en una
  migración posterior tras verificar en prod.

  IDEMPOTENTE: inserta con onConflictDoNothing sobre `name` (unique) → una segunda
  pasada no duplica ni pisa productos ya editados a mano.

  Uso: pnpm migrate:products          (aplica)
       pnpm migrate:products --dry    (solo reporta, no escribe)
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

  const favs = await db.select().from(schema.favorites);
  const { products, discarded } = favoritesToProducts(favs);

  const existing = await db
    .select({ name: schema.products.name })
    .from(schema.products);
  const existingNames = new Set(existing.map((p) => p.name));
  const toInsert = products.filter((p) => !existingNames.has(p.name));

  console.log(`\n── Migración favorites → products (F07) ${dry ? "[DRY-RUN]" : ""} ──`);
  console.log(`  Favoritos en BD:        ${favs.length}`);
  console.log(`  Productos únicos:       ${products.length}`);
  console.log(`  Ya existentes (skip):   ${products.length - toInsert.length}`);
  console.log(`  A insertar:             ${toInsert.length}`);
  if (discarded.length > 0) {
    console.log(`\n  Colisiones de nombre dedupeadas (${discarded.length}):`);
    for (const d of discarded) {
      console.log(`    "${d.name}" → conservado id ${d.keptId}, descartado id ${d.droppedId}`);
    }
  }

  if (!dry && toInsert.length > 0) {
    await db
      .insert(schema.products)
      .values(toInsert)
      .onConflictDoNothing({ target: schema.products.name });
  }
  if (dry) console.log("\n  (dry-run: no se escribió nada)");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
