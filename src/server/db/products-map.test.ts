import { describe, expect, it } from "vitest";
import { favoritesToProducts, productImportRow } from "./products-map";

/*
  F07 · Fase 0 · Datos. Tests de la lógica pura de la migración favorites→products
  y del round-trip export→restore de products.
*/

describe("favoritesToProducts — migración legacy (AC3)", () => {
  it("convierte cada favorito en producto legacy (baseG null, pinned, grupo null)", () => {
    const { products, discarded } = favoritesToProducts([
      { id: 1, meal: "almuerzo", name: "Sandía 100 g", kcal: 30, prot: 0.6, carb: 7, fat: 0.2 },
      { id: 2, meal: "almuerzo", name: "Manzana 1 ud", kcal: 95, prot: 0.5, carb: 25, fat: 0.3 },
    ]);
    expect(discarded).toHaveLength(0);
    expect(products).toHaveLength(2);
    const sandia = products.find((p) => p.name === "Sandía 100 g")!;
    expect(sandia.source).toBe("legacy");
    expect(sandia.baseG).toBeNull(); // fijo: foto congelada de la estimación
    expect(sandia.pinned).toBe(true); // sigue saliendo como chip
    expect(sandia.grupo).toBeNull();
    expect(sandia.baseKcal).toBe(30);
    expect(sandia.baseProt).toBe(0.6);
    expect(sandia.baseCarb).toBe(7);
    expect(sandia.baseFat).toBe(0.2);
  });

  it("dedupea colisión de nombre (mismo nombre en 2 comidas) conservando el id mayor", () => {
    // favorites era unique por (meal,name): "Pan" pudo estar en almuerzo Y en cena.
    const { products, discarded } = favoritesToProducts([
      { id: 5, meal: "almuerzo", name: "Pan", kcal: 80, prot: 3, carb: 15, fat: 1 },
      { id: 9, meal: "cena", name: "Pan", kcal: 90, prot: 3.2, carb: 17, fat: 1.1 },
      { id: 3, meal: "comida", name: "Arroz", kcal: 130, prot: 2.7, carb: 28, fat: 0.3 },
    ]);
    // 3 filas de entrada, 2 nombres únicos → 2 productos, 1 descarte.
    expect(products).toHaveLength(2);
    expect(discarded).toHaveLength(1);
    const pan = products.find((p) => p.name === "Pan")!;
    // Conserva el más reciente (id 9): sus macros, no las del id 5.
    expect(pan.baseKcal).toBe(90);
    expect(pan.baseProt).toBe(3.2);
    expect(discarded[0]).toEqual({ name: "Pan", keptId: 9, droppedId: 5 });
  });

  it("sin id, usa el orden del array (el último es el más reciente)", () => {
    const { products, discarded } = favoritesToProducts([
      { name: "Café", kcal: 10, prot: 0, carb: 1, fat: 0 },
      { name: "Café", kcal: 18, prot: 0.6, carb: 1, fat: 1 },
    ]);
    expect(products).toHaveLength(1);
    expect(products[0]!.baseKcal).toBe(18); // el segundo (más reciente)
    expect(discarded).toHaveLength(1);
  });

  it("redondea kcal a entero y macros a 1 decimal al fijar la base", () => {
    const { products } = favoritesToProducts([
      { id: 1, name: "X", kcal: 70.6, prot: 4.55, carb: 9.51, fat: 1.49 },
    ]);
    expect(products[0]!.baseKcal).toBe(71);
    expect(products[0]!.baseProt).toBe(4.6);
    expect(products[0]!.baseCarb).toBe(9.5);
    expect(products[0]!.baseFat).toBe(1.5);
  });
});

describe("productImportRow — round-trip export→restore (AC4)", () => {
  it("recrea un producto idéntico (dropea id; conserva base/grupo/source/pinned)", () => {
    const exported = {
      id: 42,
      name: "Tortitas integrales Hacendado",
      baseG: 100,
      baseKcal: 350,
      baseProt: 12,
      baseCarb: 60,
      baseFat: 6.5,
      grupo: "Hidratos",
      source: "etiqueta",
      pinned: true,
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T11:00:00.000Z",
    };
    const row = productImportRow(exported);
    expect(row).not.toHaveProperty("id");
    expect(row.name).toBe("Tortitas integrales Hacendado");
    expect(row.baseG).toBe(100);
    expect(row.baseKcal).toBe(350);
    expect(row.baseProt).toBe(12);
    expect(row.baseFat).toBe(6.5);
    expect(row.grupo).toBe("Hidratos");
    expect(row.source).toBe("etiqueta");
    expect(row.pinned).toBe(true);
    expect(row.createdAt).toEqual(new Date("2026-07-16T10:00:00.000Z"));
    expect(row.updatedAt).toEqual(new Date("2026-07-16T11:00:00.000Z"));
  });

  it("producto fijo (baseG null) y grupo null sobreviven el round-trip", () => {
    const row = productImportRow({
      name: "Café + leche 300 ml",
      baseG: null,
      baseKcal: 18,
      baseProt: 0.6,
      baseCarb: 1,
      baseFat: 1,
      grupo: null,
      source: "legacy",
      pinned: true,
    });
    expect(row.baseG).toBeNull();
    expect(row.grupo).toBeNull();
    expect(row.source).toBe("legacy");
  });
});
