import { config } from "dotenv";
// Cargar env ANTES de crear el cliente Neon (scripts fuera de Next).
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/*
  Seed del plan Regenera (1.800 kcal / 110 g prot) — valores EXACTOS del PoC,
  transcritos de docs/specs/03-DATOS.md §5. Comas decimales → puntos.
  Idempotente: reejecutar NO duplica (borra la versión semilla y reinserta;
  upsert de favoritos por (meal, name)).
*/

const SEED_NOTE = "seed:regenera-v1";
const EFFECTIVE_FROM = "2025-01-01";

type Meal = (typeof schema.mealEnum.enumValues)[number];
type Grp = (typeof schema.grpEnum.enumValues)[number];

interface Opt {
  meal: Meal;
  grp: Grp;
  name: string;
  baseG: number | null;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

// Helper compacto: (meal, grp, name, baseG, kcal, prot, carb, fat)
const o = (
  meal: Meal,
  grp: Grp,
  name: string,
  baseG: number | null,
  kcal: number,
  prot: number,
  carb: number,
  fat: number,
): Opt => ({ meal, grp, name, baseG, kcal, prot, carb, fat });

const PLAN: Opt[] = [
  // ── Almuerzo (elegir 1) ──
  o("almuerzo", "Opción única", "Tortitas de arroz x4", null, 150, 3, 33, 1),
  o("almuerzo", "Opción única", "Pan bimbo 3 reb. + mermelada s/a 25 g", null, 230, 7, 45, 2.5),
  o("almuerzo", "Opción única", "Plátano 1 ud", null, 100, 1, 24, 0.3),
  o("almuerzo", "Opción única", "Fruta", 100, 50, 0.5, 12, 0.2),

  // ── Comida (1 por grupo) ──
  o("comida", "Verdura", "Verdura (vapor/plancha/ensalada)", 100, 35, 2, 5, 0.5),
  o("comida", "Verdura", "Gazpacho", 200, 70, 2, 8, 3),
  o("comida", "Hidratos", "Arroz/quinoa/legumbre hervido", 150, 195, 5, 40, 1),
  o("comida", "Hidratos", "Patata/boniato/yuca/plátano macho", 200, 170, 4, 38, 0.3),
  o("comida", "Hidratos", "Pan", 70, 185, 6, 36, 1.5),
  o("comida", "Hidratos", "Ñoquis", 100, 130, 4, 27, 0.5),
  o("comida", "Proteína", "Carne magra (pollo/pavo/ternera, crudo)", 210, 231, 46, 0, 5),
  o("comida", "Proteína", "Pescado blanco/marisco (crudo)", 210, 180, 40, 0, 2),
  o("comida", "Proteína", "Pescado azul (crudo)", 210, 380, 42, 0, 24),
  o("comida", "Proteína", "Huevos 4 uds", null, 280, 25, 2, 20),
  o("comida", "Grasa", "AOVE", 10, 90, 0, 0, 10),
  o("comida", "Otros", "Espresso + leche almendras 200 ml", null, 30, 1, 2, 2),

  // ── Merienda (conjunto: suma de todas) ──
  o("merienda", "Hidratos", "Pan", 60, 160, 5, 31, 1.2),
  o("merienda", "Grasa", "Crema de cacahuete", 20, 120, 5, 4, 10),
  o("merienda", "Otros", "Mermelada s/a", 10, 8, 0, 2, 0),

  // ── Cena (1 por grupo; raciones menores) ──
  o("cena", "Verdura", "Verdura", 150, 50, 3, 7, 0.8),
  o("cena", "Verdura", "Gazpacho", 200, 70, 2, 8, 3),
  o("cena", "Hidratos", "Arroz/quinoa/legumbre", 120, 156, 4, 32, 0.8),
  o("cena", "Hidratos", "Patata/boniato", 180, 155, 3.5, 34, 0.3),
  o("cena", "Hidratos", "Pan", 60, 160, 5, 31, 1.2),
  o("cena", "Hidratos", "Ñoquis", 90, 117, 3.5, 24, 0.5),
  // Proteínas, AOVE y café: iguales que Comida (cerdo también vale en cena)
  o("cena", "Proteína", "Carne magra (pollo/pavo/ternera/cerdo, crudo)", 210, 231, 46, 0, 5),
  o("cena", "Proteína", "Pescado blanco/marisco (crudo)", 210, 180, 40, 0, 2),
  o("cena", "Proteína", "Pescado azul (crudo)", 210, 380, 42, 0, 24),
  o("cena", "Proteína", "Huevos 4 uds", null, 280, 25, 2, 20),
  o("cena", "Grasa", "AOVE", 10, 90, 0, 0, 10),
  o("cena", "Otros", "Espresso + leche almendras 200 ml", null, 30, 1, 2, 2),
];

// Favoritos reales conocidos (03-DATOS §5). favorites no tiene base_g → los
// gramos/ml van en el nombre. Meal por defecto: almuerzo (snack de mañana).
interface Fav {
  meal: Meal;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}
const FAVS: Fav[] = [
  { meal: "almuerzo", name: "Sandía 100 g", kcal: 30, prot: 0.6, carb: 7, fat: 0.2 },
  { meal: "almuerzo", name: "Manzana 1 ud", kcal: 95, prot: 0.5, carb: 25, fat: 0.3 },
  { meal: "almuerzo", name: "Pan bimbo 1 reb. + mermelada s/a", kcal: 85, prot: 2.5, carb: 16, fat: 1 },
  { meal: "almuerzo", name: "Café + leche almendras zero 300 ml", kcal: 18, prot: 0.6, carb: 1, fat: 1 },
];

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
