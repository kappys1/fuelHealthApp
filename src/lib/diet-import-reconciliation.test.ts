import { describe, expect, it } from "vitest";
import type { ProductDTO } from "@/server/db/queries/lookups";
import type { PlanOptionDTO } from "@/server/db/queries/plan";
import {
  findPreviousDietOption,
  findSafeDietProductMatch,
  normalizeDietImportName,
  reconcileDietImportOption,
  selectDietImportSource,
  type DietImportValues,
} from "./diet-import-reconciliation";

const imported = (patch: Partial<DietImportValues> = {}): DietImportValues => ({
  meal: "comida",
  grp: "Verdura",
  name: "Gazpacho",
  baseG: 200,
  unit: "g",
  kcal: 70,
  prot: 1,
  carb: 6,
  fat: 4,
  variants: [],
  ...patch,
});

const previous = (patch: Partial<PlanOptionDTO> = {}): PlanOptionDTO => ({
  id: 10,
  meal: "comida",
  grp: "Verdura",
  name: "Gazpacho",
  baseG: 200,
  unit: "ml",
  kcal: 75,
  prot: 1.2,
  carb: 6,
  fat: 4.6,
  variants: [],
  sort: 0,
  ...patch,
});

const product = (patch: Partial<ProductDTO> = {}): ProductDTO => ({
  id: 20,
  name: "Gazpacho Lidl",
  baseG: 100,
  baseKcal: 37,
  baseProt: 0.6,
  baseCarb: 3,
  baseFat: 2.3,
  grupo: "Verdura",
  source: "etiqueta",
  unit: "ml",
  pinned: false,
  ...patch,
});

describe("normalización y match conservador", () => {
  it("normaliza acentos, puntuación, caja y espacios", () => {
    expect(normalizeDietImportName("  GÁZPACHO---Lidl  ")).toBe("gazpacho lidl");
  });

  it("admite exacto o contención única de opción → producto", () => {
    const lidl = product();
    expect(findSafeDietProductMatch("gazpacho", [lidl])).toBe(lidl);
    expect(findSafeDietProductMatch("Gazpacho Lidl", [lidl])).toBe(lidl);
  });

  it("no decide entre dos panes ni aplica un ingrediente dentro de una preparación", () => {
    const pan1 = product({ id: 1, name: "Pan Bimbo" });
    const pan2 = product({ id: 2, name: "Pan de masa madre" });
    expect(findSafeDietProductMatch("Pan", [pan1, pan2])).toBeNull();
    expect(findSafeDietProductMatch("Café con leche y canela", [product({ name: "Leche" })])).toBeNull();
  });

  it("si el nombre anterior está repetido, exige una única coincidencia en la misma comida", () => {
    const comida = previous({ id: 1, meal: "comida" });
    const cena = previous({ id: 2, meal: "cena" });
    expect(findPreviousDietOption(imported(), [comida, cena])).toBe(comida);
    expect(findPreviousDietOption(imported(), [comida, previous({ id: 3 })])).toBeNull();
  });
});

describe("reconciliación y precedencia", () => {
  it("sin coincidencias conserva los valores de F-IA-9 y marca Estimación IA", () => {
    const ai = imported({ name: "Opción nueva", kcal: 123, prot: 4.7 });
    const row = reconcileDietImportOption(ai, [], []);
    expect(row.origin).toBe("ai");
    expect(row.values).toEqual(ai);
  });

  it("reutiliza dieta anterior por nombre exacto y copia unidad + variantes", () => {
    const variants = [
      { nombre: "Gazpacho suave", kcal: 75, prot: 1.2, carb: 6, fat: 4.6 },
    ];
    const row = reconcileDietImportOption(imported(), [previous({ variants })], []);
    expect(row.origin).toBe("previous");
    expect(row.values).toMatchObject({
      name: "Gazpacho",
      unit: "ml",
      kcal: 75,
      prot: 1.2,
      carb: 6,
      fat: 4.6,
      variants,
    });
  });

  it("una etiqueta inequívoca gana y escala desde su base; manual/estimado/legacy nunca ganan solos", () => {
    const labelRow = reconcileDietImportOption(imported(), [previous()], [product()]);
    expect(labelRow.origin).toBe("label");
    expect(labelRow.values).toMatchObject({
      name: "Gazpacho Lidl",
      baseG: 200,
      unit: "ml",
      kcal: 74,
      prot: 1.2,
      carb: 6,
      fat: 4.6,
    });

    for (const source of ["manual", "estimado", "legacy"] as const) {
      const row = reconcileDietImportOption(imported(), [previous()], [
        product({ source }),
      ]);
      expect(row.origin).toBe("previous");
      expect(row.sources.some((candidate) => candidate.key === "product:20")).toBe(true);
    }
  });

  it("ante dos etiquetas de contención cae a la dieta anterior", () => {
    const row = reconcileDietImportOption(imported(), [previous()], [
      product(),
      product({ id: 21, name: "Gazpacho Alvalle" }),
    ]);
    expect(row.origin).toBe("previous");
  });

  it("una opción con variantes reaprovecha las anteriores pero no expone productos", () => {
    const row = reconcileDietImportOption(
      imported({ variants: [{ nombre: "A", kcal: 70, prot: 1, carb: 6, fat: 4 }] }),
      [
        previous({
          variants: [
            { nombre: "A", kcal: 75, prot: 1.2, carb: 6, fat: 4.6 },
            { nombre: "B", kcal: 80, prot: 2, carb: 7, fat: 5 },
          ],
        }),
      ],
      [product()],
    );
    expect(row.origin).toBe("previous");
    expect(row.values.variants).toHaveLength(2);
    expect(row.sources.every((source) => source.productId == null)).toBe(true);
  });
});

describe("escalado sin deriva y copias limpias", () => {
  it("250 ml sale siempre de la base anterior; volver a 200 reproduce el original", () => {
    const base = previous();
    const at250 = reconcileDietImportOption(imported({ baseG: 250 }), [base], []);
    expect(at250.values).toMatchObject({
      baseG: 250,
      kcal: 94,
      prot: 1.5,
      carb: 7.5,
      fat: 5.8,
    });

    const backAt200 = reconcileDietImportOption(imported({ baseG: 200 }), [base], []);
    expect(backAt200.values).toMatchObject({
      baseG: 200,
      kcal: 75,
      prot: 1.2,
      carb: 6,
      fat: 4.6,
    });
  });

  it("si la unidad explícita es incompatible, no pega macros reescaladas a otra base", () => {
    const row = reconcileDietImportOption(imported({ unit: "g", baseG: 250 }), [previous()], [], {
      importedUnitExplicit: true,
    });
    expect(row.values).toMatchObject({ baseG: 200, unit: "ml", kcal: 75 });
  });

  it("volver a IA y después a producto restaura copias limpias", () => {
    const row = reconcileDietImportOption(imported(), [previous()], [product()]);
    const label = selectDietImportSource(row, "product:20")!;
    label.values.kcal = 999;
    label.values.variants.push({ nombre: "contaminada", kcal: 1, prot: 1, carb: 1, fat: 1 });

    const ai = selectDietImportSource(row, "ai")!;
    expect(ai.values.kcal).toBe(70);
    const cleanLabel = selectDietImportSource(row, "product:20")!;
    expect(cleanLabel.values.kcal).toBe(74);
    expect(cleanLabel.values.variants).toEqual([]);
  });
});
