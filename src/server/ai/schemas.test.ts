import { describe, expect, it } from "vitest";
import { dayDumpZ, labelReadZ } from "./schemas";

/*
  F06 Fase 2 (AC9): el schema de day-dump acepta `gramos` con cantidad o null (item
  sin ración estimable), y coerciona números emitidos como string. Nunca fuerza una
  cifra: null es válido y significa "entrada fija" en la UI.
*/
describe("dayDumpZ — gramos nullable (F06 Fase 2, AC9)", () => {
  it("acepta un item con gramos estimados y otro con gramos null", () => {
    const parsed = dayDumpZ.parse({
      items: [
        {
          comida: "cena",
          nombre: "Salmón a la plancha",
          gramos: 150,
          kcal: 290,
          proteina_g: 29,
          carbohidratos_g: 0,
          grasa_g: 19,
        },
        {
          comida: "cena",
          nombre: "Un puñado de nueces",
          gramos: null,
          kcal: 120,
          proteina_g: 3,
          carbohidratos_g: 2,
          grasa_g: 11,
        },
      ],
    });
    expect(parsed.items[0]?.gramos).toBe(150);
    expect(parsed.items[1]?.gramos).toBeNull();
  });

  it("coerciona gramos emitido como string", () => {
    const parsed = dayDumpZ.parse({
      items: [
        {
          comida: "comida",
          nombre: "Arroz",
          gramos: "120",
          kcal: "156",
          proteina_g: 4,
          carbohidratos_g: 32,
          grasa_g: 1,
        },
      ],
    });
    expect(parsed.items[0]?.gramos).toBe(120);
  });
});

/*
  F-IA-11 (F07 Fase 2): lectura de etiqueta. base_g/macros nullable (null donde el
  dato NO figura → no se inventa); coerciona números emitidos como string.
*/
describe("labelReadZ — lectura de etiqueta (F-IA-11)", () => {
  it("acepta una etiqueta por 100 g completa", () => {
    const r = labelReadZ.parse({
      nombre: "Tortitas integrales Hacendado",
      base_g: 100,
      kcal: 350,
      proteina_g: 12,
      carbohidratos_g: 60,
      grasa_g: 6.5,
      grupo: "Hidratos",
    });
    expect(r.base_g).toBe(100);
    expect(r.kcal).toBe(350);
    expect(r.grupo).toBe("Hidratos");
  });

  it("acepta null donde el dato no figura (por unidad sin peso, sin fibra…)", () => {
    const r = labelReadZ.parse({
      nombre: "Barrita X",
      base_g: null,
      kcal: 90,
      proteina_g: null,
      carbohidratos_g: 10,
      grasa_g: null,
      grupo: "Otros",
    });
    expect(r.base_g).toBeNull();
    expect(r.proteina_g).toBeNull();
    expect(r.grasa_g).toBeNull();
    expect(r.kcal).toBe(90);
  });

  it("coerciona valores emitidos como string", () => {
    const r = labelReadZ.parse({
      nombre: "Pan",
      base_g: "100",
      kcal: "250",
      proteina_g: "9",
      carbohidratos_g: "48",
      grasa_g: "3",
      grupo: "Hidratos",
    });
    expect(r.base_g).toBe(100);
    expect(r.kcal).toBe(250);
  });
});
