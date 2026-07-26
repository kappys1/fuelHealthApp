import { describe, expect, it } from "vitest";
import {
  normalizeTrainingSettings,
  settingsArrayToRecord,
} from "./settings-map";

const legacy = {
  "1": "T1",
  "2": "Descanso",
  "3": "T3",
  "4": "",
  "5": "T5",
  "6": "Competición",
  "7": "Descanso",
};

describe("normalizeTrainingSettings — migración F20", () => {
  it("convierte el patrón antiguo sin perder días de entreno y pide revisión", () => {
    const normalized = settingsArrayToRecord(
      normalizeTrainingSettings([
        { key: "sessionByWeekday", value: legacy },
        { key: "chatWebSearch", value: false },
      ]),
    );

    expect(normalized.trainingByWeekday).toEqual({
      "1": "tarde",
      "2": "descanso",
      "3": "tarde",
      "4": "descanso",
      "5": "tarde",
      "6": "tarde",
      "7": "descanso",
    });
    expect(normalized.trainingByWeekdayReviewed).toBe(false);
    expect(normalized.sessionByWeekday).toEqual(legacy);
    expect(normalized.chatWebSearch).toBe(false);
  });

  it("es idempotente y no pisa un patrón canónico ya revisado", () => {
    const rows = [
      {
        key: "trainingByWeekday",
        value: {
          "1": "tarde",
          "2": "tarde",
          "3": "descanso",
          "4": "mañana",
          "5": "tarde",
          "6": "mañana",
          "7": "descanso",
        },
      },
      { key: "trainingByWeekdayReviewed", value: true },
    ];

    const once = normalizeTrainingSettings(rows);
    const twice = normalizeTrainingSettings(once);
    expect(twice).toEqual(once);
    expect(settingsArrayToRecord(twice).trainingByWeekdayReviewed).toBe(true);
    expect(settingsArrayToRecord(twice).trainingByWeekday).toEqual(rows[0]!.value);
  });

  it("acepta un backup F20 y sintetiza la clave legacy mientras siga activa la Fase 0", () => {
    const normalized = settingsArrayToRecord(
      normalizeTrainingSettings([
        {
          key: "trainingByWeekday",
          value: {
            "1": "tarde",
            "2": "tarde",
            "3": "tarde",
            "4": "tarde",
            "5": "tarde",
            "6": "mañana",
            "7": "descanso",
          },
        },
        { key: "trainingByWeekdayReviewed", value: true },
      ]),
    );

    expect(normalized.sessionByWeekday).toMatchObject({
      "1": expect.not.stringMatching(/^descanso$/i),
      "6": expect.not.stringMatching(/^descanso$/i),
      "7": "Descanso",
    });
  });
});
