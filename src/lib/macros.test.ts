import { describe, expect, it } from "vitest";
import {
  backfillEntryGrams,
  deriveVariantsForStore,
  entryBaseFields,
  formatMacros,
  parseGramsSuffix,
  type PlanVariant,
  productToEntryFields,
  scaleMacros,
  scaledForStore,
  sumMacros,
  variantToEntryFields,
} from "./macros";

describe("scaleMacros — escalado por gramos (03-DATOS §3)", () => {
  const arroz = { kcal: 195, prot: 5, carb: 40, fat: 1 }; // base 150 g (plan)

  it("escala proporcionalmente por factor = gramos / base_g", () => {
    // 240 g → factor 1.6 → coincide con el export del PoC (Arroz · 240 g)
    const s = scaledForStore(arroz, 240, 150);
    expect(s).toEqual({ kcal: 312, prot: 8, carb: 64, fat: 1.6 });
  });

  it("escala hacia abajo (30 g de pan de merienda, base 60 g)", () => {
    const pan = { kcal: 160, prot: 5, carb: 31, fat: 1.2 };
    const s = scaledForStore(pan, 30, 60);
    expect(s).toEqual({ kcal: 80, prot: 2.5, carb: 15.5, fat: 0.6 });
  });

  it("base_g null (unidades fijas) → NO escala", () => {
    const huevos = { kcal: 280, prot: 25, carb: 2, fat: 20 };
    expect(scaleMacros(huevos, 999, null)).toEqual(huevos);
    expect(scaleMacros(huevos, 999, 0)).toEqual(huevos);
  });

  it("scaleMacros no redondea; scaledForStore sí (kcal entera, macros 1 decimal)", () => {
    const raw = scaleMacros(arroz, 100, 150); // factor 0.6667
    expect(raw.kcal).toBeCloseTo(130, 5);
    const stored = scaledForStore(arroz, 100, 150);
    expect(stored.kcal).toBe(130);
    expect(stored.prot).toBe(3.3); // 3.333 → 1 decimal
  });
});

describe("sumMacros / formatMacros", () => {
  it("suma sin redondear", () => {
    const total = sumMacros([
      { kcal: 100, prot: 2.5, carb: 10, fat: 1 },
      { kcal: 50, prot: 0.6, carb: 5, fat: 0.2 },
    ]);
    expect(total.kcal).toBe(150);
    expect(total.prot).toBeCloseTo(3.1, 5);
  });

  it("formatea macros en enteros compactos", () => {
    expect(formatMacros({ kcal: 231, prot: 46, carb: 0, fat: 5 })).toBe("46P/0C/5F");
    expect(formatMacros({ kcal: 130, prot: 3.3, carb: 26.6, fat: 0.6 })).toBe("3P/27C/1F");
  });
});

describe("F06 · gramos como dato de primera clase — reescalado desde base", () => {
  // Pan de merienda: base a 25 g (macros de la opción de plan).
  const base = { kcal: 67, prot: 2.2, carb: 12.5, fat: 0.5 };
  const baseG = 25;

  it("AC2 · reescalar 25→40→25 devuelve EXACTAMENTE las macros originales (sin deriva)", () => {
    const original = scaledForStore(base, 25, baseG);
    const at40 = scaledForStore(base, 40, baseG);
    // ida y vuelta: SIEMPRE desde la base inmutable, no desde at40
    const backTo25 = scaledForStore(base, 25, baseG);
    expect(at40).not.toEqual(original); // sí cambió al subir
    expect(backTo25).toEqual(original); // vuelve exacto
  });

  it("AC3 · un override manual NO afecta al siguiente reescalado (los gramos mandan)", () => {
    // El usuario reescala a 40 g…
    const at40 = scaledForStore(base, 40, baseG);
    // …luego pisa la proteína a mano (override en la UI). El reescalado siguiente
    // parte de la BASE, no del valor mostrado con el override → lo pisa.
    const overridden = { ...at40, prot: 999 };
    const rescaledTo30 = scaledForStore(base, 30, baseG);
    expect(rescaledTo30).toEqual(scaledForStore(base, 30, baseG));
    expect(rescaledTo30.prot).not.toBe(overridden.prot);
  });

  it("entryBaseFields persiste base+cantidad; baseG null → entrada fija (todo null)", () => {
    expect(entryBaseFields(base, 40, 25)).toEqual({
      grams: 40,
      baseG: 25,
      baseKcal: 67,
      baseProt: 2.2,
      baseCarb: 12.5,
      baseFat: 0.5,
    });
    expect(entryBaseFields(base, 40, null)).toEqual({
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    });
  });
});

