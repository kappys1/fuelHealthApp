import { describe, expect, it } from "vitest";
import { dietImportZ, dayDumpZ, labelReadZ, photoResultZ } from "./schemas";

describe("photoResultZ — comparación solo con pauta real", () => {
  it("acepta encaja_plan null cuando no existe una pauta", () => {
    const result = photoResultZ.parse({
      items: [
        {
          nombre: "Tortilla francesa",
          gramos: 180,
          kcal: 280,
          proteina_g: 22,
          carbohidratos_g: 2,
          grasa_g: 20,
        },
      ],
      encaja_plan: null,
      comentario: "Estimación visual de la ración.",
    });

    expect(result.encaja_plan).toBeNull();
  });
});

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
  F-IA-9 · F08 (AC1): el schema del importador acepta `variantes` por opción (una
  entrada por alimento intercambiable), las coerciona, y por defecto es lista vacía
  cuando la opción NO las trae (opción normal / forma de cocinado). Nunca se inventa
  una variante: ausencia == [].
*/
describe("dietImportZ — variantes de opción (F08, AC1)", () => {
  it("«carne magra» llega con 4 variantes; «verdura» sin variantes → []", () => {
    const r = dietImportZ.parse({
      kcal_totales: 1800,
      proteina_total: 110,
      comidas: [
        {
          comida: "comida",
          opciones: [
            {
              nombre: "Carne magra (pollo/pavo/ternera/cerdo)",
              grupo: "Proteína",
              gramos: 210,
              kcal: 231,
              proteina_g: 46,
              carbohidratos_g: 0,
              grasa_g: 5,
              variantes: [
                { nombre: "Pollo", kcal: 231, proteina_g: 46, carbohidratos_g: 0, grasa_g: 5 },
                { nombre: "Pavo", kcal: 225, proteina_g: 47, carbohidratos_g: 0, grasa_g: 4 },
                { nombre: "Ternera", kcal: 260, proteina_g: 44, carbohidratos_g: 0, grasa_g: 9 },
                { nombre: "Cerdo", kcal: 305, proteina_g: 43, carbohidratos_g: 0, grasa_g: 14 },
              ],
            },
            {
              // Forma de cocinado, NO variantes (queda como opción normal).
              nombre: "Verdura (vapor/plancha/ensalada)",
              grupo: "Verdura",
              gramos: 200,
              kcal: 60,
              proteina_g: 3,
              carbohidratos_g: 8,
              grasa_g: 1,
              variantes: [],
            },
          ],
        },
      ],
    });
    const carne = r.comidas[0]?.opciones[0];
    const verdura = r.comidas[0]?.opciones[1];
    expect(carne?.variantes).toHaveLength(4);
    expect(carne?.variantes[3]).toEqual({
      nombre: "Cerdo",
      kcal: 305,
      proteina_g: 43,
      carbohidratos_g: 0,
      grasa_g: 14,
    });
    expect(verdura?.variantes).toEqual([]);
  });

  it("una opción SIN el campo `variantes` → default [] (sin inventar)", () => {
    const r = dietImportZ.parse({
      kcal_totales: null,
      proteina_total: null,
      comidas: [
        {
          comida: "cena",
          opciones: [
            {
              nombre: "Tortilla francesa",
              grupo: "Proteína",
              gramos: null,
              kcal: 220,
              proteina_g: 18,
              carbohidratos_g: 1,
              grasa_g: 16,
            },
          ],
        },
      ],
    });
    expect(r.comidas[0]?.opciones[0]?.variantes).toEqual([]);
  });

  it("coerciona macros de variante emitidas como string", () => {
    const r = dietImportZ.parse({
      kcal_totales: null,
      proteina_total: null,
      comidas: [
        {
          comida: "comida",
          opciones: [
            {
              nombre: "Hidrato (arroz/quinoa/patata)",
              grupo: "Hidratos",
              gramos: "150",
              kcal: "195",
              proteina_g: "5",
              carbohidratos_g: "40",
              grasa_g: "1",
              variantes: [
                { nombre: "Arroz", kcal: "195", proteina_g: "5", carbohidratos_g: "40", grasa_g: "1" },
              ],
            },
          ],
        },
      ],
    });
    expect(r.comidas[0]?.opciones[0]?.variantes[0]?.kcal).toBe(195);
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
