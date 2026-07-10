/*
  Plan semilla Regenera (1.800 kcal / 110 g prot) — valores EXACTOS del PoC,
  transcritos de docs/specs/03-DATOS.md §5. Comas decimales → puntos.

  Fuente ÚNICA compartida por el seed (src/server/db/seed.ts) y por los tests de
  derivados del plan (server/analytics/planDerived.test.ts): un solo sitio para
  la verdad del plan.
*/
import type { grpEnum, mealEnum } from "./schema";

export type Meal = (typeof mealEnum.enumValues)[number];
export type Grp = (typeof grpEnum.enumValues)[number];

export interface SeedOption {
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
): SeedOption => ({ meal, grp, name, baseG, kcal, prot, carb, fat });

export const PLAN: SeedOption[] = [
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
export interface SeedFav {
  meal: Meal;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export const FAVS: SeedFav[] = [
  { meal: "almuerzo", name: "Sandía 100 g", kcal: 30, prot: 0.6, carb: 7, fat: 0.2 },
  { meal: "almuerzo", name: "Manzana 1 ud", kcal: 95, prot: 0.5, carb: 25, fat: 0.3 },
  { meal: "almuerzo", name: "Pan bimbo 1 reb. + mermelada s/a", kcal: 85, prot: 2.5, carb: 16, fat: 1 },
  { meal: "almuerzo", name: "Café + leche almendras zero 300 ml", kcal: 18, prot: 0.6, carb: 1, fat: 1 },
];
