import { describe, expect, it } from "vitest";
import type { Lesion } from "@/lib/profile";
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
    expect(normalized.sessionByWeekday).toBeUndefined();
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

  it("acepta un backup F20 sin reintroducir la clave legacy", () => {
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

    expect(normalized.sessionByWeekday).toBeUndefined();
  });

  it("retira franjaEntreno del perfil legacy sin perder el resto", () => {
    const normalized = settingsArrayToRecord(
      normalizeTrainingSettings([
        {
          key: "athleteProfile",
          value: {
            deporte: "CrossFit",
            programa: "The Progrm",
            franjaEntreno: "19:30-21:30",
          },
        },
      ]),
    );
    expect(normalized.athleteProfile).toEqual({
      deporte: "CrossFit",
      programa: "The Progrm",
    });
  });
});

describe("normalizeTrainingSettings — chips de lesión a episodios (F26 · AC4)", () => {
  const TODAY = "2026-08-18";

  const profileFrom = (rows: Record<string, unknown>[]) =>
    settingsArrayToRecord(normalizeTrainingSettings(rows, TODAY))
      .athleteProfile as { lesiones: Lesion[] } & Record<string, unknown>;

  it("un backup pre-F26 restaura sus lesiones SIN pérdida y para revisión", () => {
    const profile = profileFrom([
      {
        key: "athleteProfile",
        value: {
          deporte: "CrossFit",
          suplementos: ["creatina"],
          lesiones: ["hombro derecho", "fascitis plantar"],
        },
      },
    ]);

    expect(profile.suplementos).toEqual(["creatina"]); // los chips de suplemento NO se tocan
    expect(profile.lesiones.map((l) => l.zona)).toEqual([
      "hombro derecho",
      "fascitis plantar",
    ]);
    for (const l of profile.lesiones) {
      expect(l.capacidad).toBe("");
      expect(l.desde).toBeNull();
      expect(l.revisarEl).toBe(TODAY);
      expect(l.cerradaEl).toBeNull();
    }
  });

  it("no toca un perfil que ya trae episodios (idempotente) ni pierde las cerradas", () => {
    const lesiones: Lesion[] = [
      {
        id: "l1",
        zona: "hombro derecho",
        descripcion: null,
        capacidad: "NO por encima de cabeza; SÍ pierna.",
        desde: "2026-07-28",
        revisarEl: "2026-08-11",
        cerradaEl: null,
        cierreAproximado: false,
      },
      {
        id: "l0",
        zona: "codo",
        descripcion: null,
        capacidad: "",
        desde: "2026-03-01",
        revisarEl: "2026-03-15",
        cerradaEl: "2026-04-02",
        cierreAproximado: true,
      },
    ];
    const rows = [{ key: "athleteProfile", value: { lesiones } }];
    expect(profileFrom(rows).lesiones).toEqual(lesiones);
    expect(profileFrom(rows).lesiones).toEqual(
      profileFrom([{ key: "athleteProfile", value: profileFrom(rows) }]).lesiones,
    );
  });

  it("un perfil sin la clave `lesiones` se queda sin ella (no la inventa)", () => {
    expect(profileFrom([{ key: "athleteProfile", value: { deporte: "CrossFit" } }]))
      .toEqual({ deporte: "CrossFit" });
  });
});
