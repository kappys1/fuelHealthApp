import { describe, expect, it } from "vitest";
import {
  entryToDuplicateInput,
  entryToProductInput,
  resolveProductSave,
} from "./entry-actions";
import type { EntryDTO } from "@/server/db/queries/day";
import type { ProductDTO } from "@/server/db/queries/lookups";

function entry(over: Partial<EntryDTO> = {}): EntryDTO {
  return {
    id: 1,
    meal: "cena",
    name: "Avena",
    kcal: 555,
    prot: 20,
    carb: 90,
    fat: 10,
    source: "manual",
    photoUrl: null,
    grams: 150,
    baseG: 100,
    baseKcal: 370,
    baseProt: 13,
    baseCarb: 60,
    baseFat: 7,
    createdAt: "2026-07-25T10:00:00.000Z",
    ...over,
  };
}

function product(over: Partial<ProductDTO> = {}): ProductDTO {
  return {
    id: 10,
    name: "Avena",
    baseG: 100,
    baseKcal: 370,
    baseProt: 13,
    baseCarb: 60,
    baseFat: 7,
    grupo: null,
    source: "manual",
    unit: "g",
    pinned: false,
    ...over,
  };
}

describe("entryToProductInput · base vs. fijo (F13 §C)", () => {
  it("con base completa → producto que REESCALA (valores POR base, no escalados)", () => {
    const p = entryToProductInput(entry());
    expect(p.baseG).toBe(100);
    expect(p.baseKcal).toBe(370);
    expect(p.baseProt).toBe(13);
    expect(p.baseCarb).toBe(60);
    expect(p.baseFat).toBe(7);
    // NO los 555/20/90/10 escalados de la entrada.
    expect(p.baseKcal).not.toBe(555);
  });

  it("sin base → producto FIJO (baseG null) con las macros actuales de la entrada", () => {
    const p = entryToProductInput(
      entry({ baseG: null, baseKcal: null, baseProt: null, baseCarb: null, baseFat: null }),
    );
    expect(p.baseG).toBeNull();
    expect(p.baseKcal).toBe(555);
    expect(p.baseProt).toBe(20);
    expect(p.baseCarb).toBe(90);
    expect(p.baseFat).toBe(10);
  });

  it("base parcial (falta un campo) → se trata como FIJO", () => {
    const p = entryToProductInput(entry({ baseFat: null }));
    expect(p.baseG).toBeNull();
    expect(p.baseKcal).toBe(555);
  });

  it("defaults del catálogo: unit g, grupo null, pinned false, nombre trimmeado", () => {
    const p = entryToProductInput(entry({ name: "  Avena  " }));
    expect(p).toMatchObject({ unit: "g", grupo: null, pinned: false, name: "Avena" });
  });
});

describe("entryToProductInput · mapeo de source (F13 §C)", () => {
  it.each(["ia", "foto", "estimado"])("%s → estimado", (source) => {
    expect(entryToProductInput(entry({ source })).source).toBe("estimado");
  });

  it.each(["manual", "plan", "fav", "plantilla", "legacy"])("%s → manual", (source) => {
    expect(entryToProductInput(entry({ source })).source).toBe("manual");
  });
});

describe("resolveProductSave · dedup por nombre exacto (F13 §C)", () => {
  it("nombre existente → actualiza (existingId set)", () => {
    const { existingId, input } = resolveProductSave(entry(), [product({ id: 42 })]);
    expect(existingId).toBe(42);
    expect(input.name).toBe("Avena");
  });

  it("nombre nuevo → crea (existingId null)", () => {
    const { existingId } = resolveProductSave(entry({ name: "Kéfir" }), [product()]);
    expect(existingId).toBeNull();
  });

  it("match exacto sobre el nombre trimmeado (no coincide un nombre distinto)", () => {
    const { existingId } = resolveProductSave(
      entry({ name: "  Avena  " }),
      [product({ id: 7, name: "Avena" })],
    );
    expect(existingId).toBe(7);
  });
});

describe("entryToDuplicateInput · copia idéntica (F13 §B)", () => {
  it("conserva macros, source, photoUrl, gramos y la base inmutable", () => {
    const e = entry({ source: "foto", photoUrl: "/api/photos/view?p=x", grams: 150 });
    expect(entryToDuplicateInput(e)).toEqual({
      meal: "cena",
      name: "Avena",
      kcal: 555,
      prot: 20,
      carb: 90,
      fat: 10,
      source: "foto",
      photoUrl: "/api/photos/view?p=x",
      grams: 150,
      baseG: 100,
      baseKcal: 370,
      baseProt: 13,
      baseCarb: 60,
      baseFat: 7,
    });
  });

  it("una entrada fija se duplica también fija (base null preservada)", () => {
    const e = entry({ baseG: null, baseKcal: null, baseProt: null, baseCarb: null, baseFat: null, grams: null });
    const dup = entryToDuplicateInput(e);
    expect(dup.baseG).toBeNull();
    expect(dup.grams).toBeNull();
  });
});
