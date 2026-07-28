import { describe, expect, it } from "vitest";
import {
  sanitizeThreadTitle,
  threadTitleFrom,
  TITLE_MAX_OUTPUT_TOKENS,
} from "./chat-title";

describe("TITLE_MAX_OUTPUT_TOKENS · presupuesto de la llamada IA", () => {
  // Regresión (2026-07-27): estaba a 32 tokens y, como el thinking de Gemini 3.x
  // sale de maxOutputTokens, el título salía cortado ("An", "Men") o vacío. La
  // lección compartida con plan-option/estimate/wod: 500 no basta ni a thinking
  // "low". El techo debe quedar holgado por encima de ese umbral demostrado malo.
  it("supera con margen el umbral que ya se demostró insuficiente (500)", () => {
    expect(TITLE_MAX_OUTPUT_TOKENS).toBeGreaterThan(500);
  });
});

/*
  F12 · Títulos de hilo. threadTitleFrom (fallback determinista) y sanitizeThreadTitle
  (saneado de la salida IA a 4-6 palabras). La generación IA en sí la valida Alex en
  vivo (AC7 · el título es cosmético); aquí se fija el saneado y el fallback.
*/

describe("threadTitleFrom · recorte determinista (fallback)", () => {
  it("toma la primera frase, quita signos de apertura y limita a 8 palabras", () => {
    expect(threadTitleFrom("¿Cómo cierro bien el día de hoy con lo que llevo comido?")).toBe(
      "Cómo cierro bien el día de hoy con",
    );
  });

  it("vacío → «Nuevo hilo»", () => {
    expect(threadTitleFrom("   ")).toBe("Nuevo hilo");
  });
});

describe("sanitizeThreadTitle · saneado de la salida IA (AC7)", () => {
  it("recorta a 6 palabras y quita comillas/puntuación envolvente", () => {
    expect(sanitizeThreadTitle('"Reparto de macros para la cena de hoy."')).toBe(
      "Reparto de macros para la cena",
    );
  });

  it("toma la primera línea no vacía y colapsa espacios", () => {
    expect(sanitizeThreadTitle("\n\n  Macros   del  gazpacho  Lidl  \nnota extra")).toBe(
      "Macros del gazpacho Lidl",
    );
  });

  it("quita markdown envolvente (** _ « »)", () => {
    expect(sanitizeThreadTitle("**Cómo va mi semana**")).toBe("Cómo va mi semana");
    expect(sanitizeThreadTitle("«Compara mis dos cargas»")).toBe("Compara mis dos cargas");
  });

  it("vacío o solo puntuación → «» (el caller cae al fallback determinista)", () => {
    expect(sanitizeThreadTitle("")).toBe("");
    expect(sanitizeThreadTitle('"..."')).toBe("");
  });
});
