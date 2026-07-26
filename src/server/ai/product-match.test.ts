import { describe, expect, it } from "vitest";
import {
  planOptionAiZ,
  type DayDumpItem,
  type PlanOptionAiResult,
} from "@/server/ai/schemas";
import type { ProductDTO } from "@/server/db/queries/lookups";
import {
  applyPlanOptionProductMatch,
  applyProductMatches,
} from "./product-match";

/*
  F18 · applyProductMatches: lógica pura del match de «Mis productos» sobre el
  volcado del día. Los AC1/AC4 son la red de regresión determinista (lección 3:
  "todo arreglo IA termina en caso canónico"). AC1 = caso real 26-jul (Lidl).
*/

// Item base del modelo (macros que el servidor SOBRESCRIBE cuando hay match).
const item = (over: Partial<DayDumpItem> = {}): DayDumpItem => ({
  comida: "extra",
  nombre: "café con leche de almendra",
  gramos: null,
  producto: null,
  kcal: 24,
  proteina_g: 1,
  carbohidratos_g: 2,
  grasa_g: 1,
  ...over,
});

// Producto escalable (etiqueta): Bebida de almendras Lidl 0% (250 g = 40 kcal).
const almendra: ProductDTO = {
  id: 1,
  name: "Bebida de almendras Lidl 0%",
  baseG: 250,
  baseKcal: 40,
  baseProt: 1.8,
  baseCarb: 0,
  baseFat: 3.5,
  grupo: null,
  source: "etiqueta",
  unit: "ml",
  pinned: false,
};

// Producto fijo (baseG null): macros por unidad, no se escala.
const huevo: ProductDTO = {
  id: 2,
  name: "Huevo XL",
  baseG: null,
  baseKcal: 80,
  baseProt: 7,
  baseCarb: 0.5,
  baseFat: 5.5,
  grupo: "Proteína",
  source: "manual",
  unit: "ud",
  pinned: false,
};

// Primer (y único) item resultante; falla explícito si la función no devuelve nada.
const one = (items: readonly DayDumpItem[], products: readonly ProductDTO[]): DayDumpItem => {
  const [out] = applyProductMatches(items, products);
  if (!out) throw new Error("applyProductMatches no devolvió items");
  return out;
};

describe("F18 · applyProductMatches (caso Lidl 26-jul, AC1)", () => {
  it("AC1: baseG + gramos → reescala desde la base guardada (no la estimación genérica)", () => {
    const out = one(
      [item({ nombre: "Café con leche de almendras", producto: "Bebida de almendras Lidl 0%", gramos: 200 })],
      [almendra],
    );
    // Nombre CONSERVADO (la preparación descrita); el canónico va en `producto` (#82).
    expect(out.nombre).toBe("Café con leche de almendras");
    expect(out.producto).toBe("Bebida de almendras Lidl 0%");
    // 200/250 = 0,8 sobre la base 40/1,8/0/3,5 (NO los 24 kcal genéricos del modelo).
    expect(out.gramos).toBe(200);
    expect(out.kcal).toBe(32);
    expect(out.proteina_g).toBe(1.4); // 1,8 × 0,8 = 1,44 → 1,4
    expect(out.carbohidratos_g).toBe(0);
    expect(out.grasa_g).toBe(2.8); // 3,5 × 0,8
    expect(out.kcal).not.toBe(24);
  });

  it("baseG sin gramos → ración base (gramos = baseG, macros = base)", () => {
    const out = one([item({ producto: "Bebida de almendras Lidl 0%", gramos: null })], [almendra]);
    expect(out.gramos).toBe(250);
    expect(out.kcal).toBe(40);
    expect(out.proteina_g).toBe(1.8);
    expect(out.grasa_g).toBe(3.5);
  });

  it("AC4: producto fijo (baseG null) → macros base y gramos null (sin stepper)", () => {
    const out = one([item({ nombre: "un huevo", producto: "Huevo XL", gramos: 60 })], [huevo]);
    // Nombre conservado; el canónico va en `producto`.
    expect(out.nombre).toBe("un huevo");
    expect(out.producto).toBe("Huevo XL");
    expect(out.gramos).toBeNull();
    expect(out.kcal).toBe(80);
    expect(out.proteina_g).toBe(7);
    expect(out.grasa_g).toBe(5.5);
  });

  it("match por nombre EXACTO tolerante a mayúsculas/espacios (trim + case-insensitive)", () => {
    const out = one(
      [item({ nombre: "leche de almendras", producto: "  bebida de almendras lidl 0%  ", gramos: 250 })],
      [almendra],
    );
    // Empareja pese a mayúsculas/espacios; nombre del item conservado.
    expect(out.nombre).toBe("leche de almendras");
    expect(out.producto).toBe("Bebida de almendras Lidl 0%");
    expect(out.kcal).toBe(40);
  });

  it("AC2: item sin producto identificado (null) → queda tal como lo estimó el modelo", () => {
    const out = one([item({ nombre: "tostada", producto: null })], [almendra]);
    expect(out.nombre).toBe("tostada");
    expect(out.kcal).toBe(24);
    expect(out.producto).toBeNull();
  });

  it("AC5: producto devuelto que NO existe en el catálogo (inexacto) → se ignora", () => {
    // Falta "0%": no es el nombre exacto → sin match forzado.
    const out = one([item({ producto: "Bebida de almendras Lidl", gramos: 250 })], [almendra]);
    expect(out.nombre).toBe("café con leche de almendra");
    expect(out.kcal).toBe(24);
  });

  it("AC3 (lógica): catálogo vacío → todos los items intactos", () => {
    const out = one([item({ producto: "Bebida de almendras Lidl 0%", gramos: 200 })], []);
    expect(out.nombre).toBe("café con leche de almendra");
    expect(out.kcal).toBe(24);
  });

  it("empareja unos items y deja otros: no contamina los no coincidentes", () => {
    const out = applyProductMatches(
      [
        item({ producto: "Bebida de almendras Lidl 0%", gramos: 250 }),
        item({ nombre: "plátano", producto: null, kcal: 90 }),
      ],
      [almendra],
    );
    expect(out[0]?.kcal).toBe(40);
    expect(out[1]?.nombre).toBe("plátano");
    expect(out[1]?.kcal).toBe(90);
  });
});

