import { describe, expect, it } from "vitest";
import { SESSIONS } from "@/lib/macros";
import {
  isTrainingHeadingLine,
  orderedSessionOptions,
  planSpanFromAssignments,
  splitTrainingContent,
  sessionKcal,
  sessionPatchFor,
  trainingBlockText,
  trainingWeekNavigation,
  trainingWeekSpan,
  TRAINING_TIPO_LABELS,
  TRAINING_TIPOS,
} from "./training";

describe("helpers de entrenamiento (doc 10 Fase B)", () => {
  it("sessionKcal: media redondeada del rango", () => {
    expect(sessionKcal(1000, 1600)).toBe(1300);
    expect(sessionKcal(500, 700)).toBe(600);
  });

  it("sessionKcal: si falta un extremo usa el otro; null si no hay datos", () => {
    expect(sessionKcal(null, 800)).toBe(800);
    expect(sessionKcal(800, null)).toBe(800);
    expect(sessionKcal(null, null)).toBeNull();
    expect(sessionKcal(undefined, undefined)).toBeNull();
  });

  it("planSpanFromAssignments: min/max de las fechas asignadas", () => {
    expect(
      planSpanFromAssignments(["2026-07-14", "2026-07-12", "2026-07-16"]),
    ).toEqual({ validFrom: "2026-07-12", validTo: "2026-07-16" });
  });

  it("planSpanFromAssignments: ignora vacíos y devuelve null sin fechas", () => {
    expect(planSpanFromAssignments(["", "no-fecha"])).toBeNull();
    expect(planSpanFromAssignments([])).toBeNull();
  });

  it("trainingWeekSpan: normaliza cualquier día a lunes-domingo", () => {
    expect(trainingWeekSpan("2026-07-15")).toEqual({
      validFrom: "2026-07-13",
      validTo: "2026-07-19",
    });
    expect(trainingWeekSpan("2026-07-19")).toEqual({
      validFrom: "2026-07-13",
      validTo: "2026-07-19",
    });
  });

  it("trainingWeekNavigation: el domingo permite planificar la semana siguiente", () => {
    expect(trainingWeekNavigation("2026-07-27", "2026-07-26")).toEqual({
      selectedWeek: "2026-07-27",
      currentWeek: "2026-07-20",
      isPast: false,
    });
  });

  it("orderedSessionOptions: con plan = sesiones reales + Competición/Descanso, SIN genéricas", () => {
    const opts = orderedSessionOptions(["Snatch + WOD", "Aeróbico Z2"]);
    expect(opts).toEqual([
      "Snatch + WOD",
      "Aeróbico Z2",
      "Competición",
      "Descanso",
    ]);
    // Los T1–T6 genéricos NO aparecen cuando hay plan (eran el ruido).
    expect(opts).not.toContain(SESSIONS[0]);
  });

  it("orderedSessionOptions: sin plan = lista genérica SESSIONS", () => {
    expect(orderedSessionOptions([])).toEqual([...SESSIONS]);
  });

  it("sessionPatchFor: sesión del plan ancla sessionRef + kcal media", () => {
    const sessions = [
      { id: 7, nombre: "Snatch + WOD", kcalMin: 600, kcalMax: 800 },
    ];
    expect(sessionPatchFor("Snatch + WOD", sessions)).toEqual({
      sessionLabel: "Snatch + WOD",
      sessionRef: 7,
      sessionKcal: 700,
    });
  });

  it("sessionPatchFor: label genérico → sessionRef null y kcal null", () => {
    expect(sessionPatchFor("Descanso", [])).toEqual({
      sessionLabel: "Descanso",
      sessionRef: null,
      sessionKcal: null,
    });
  });

  it("TRAINING_TIPO_LABELS cubre todos los tipos", () => {
    for (const t of TRAINING_TIPOS) {
      expect(TRAINING_TIPO_LABELS[t]).toBeTruthy();
    }
  });

  describe("splitTrainingContent · F17", () => {
    it.each([
      [
        "encabezados",
        "Fuerza/Halterofilia: Clean pull + squat clean. CrossFit: 5 rondas. Accesorios: planchas.",
        3,
      ],
      [
        "párrafos",
        "Bloque de fuerza con dos series.\n\nMetcon por tiempo.\n\nVuelta a la calma.",
        3,
      ],
      ["líneas", "Clean pull\nSquat clean\nBack squat", 3],
      ["fallback", "Sesión completa sin estructura detectable", 1],
    ])("preserva el 100 %% del texto con %s", (_case, content, count) => {
      const blocks = splitTrainingContent(content);
      expect(blocks).toHaveLength(count);
      expect(blocks.join("")).toBe(content);
    });

    it("conserva saltos iniciales/finales y CRLF sin normalizarlos", () => {
      const content = "\r\nFuerza: sentadilla\r\n\r\nCrossFit: remo\r\n";
      const blocks = splitTrainingContent(content);
      expect(blocks.join("")).toBe(content);
      expect(blocks).toHaveLength(2);
    });

    it("agrupa las líneas de cada párrafo importado en un único bloque legible", () => {
      const content =
        "Plyometrics:\nStep Up with Jump\n3 x 5+5, rest 90 sec between sets.\nKeep the working leg on the box.\n\nWeightlifting/Strength:\nClean and Jerk\n1. Build to today's 1RM.\n2. 3 x 1 @ 80% of 1, go every 90 sec.";
      const blocks = splitTrainingContent(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe(
        "Plyometrics:\nStep Up with Jump\n3 x 5+5, rest 90 sec between sets.\nKeep the working leg on the box.\n\n",
      );
      expect(blocks[1]).toBe(
        "Weightlifting/Strength:\nClean and Jerk\n1. Build to today's 1RM.\n2. 3 x 1 @ 80% of 1, go every 90 sec.",
      );
      expect(blocks.join("")).toBe(content);
    });

    // Regresión de uso real (semana del 3-ago): una sesión importada por IA llega
    // con saltos SIMPLES y sin línea en blanco. Antes se desmenuzaba en una fila
    // por línea (21 bloques); ahora manda el encabezado de sección.
    it("agrupa por encabezado cuando el texto llega sin líneas en blanco", () => {
      const content =
        "Plyometrics:\n3 Rounds for quality:\n6 Seated Box Jumps to 24/20in (step down)\n12 Banded KB Swings 24/16kg + black band\nRest at least 2 min between rounds.\nWeightlifting/Strength:\nDeadlift\n1. Build to a quick heavy single.\nNo grinding, the barbell has to move fast.\nCrossFit (Optional):\n3 x 3 min on / 2 min off\n500/450m Row\nAccessory:\n3 Rounds for quality:\n1-3 Skin the cat\n5+5 KB Windmills";
      const blocks = splitTrainingContent(content);

      expect(blocks).toHaveLength(4);
      expect(blocks[0]).toMatch(/^Plyometrics:/);
      expect(blocks[1]).toMatch(/^Weightlifting\/Strength:/);
      expect(blocks[2]).toMatch(/^CrossFit \(Optional\):/);
      expect(blocks[3]).toMatch(/^Accessory:/);
      expect(blocks.join("")).toBe(content);
    });

    it("reconoce los encabezados en mayúsculas y sin dos puntos de la hoja del box", () => {
      const content =
        "WARM UP\n1 RONDA\n10 SUPINE SCORPION ALT\nSTRENGTH\nDURANTE 6' REALIZA POR CALIDAD\nSTRICT PULL UP\nWOD\n5 RONDAS POR TIEMPO\n15 FRONT SQUAT";
      const blocks = splitTrainingContent(content);

      expect(blocks).toHaveLength(3);
      expect(blocks[1]).toMatch(/^STRENGTH\n/);
      expect(blocks[2]).toMatch(/^WOD\n/);
      expect(blocks.join("")).toBe(content);
    });

    it("no corta un encabezado que va a mitad de línea dentro de un bloque", () => {
      const content =
        "Gymnastics:\nGymnastics Strength:\nChin-Ups\n4 x 8-12\n\nRope Rows\n4 x 10-15";
      const blocks = splitTrainingContent(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe("Gymnastics:\nGymnastics Strength:\nChin-Ups\n4 x 8-12\n\n");
      expect(blocks.join("")).toBe(content);
    });

    // Regresión de uso real (Día 4): texto copiado de un PDF, con los saltos del
    // ajuste visual. Cortar por línea partía las frases por la mitad.
    it("no parte una frase envuelta al cortar por líneas", () => {
      const content =
        "Run, Bike or Row\n30-90 minutes of continuous work at RPE 5-6\nRun: Running involves a lot of eccentric loading which can increase\nrecovery demands even when going\nslow. If you're new to longer runs, start with shorter durations and\ngradually build up.";
      const blocks = splitTrainingContent(content);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toBe("Run, Bike or Row\n");
      expect(blocks[1]).toBe("30-90 minutes of continuous work at RPE 5-6\n");
      expect(blocks[2]).toMatch(/^Run: Running involves/);
      expect(blocks.join("")).toBe(content);
    });

    it("no inventa bloques para contenido vacío", () => {
      expect(splitTrainingContent("")).toEqual([]);
    });

    // Regresión de uso real (semana del 17-ago, sesión "Halterofilia + WOD + Rehab"):
    // texto pegado con DOBLE ESPACIADO. Cada línea era su propio bloque numerado —
    // ocho filas para una sesión de dos secciones. Manda el encabezado.
    it("el encabezado gana a las líneas en blanco de un texto doble-espaciado", () => {
      const content = [
        "Training 1",
        "Weightlifting / Strength",
        "Power Clean + Power Jerk",
        "Power Clean",
        "Mantener normal.",
        "Puedes buscar carga técnica pesada si el hombro no molesta.",
        "Power Jerk",
        "No buscar technical heavy.",
      ].join("\n\n");
      const blocks = splitTrainingContent(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toBe("Training 1\n\n");
      expect(blocks[1]).toMatch(/^Weightlifting \/ Strength\n\n/);
      expect(blocks[1]).toMatch(/No buscar technical heavy\.$/);
      expect(blocks.join("")).toBe(content);
    });

    // La otra cara de la misma moneda: sin encabezado que mande, tres párrafos de
    // una línea SIGUEN siendo tres bloques. Doble espaciado y bloques cortos se
    // escriben igual; sin señal de estructura no se adivina (ver también "párrafos").
    it("sin encabezado, los párrafos de una línea siguen siendo bloques", () => {
      const content = "Rehab hombro\n\n3 x 10 face pulls\n\nBandas rojas";
      expect(splitTrainingContent(content)).toHaveLength(3);
    });

    it("reconoce Rehab como encabezado de sección", () => {
      const content = "Halterofilia\n\nPower Clean 5 x 2\n\nRehab\n\nFace pulls 3 x 12";
      const blocks = splitTrainingContent(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[1]).toMatch(/^Rehab\n\n/);
      expect(blocks.join("")).toBe(content);
    });
  });

  describe("trainingBlockText · presentación", () => {
    it("colapsa el aire interior del doble espaciado y recorta el cierre", () => {
      expect(trainingBlockText("Power Clean\n\nMantener normal.\n\n")).toBe(
        "Power Clean\nMantener normal.",
      );
    });

    it("respeta los saltos simples de un bloque bien formado", () => {
      const block = "Plyometrics:\nStep Up with Jump\n3 x 5+5, rest 90 sec.\n\n";
      expect(trainingBlockText(block)).toBe(
        "Plyometrics:\nStep Up with Jump\n3 x 5+5, rest 90 sec.",
      );
    });

    it("limpia CRLF y líneas de solo espacios", () => {
      expect(trainingBlockText("\r\nFuerza: sentadilla\r\n \r\nWOD: remo")).toBe(
        "Fuerza: sentadilla\nWOD: remo",
      );
    });
  });

  describe("isTrainingHeadingLine · rótulos de la ficha", () => {
    it.each([
      "Weightlifting / Strength",
      "Plyometrics:",
      "CrossFit (Optional):",
      "STRENGTH",
      "WOD",
      "  Rehab  ",
      "Fuerza/Halterofilia:",
    ])("destaca %j", (line) => {
      expect(isTrainingHeadingLine(line)).toBe(true);
    });

    // La línea entera tiene que ser el rótulo: si lleva contenido propio, destacarla
    // prometería una sección que no empieza ahí (misma doctrina que el corte).
    it.each([
      "Gymnastics Strength:",
      "Accessory → Rehab A",
      "Rehab A — 18–20 min",
      "Fuerza: sentadilla",
      "5 Power cleans",
      "Strict Press",
      "",
    ])("no destaca %j", (line) => {
      expect(isTrainingHeadingLine(line)).toBe(false);
    });
  });
});
