import { describe, expect, it } from "vitest";
import {
  isExplicitSaveConfirmation,
  parseProductOffer,
  planConfirmedProductSave,
} from "./product-save";

/*
  F12 Fase 2 · Confirmación determinista del guardado de producto. Estas son las
  piezas PURAS (parseo + detección de confirmación + combinación); la escritura real
  (saveConfirmedProduct) la valida Alex en vivo (AC5 🖐 · principio 7: sin tests de
  escritura contra Neon). Cada caso entra con su opuesto (AC10).
*/

describe("parseProductOffer · extrae la ficha exacta del turno de oferta", () => {
  it("parsea la línea-ficha canónica (caso Lidl: 100 ml · 37 kcal · 0,6P/3C/2F)", () => {
    const text =
      "Apunto esto:\nProducto: Gazpacho Lidl · 100 ml · 37 kcal · 0,6P · 3C · 2F\n¿Te lo guardo en Mis productos?";
    const ficha = parseProductOffer(text);
    expect(ficha).toEqual({
      name: "Gazpacho Lidl",
      baseG: 100,
      unit: "ml",
      kcal: 37,
      prot: 0.6,
      carb: 3,
      fat: 2,
    });
  });

  it("tolera espacios variables, coma decimal y unidad en gramos", () => {
    const ficha = parseProductOffer(
      "Producto: Tortitas Hacendado·30 g·118 kcal·3,2P·20,5C·1,8F",
    );
    expect(ficha?.name).toBe("Tortitas Hacendado");
    expect(ficha?.baseG).toBe(30);
    expect(ficha?.unit).toBe("g");
    expect(ficha?.prot).toBeCloseTo(3.2);
    expect(ficha?.carb).toBeCloseTo(20.5);
  });

  it("null si el mensaje no lleva la línea-ficha (fallo seguro: no se guarda)", () => {
    expect(parseProductOffer("El gazpacho ronda las 37 kcal por 100 ml.")).toBeNull();
    expect(parseProductOffer("")).toBeNull();
    expect(parseProductOffer(null)).toBeNull();
  });
});

describe("isExplicitSaveConfirmation · confirmación explícita, opuestos incluidos", () => {
  it("afirmaciones inequívocas → true", () => {
    for (const t of [
      "sí",
      "si",
      "vale",
      "ok",
      "dale",
      "sí, guárdalo",
      "guárdalo",
      "guárdamelo porfa",
      "hazlo",
      "sí porfa",
      "vale gracias",
    ]) {
      expect(isExplicitSaveConfirmation(t), t).toBe(true);
    }
  });

  it("negación, aplazamiento o petición de cambio → false (opuesto canónico)", () => {
    for (const t of [
      "no",
      "no, déjalo",
      "espera",
      "todavía no",
      "mejor no",
      "sí pero cambia la proteína",
      "corrige el carbohidrato",
      "antes dime si lleva pepino",
      "¿es light?",
      "sí es light", // afirmación no-completa: no confirma guardar
      "",
    ]) {
      expect(isExplicitSaveConfirmation(t), t).toBe(false);
    }
  });
});

describe("planConfirmedProductSave · oferta + confirmación (AC4/AC5)", () => {
  const offer =
    "Producto: Gazpacho Lidl · 100 ml · 37 kcal · 0,6P · 3C · 2F\n¿Te lo guardo en Mis productos?";

  it("AC5: oferta previa + «sí» inmediatamente después → devuelve la ficha exacta", () => {
    const ficha = planConfirmedProductSave({
      lastAssistant: offer,
      currentUser: "sí, guárdalo",
    });
    expect(ficha?.name).toBe("Gazpacho Lidl");
    expect(ficha?.kcal).toBe(37);
  });

  it("AC4: oferta previa SIN confirmación explícita → no guarda (null)", () => {
    expect(
      planConfirmedProductSave({ lastAssistant: offer, currentUser: "¿y sin pepino?" }),
    ).toBeNull();
    expect(
      planConfirmedProductSave({ lastAssistant: offer, currentUser: "no, mejor no" }),
    ).toBeNull();
  });

  it("confirmación sin oferta previa parseable → no guarda (null)", () => {
    expect(
      planConfirmedProductSave({
        lastAssistant: "Vas bien de proteína hoy.",
        currentUser: "sí, guárdalo",
      }),
    ).toBeNull();
  });
});
