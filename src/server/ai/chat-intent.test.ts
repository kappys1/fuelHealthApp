import { describe, expect, it } from "vitest";
import {
  anyTrainingAdaptationIntent,
  detectTrainingAdaptationIntent,
} from "./chat-intent";

/*
  F21 · AC9 — la detección de intención de entreno/adaptación es pura y testeada.
  Recall generoso (spec F21): mejor un falso positivo barato que un falso negativo
  en «léeme la sesión». La casa: todo caso de comportamiento acaba en caso canónico.
*/
describe("detectTrainingAdaptationIntent · dispara (AC1/AC2/AC3)", () => {
  const fires = [
    // AC1 · leer la sesión de hoy
    "¿Puedes leer mi sesión de hoy?",
    "léeme el entreno de hoy",
    "¿qué ejercicios tengo hoy?",
    "enséñame el WOD de hoy",
    "¿qué rutina toca hoy?",
    // AC2 · adaptar por una molestia/lesión
    "Me duele el hombro, adáptame hoy",
    "tengo una molestia en la rodilla",
    "me he lesionado el codo",
    "arrastro dolor de espalda, ¿cómo entreno?",
    "tengo tendinitis, ¿qué hago?",
    "una contractura en el cuello lumbar",
    "sobrecarga de isquios",
    // AC3 · descansar un grupo / equilibrio de la semana
    "esta semana quiero descansar el hombro",
    "quiero descansar la pierna hoy",
    // verbos de adaptación y trabajo alternativo
    "¿me sustituyes el press por otra cosa?",
    "¿puedo escalar el movimiento?",
    "dame ejercicios de movilidad",
    "necesito estiramientos para la cadera",
    "algo de cardio que no cargue la muñeca",
    "trabajo antagonista para hoy",
    // sin acentos / mayúsculas
    "adaptame el entreno del hombro",
    "ME DUELE LA RODILLA",
  ];

  for (const message of fires) {
    it(`dispara: "${message}"`, () => {
      expect(detectTrainingAdaptationIntent(message)).toBe(true);
    });
  }
});

describe("detectTrainingAdaptationIntent · NO dispara (AC8)", () => {
  const doesNotFire = [
    // Turnos de comida / nutrición: no debe inyectar contenido de sesiones
    "¿qué meriendo con lo que me queda?",
    "¿cuántas kcal tiene el gazpacho?",
    "¿cómo voy de proteína hoy?",
    "proyecta el día si ceno pavo",
    "¿me paso de kcal si añado arroz?",
    "¿qué tal mi adherencia esta semana?",
    "guárdame este producto en Mis productos",
    "¿cuánto he perdido de grasa según la última MED?",
    // turno vacío (solo-foto)
    "",
    "   ",
  ];

  for (const message of doesNotFire) {
    it(`no dispara: "${message}"`, () => {
      expect(detectTrainingAdaptationIntent(message)).toBe(false);
    });
  }
});

describe("anyTrainingAdaptationIntent · sticky en la ventana (AC4, caso 29-jul)", () => {
  it("sigue disparando en seguimientos SIN palabras clave si la ventana ya iba de entreno", () => {
    // Repro del bug real: la conversación empieza de entreno; los turnos de
    // seguimiento pierden las keywords pero deben mantener el contexto de la sesión.
    const windowUserTexts = [
      "me duele el hombro, adáptame hoy", // dispara
      "no, tú lo tienes y quiero que decidamos juntos qué cambiar", // sin keyword
      "y luego me vuelcas toda la semana", // sin keyword
    ];
    expect(anyTrainingAdaptationIntent(windowUserTexts)).toBe(true);
  });

  it("una ventana solo de comida NO dispara (AC8)", () => {
    const windowUserTexts = [
      "¿qué ceno hoy con lo que me queda?",
      "¿y si añado arroz me paso de kcal?",
      "vale, gracias",
    ];
    expect(anyTrainingAdaptationIntent(windowUserTexts)).toBe(false);
  });

  it("ventana vacía → false", () => {
    expect(anyTrainingAdaptationIntent([])).toBe(false);
  });
});
