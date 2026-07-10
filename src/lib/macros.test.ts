import { describe, expect, it } from "vitest";
import {
  formatMacros,
  scaleMacros,
  scaledForStore,
  sumMacros,
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
