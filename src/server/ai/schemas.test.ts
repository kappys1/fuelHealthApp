import { describe, expect, it } from "vitest";
import { dayDumpZ } from "./schemas";

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