describe("F06 · parseGramsSuffix (AC5) — parser conservador de «· NN g|ml»", () => {
  it("parsea «g», «ml», «gr», «gramos» al final y limpia el sufijo", () => {
    expect(parseGramsSuffix("Pan · 25 g")).toEqual({ grams: 25, cleanName: "Pan" });
    expect(parseGramsSuffix("Arroz · 240 g")).toEqual({ grams: 240, cleanName: "Arroz" });
    expect(parseGramsSuffix("Leche · 200 ml")).toEqual({ grams: 200, cleanName: "Leche" });
    expect(parseGramsSuffix("Avena · 50gr")).toEqual({ grams: 50, cleanName: "Avena" });
    expect(parseGramsSuffix("Pollo · 150 gramos")).toEqual({
      grams: 150,
      cleanName: "Pollo",
    });
  });

  it("redondea gramos decimales", () => {
    expect(parseGramsSuffix("Pan · 25,5 g")).toEqual({ grams: 26, cleanName: "Pan" });
  });

  it("es conservador: no matchea patrones ambiguos ni internos", () => {
    expect(parseGramsSuffix("4 huevos")).toBeNull();
    expect(parseGramsSuffix("Café con leche")).toBeNull();
    expect(parseGramsSuffix("Barrita 30 g proteica")).toBeNull(); // no al final
    expect(parseGramsSuffix("Batido 300 ml frío")).toBeNull(); // no al final
    expect(parseGramsSuffix("· 25 g")).toBeNull(); // nombre quedaría vacío
    expect(parseGramsSuffix("Zumo · 0 g")).toBeNull(); // cantidad no positiva
  });
});

describe("F06 · backfillEntryGrams (AC5/AC7)", () => {
  it("hace escalable una entrada «Pan · 25 g» sin perder macros y limpia el nombre", () => {
    expect(
      backfillEntryGrams({ name: "Pan · 25 g", kcal: 67, prot: 2.2, carb: 12.5, fat: 0.5 }),
    ).toEqual({
      name: "Pan",
      grams: 25,
      baseG: 25,
      baseKcal: 67,
      baseProt: 2.2,
      baseCarb: 12.5,
      baseFat: 0.5,
    });
  });

  it("AC7 · entrada sin patrón claro queda fija (base null) conservando nombre y macros", () => {
    expect(
      backfillEntryGrams({ name: "Café con leche", kcal: 70, prot: 6.4, carb: 9.5, fat: 0.4 }),
    ).toEqual({
      name: "Café con leche",
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    });
  });
});

describe("productToEntryFields — añadir un producto reescalando (F07)", () => {
  it("AC1 · producto con baseG reescala al añadirlo (80 g de un producto de 100 g = 0,8×)", () => {
    const tortitas = { baseG: 100, baseKcal: 310, baseProt: 8, baseCarb: 58, baseFat: 5 };
    expect(productToEntryFields(tortitas, 80)).toEqual({
      kcal: 248,
      prot: 6.4,
      carb: 46.4,
      fat: 4,
      grams: 80,
      baseG: 100,
      baseKcal: 310,
      baseProt: 8,
      baseCarb: 58,
      baseFat: 5,
    });
  });

  it("AC1 · a la base (100 g) devuelve las macros de la etiqueta intactas", () => {
    const tortitas = { baseG: 100, baseKcal: 310, baseProt: 8, baseCarb: 58, baseFat: 5 };
    const r = productToEntryFields(tortitas, 100);
    expect(r.kcal).toBe(310);
    expect(r.prot).toBe(8);
    expect(r.baseG).toBe(100);
  });

  it("AC2 · producto con baseG null se añade fijo (macros base, sin base → sin stepper)", () => {
    const cafe = { baseG: null, baseKcal: 18, baseProt: 0.6, baseCarb: 1, baseFat: 1 };
    expect(productToEntryFields(cafe, 999)).toEqual({
      kcal: 18,
      prot: 0.6,
      carb: 1,
      fat: 1,
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    });
  });
});

