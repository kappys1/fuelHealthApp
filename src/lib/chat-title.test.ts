import { describe, expect, it } from "vitest";
import { sanitizeThreadTitle, threadTitleFrom } from "./chat-title";

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