const planOption = (
  over: Partial<PlanOptionAiResult> = {},
): PlanOptionAiResult => ({
  producto: null,
  kcal: 32,
  proteina_g: 1,
  carbohidratos_g: 1,
  grasa_g: 3,
  grupo: "Otros",
  ...over,
});

describe("F19 Fase 1 · applyPlanOptionProductMatch", () => {
  it("planOptionAiZ acepta producto y degrada a null si el modelo lo omite", () => {
    expect(planOptionAiZ.parse(planOption()).producto).toBeNull();
    expect(
      planOptionAiZ.parse({
        kcal: 32,
        proteina_g: 1,
        carbohidratos_g: 1,
        grasa_g: 3,
        grupo: "Otros",
      }).producto,
    ).toBeNull();
  });

  it("AC1: baseG + gramos del body → escala desde la base guardada", () => {
    const product: ProductDTO = {
      ...almendra,
      baseG: 100,
      baseKcal: 16,
      baseProt: 0.72,
      baseCarb: 0,
      baseFat: 1.4,
      grupo: "Otros",
    };
    const out = applyPlanOptionProductMatch(
      planOption({ producto: "Bebida de almendras Lidl 0%" }),
      250,
      [product],
    );

    expect(out.producto).toBe("Bebida de almendras Lidl 0%");
    expect(out.kcal).toBe(40);
    expect(out.proteina_g).toBe(1.8);
    expect(out.carbohidratos_g).toBe(0);
    expect(out.grasa_g).toBe(3.5);
    expect(out.grupo).toBe("Otros");
    expect(out.kcal).not.toBe(32);
  });

  it("baseG sin gramos del body → usa la ración base", () => {
    const out = applyPlanOptionProductMatch(
      planOption({ producto: almendra.name }),
      null,
      [almendra],
    );

    expect(out.kcal).toBe(40);
    expect(out.proteina_g).toBe(1.8);
    expect(out.grasa_g).toBe(3.5);
  });

  it("AC4: producto fijo (baseG null) → usa sus macros base tal cual", () => {
    const out = applyPlanOptionProductMatch(
      planOption({ producto: huevo.name }),
      250,
      [huevo],
    );

    expect(out.kcal).toBe(80);
    expect(out.proteina_g).toBe(7);
    expect(out.carbohidratos_g).toBe(0.5);
    expect(out.grasa_g).toBe(5.5);
    expect(out.grupo).toBe("Proteína");
  });

  it("AC2: producto null → conserva íntegra la estimación del modelo", () => {
    const estimated = planOption({ producto: null, grupo: "Verdura" });
    expect(applyPlanOptionProductMatch(estimated, 250, [almendra])).toEqual(
      estimated,
    );
  });

  it("AC5: nombre canónico inexacto → no empareja ni sobrescribe", () => {
    const estimated = planOption({
      producto: "Bebida de almendras Lidl",
      grupo: "Otros",
    });
    expect(applyPlanOptionProductMatch(estimated, 250, [almendra])).toEqual(
      estimated,
    );
  });

  it("AC6: producto con grupo null conserva el grupo estimado por el modelo", () => {
    const out = applyPlanOptionProductMatch(
      planOption({ producto: almendra.name, grupo: "Otros" }),
      250,
      [almendra],
    );
    expect(out.grupo).toBe("Otros");
  });
});