describe("variantes de opción (F08)", () => {
  // "Carne magra" 210 g en crudo: la variante elegida aporta sus macros a esos 210 g.
  const pavo: PlanVariant = { nombre: "Pavo", kcal: 225, prot: 47, carb: 0, fat: 4 };
  const cerdo: PlanVariant = { nombre: "Cerdo", kcal: 305, prot: 43, carb: 0, fat: 14 };

  it("elegir la variante guarda SUS macros a los gramos pautados (AC2)", () => {
    // A 210 g (= baseG) el factor es 1 → las macros de la variante, sin cambios.
    expect(variantToEntryFields(pavo, 210, 210)).toEqual({
      kcal: 225,
      prot: 47,
      carb: 0,
      fat: 4,
      grams: 210,
      baseG: 210,
      baseKcal: 225,
      baseProt: 47,
      baseCarb: 0,
      baseFat: 4,
    });
    // El swing pavo↔cerdo NO es ruido absorbible: cerdo pesa 80 kcal más (motivación F08).
    expect(variantToEntryFields(cerdo, 210, 210).kcal).toBe(305);
  });

  it("cambiar gramos escala DESDE la variante elegida (AC2 · F06)", () => {
    // 105 g (mitad) de pavo → factor 0.5 desde la base de la variante.
    const half = variantToEntryFields(pavo, 210, 105);
    expect(half.kcal).toBe(113); // 225 * 0.5 = 112.5 → 113
    expect(half.prot).toBe(23.5);
    expect(half.baseKcal).toBe(225); // base inmutable = la variante, no lo escalado
    // Ida y vuelta 210→105→210 devuelve exactamente las macros de la variante.
    expect(variantToEntryFields(pavo, 210, 210).kcal).toBe(225);
  });

  it("baseG null (variante por unidad/fija) → macros tal cual, sin base (AC4)", () => {
    expect(variantToEntryFields(pavo, null, 999)).toEqual({
      kcal: 225,
      prot: 47,
      carb: 0,
      fat: 4,
      grams: null,
      baseG: null,
      baseKcal: null,
      baseProt: null,
      baseCarb: null,
      baseFat: null,
    });
  });
});

describe("deriveVariantsForStore — plano = 1ª variante (F08 · import + editor)", () => {
  it("string→número, kcal entera; el plano toma la 1ª variante", () => {
    const { variants, flat } = deriveVariantsForStore([
      { nombre: " Pollo ", kcal: "225", prot: "47", carb: "0", fat: "4" },
      { nombre: "Cerdo", kcal: "305", prot: "43", carb: "0", fat: "14" },
    ]);
    expect(variants).toEqual([
      { nombre: "Pollo", kcal: 225, prot: 47, carb: 0, fat: 4 },
      { nombre: "Cerdo", kcal: 305, prot: 43, carb: 0, fat: 14 },
    ]);
    // Plano = 1ª variante (el default al registrar), NO la media.
    expect(flat).toEqual({ kcal: 225, prot: 47, carb: 0, fat: 4 });
  });

  it("descarta variantes de nombre vacío (añadida y no rellenada)", () => {
    const { variants, flat } = deriveVariantsForStore([
      { nombre: "Pavo", kcal: "225", prot: "47", carb: "0", fat: "4" },
      { nombre: "  ", kcal: "999", prot: "9", carb: "9", fat: "9" },
    ]);
    expect(variants).toHaveLength(1);
    expect(variants[0]?.nombre).toBe("Pavo");
    expect(flat?.kcal).toBe(225);
  });

  it("acepta decimal con coma en macros; kcal se redondea", () => {
    const { variants } = deriveVariantsForStore([
      { nombre: "Salmón", kcal: "312,6", prot: "31,4", carb: "0", fat: "20,2" },
    ]);
    expect(variants[0]).toEqual({
      nombre: "Salmón",
      kcal: 313,
      prot: 31.4,
      carb: 0,
      fat: 20.2,
    });
  });

  it("sin variantes válidas → flat null (el llamador usa sus macros planos)", () => {
    expect(deriveVariantsForStore([])).toEqual({ variants: [], flat: null });
    expect(
      deriveVariantsForStore([
        { nombre: "", kcal: "10", prot: "1", carb: "1", fat: "1" },
      ]),
    ).toEqual({ variants: [], flat: null });
  });
});
