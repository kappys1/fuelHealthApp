import { describe, expect, it } from "vitest";
import { mealEntryImportRow, planOptionImportRow } from "./backup-map";

/*
  Round-trip export → restore de una entrada con base+cantidad (F06, AC6).
  El export vuelca la fila tal cual (select *); el restore la reinserta vía
  mealEntryImportRow. Aquí verificamos que los campos de base sobreviven el
  round-trip sin pérdida, y que un export previo a F06 (sin esos campos) degrada
  a entrada fija (base null) en vez de romper.
*/
describe("mealEntryImportRow — round-trip de base+cantidad (AC6)", () => {
  it("conserva grams + base inmutable de una entrada escalable", () => {
    const exported = {
      id: 42,
      date: "2026-07-14",
      meal: "comida",
      name: "Arroz",
      kcal: 312,
      prot: 8,
      carb: 64,
      fat: 1.6,
      source: "plan",
      photoUrl: null,
      grams: 240,
      baseG: 150,
      baseKcal: 195,
      baseProt: 5,
      baseCarb: 40,
      baseFat: 1,
      createdAt: "2026-07-14T12:00:00.000Z",
    };
    const row = mealEntryImportRow(exported);
    expect(row.name).toBe("Arroz");
    expect(row.grams).toBe(240);
    expect(row.baseG).toBe(150);
    expect(row.baseKcal).toBe(195);
    expect(row.baseProt).toBe(5);
    expect(row.baseCarb).toBe(40);
    expect(row.baseFat).toBe(1);
    // macros actuales intactas
    expect(row.kcal).toBe(312);
    expect(row.prot).toBe(8);
  });

  it("un export previo a F06 (sin campos base) degrada a entrada fija (null)", () => {
    const legacy = {
      date: "2026-06-01",
      meal: "cena",
      name: "Café con leche",
      kcal: 70,
      prot: 6.4,
      carb: 9.5,
      fat: 0.4,
      source: "manual",
      photoUrl: null,
      createdAt: "2026-06-01T20:00:00.000Z",
    };
    const row = mealEntryImportRow(legacy);
    expect(row.grams).toBeNull();
    expect(row.baseG).toBeNull();
    expect(row.baseKcal).toBeNull();
    expect(row.kcal).toBe(70); // macros preservadas
  });
});

/*
  Round-trip export → restore de una opción de plan CON variantes (F08, AC5). El
  export vuelca la fila tal cual (select *, jsonb `variants` ya parseado); el restore
  la reinserta vía planOptionImportRow remapeando la FK a diet_versions. Un export
  previo a F08 (sin `variants`) degrada a opción normal ([]) en vez de romper.
*/
describe("planOptionImportRow — round-trip de variantes (F08, AC5)", () => {
  it("conserva las 4 variantes de «carne magra» y remapea la FK", () => {
    const exported = {
      id: 7,
      dietVersionId: 3,
      meal: "comida",
      grp: "Proteína",
      name: "Carne magra (pollo/pavo/ternera/cerdo)",
      baseG: 210,
      kcal: 231,
      prot: 46,
      carb: 0,
      fat: 5,
      variants: [
        { nombre: "Pollo", kcal: 231, prot: 46, carb: 0, fat: 5 },
        { nombre: "Pavo", kcal: 225, prot: 47, carb: 0, fat: 4 },
        { nombre: "Ternera", kcal: 260, prot: 44, carb: 0, fat: 9 },
        { nombre: "Cerdo", kcal: 305, prot: 43, carb: 0, fat: 14 },
      ],
      sort: 12,
    };
    const row = planOptionImportRow(exported, 99); // 99 = nuevo id de la versión
    expect(row.dietVersionId).toBe(99);
    expect(row.name).toBe("Carne magra (pollo/pavo/ternera/cerdo)");
    expect(row.baseG).toBe(210);
    expect(row.sort).toBe(12);
    expect(row.variants).toHaveLength(4);
    expect(row.variants[3]).toEqual({
      nombre: "Cerdo",
      kcal: 305,
      prot: 43,
      carb: 0,
      fat: 14,
    });
  });

  it("un export previo a F08 (sin `variants`) → opción normal ([])", () => {
    const legacy = {
      dietVersionId: 1,
      meal: "cena",
      grp: "Verdura",
      name: "Ensalada",
      baseG: null,
      kcal: 60,
      prot: 3,
      carb: 8,
      fat: 1,
      sort: 0,
    };
    const row = planOptionImportRow(legacy, 1);
    expect(row.variants).toEqual([]);
    expect(row.baseG).toBeNull();
    expect(row.kcal).toBe(60);
  });
});
