import { describe, expect, it } from "vitest";
import { shouldOfferAdaptedSave } from "./chat-adapt-action";

const user = (content: string) => ({ role: "user" as const, content });
const bot = (content: string) => ({ role: "assistant" as const, content });
const quiet = { streaming: false };

describe("F26 Fase 3 · cuándo pinta la app «Guardar como sesión adaptada»", () => {
  it("tras pedir adaptar el entreno, bajo la respuesta (AC14)", () => {
    expect(
      shouldOfferAdaptedSave(
        [user("me duele el hombro, adáptame el entreno de hoy"), bot("Puedes cambiar…")],
        quiet,
      ),
    ).toBe(true);
  });

  it("sobrevive a un seguimiento sin palabras clave (intención sticky)", () => {
    expect(
      shouldOfferAdaptedSave(
        [
          user("adáptame la sesión de hoy por el hombro"),
          bot("Propuesta A"),
          user("mejor con remo"),
          bot("Propuesta B"),
        ],
        quiet,
      ),
    ).toBe(true);
  });

  it("si la conversación se va a otro tema, el botón desaparece solo", () => {
    expect(
      shouldOfferAdaptedSave(
        [
          user("adáptame la sesión por el hombro"),
          bot("Propuesta"),
          user("¿qué meriendo con lo que me queda?"),
          bot("Un yogur…"),
          user("¿y de cena?"),
          bot("Pollo…"),
          user("¿cuántas kcal llevo?"),
          bot("1.800"),
        ],
        quiet,
      ),
    ).toBe(false);
  });

  it("un turno de comida nunca lo pinta (AC16: no dispara lo que no toca)", () => {
    expect(
      shouldOfferAdaptedSave([user("¿qué ceno hoy?"), bot("Salmón…")], quiet),
    ).toBe(false);
  });

  it("no aparece mientras la respuesta se está escribiendo", () => {
    const msgs = [user("adáptame el entreno"), bot("Puedes…")];
    expect(shouldOfferAdaptedSave(msgs, { streaming: true })).toBe(false);
  });

  it("no aparece si el último mensaje es de Alex (aún no hay respuesta)", () => {
    expect(shouldOfferAdaptedSave([user("adáptame el entreno")], quiet)).toBe(false);
  });

  it("hilo vacío: nada que ofrecer", () => {
    expect(shouldOfferAdaptedSave([], quiet)).toBe(false);
  });
});
