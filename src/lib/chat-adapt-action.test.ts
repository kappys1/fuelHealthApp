import { describe, expect, it } from "vitest";
import {
  adaptMotiveFromChat,
  shouldOfferAdaptedSave,
} from "./chat-adapt-action";

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

/*
  El motivo con el que se abre la hoja son LAS PALABRAS DE ALEX, no un resumen de
  la IA ni una etiqueta genérica: es lo que va a leer el generador y lo que Alex
  puede corregir si el agente le entendió mal (DECISIONS #101).
*/
describe("F26 Fase 3 · motivo con el que se abre el editor", () => {
  it("usa el último mensaje de Alex que hablaba de la limitación", () => {
    expect(
      adaptMotiveFromChat([
        user("¿qué entreno tengo hoy?"),
        bot("Rope climbs, remo…"),
        user("me sigue limitando el hombro derecho, adáptame la sesión"),
        bot("Puedes cambiar…"),
      ]),
    ).toBe("me sigue limitando el hombro derecho, adáptame la sesión");
  });

  it("ignora los seguimientos que no dicen nada de la limitación", () => {
    expect(
      adaptMotiveFromChat([
        user("me duele el hombro, adapta la sesión"),
        bot("Propuesta A"),
        user("vale"),
        bot("Perfecto"),
      ]),
    ).toBe("me duele el hombro, adapta la sesión");
  });

  it("recorta al límite del campo del endpoint (300)", () => {
    const largo = `me duele el hombro ${"y ".repeat(400)}`;
    expect(adaptMotiveFromChat([user(largo), bot("ok")]).length).toBe(300);
  });

  it("sin nada que disparara, devuelve vacío (Alex lo escribe)", () => {
    expect(adaptMotiveFromChat([user("¿qué ceno?"), bot("Salmón")])).toBe("");
  });
});
