import { describe, expect, it } from "vitest";
import { scaleMacros } from "@/lib/macros";
import { estimateZ, photoResultZ, wodZ } from "./schemas";

/*
  La salida estructurada nativa (Output.object) valida contra estos schemas Zod,
  así que aquí probamos el contrato: qué acepta, qué rechaza y la coerción de
  números (la IA a veces emite "12" como string).
*/

describe("schemas de IA — contrato de validación (04-IA)", () => {
  it("estimateZ acepta JSON válido de F-IA-2", () => {
    const r = estimateZ.safeParse({
      kcal: 88,
      proteina_g: 6.5,
      carbohidratos_g: 9,
      grasa_g: 3,
    });
    expect(r.success).toBe(true);
  });

  it("estimateZ coerciona números emitidos como string", () => {
    const r = estimateZ.safeParse({
      kcal: "120",
      proteina_g: "8",
      carbohidratos_g: "10",
      grasa_g: "4",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kcal).toBe(120);
  });

  it("estimateZ rechaza si falta un campo obligatorio", () => {
    expect(estimateZ.safeParse({ kcal: 10 }).success).toBe(false);
  });

  it("photoResultZ valida el desglose anidado de F-IA-1", () => {
    const r = photoResultZ.safeParse({
      items: [
        { nombre: "Arroz", gramos: 150, kcal: 195, proteina_g: 5, carbohidratos_g: 40, grasa_g: 1 },
      ],
      encaja_plan: true,
      comentario: "Encaja",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items).toHaveLength(1);
  });

  it("wodZ valida el rango de gasto de F-IA-5", () => {
    const r = wodZ.safeParse({
      nombre: "Halterofilia + WOD",
      duracion_min: 90,
      kcal_min: 500,
      kcal_max: 700,
      comentario: "Sesión dura",
    });
    expect(r.success).toBe(true);
  });
});

describe("recálculo proporcional del desglose de foto (F-IA-1, sin red)", () => {
  // El input de gramos se ancla a `_base` inmutable; factor = g / baseG.
  const base = { kcal: 90, prot: 6, carb: 9, fat: 3 };
  it("recalcula al editar los gramos sin volver a llamar a la IA", () => {
    const s = scaleMacros(base, 300, 200); // baseG 200 g → factor 1.5
    expect(s.kcal).toBeCloseTo(135);
    expect(s.prot).toBeCloseTo(9);
  });
  it("al vaciar los gramos (0) da 0 pero el ancla se conserva", () => {
    expect(scaleMacros(base, 0, 200).kcal).toBe(0);
    // el _base no se muta: re-escalar a 200 recupera el original
    expect(scaleMacros(base, 200, 200)).toEqual(base);
  });
});
