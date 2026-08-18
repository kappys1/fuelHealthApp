import { describe, expect, it } from "vitest";
import { SESSIONS } from "@/lib/macros";
import {
  applyTrainingFormat,
  isTrainingHeadingLine,
  stripTrainingGroupMarkers,
  orderedSessionOptions,
  planSpanFromAssignments,
  splitTrainingContent,
  sessionKcal,
  sessionPatchFor,
  splitTrainingGroups,
  trainingBlockText,
  trainingGroupDisplayLabel,
  trainingGroupLabel,
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

  describe("grupos dentro del bloque · F25", () => {
    it.each(["**Power Clean**", "  **Si aparece dolor >2/10**  ", "**4 rounds**"])(
      "reconoce el marcador de línea completa %j",
      (line) => {
        expect(trainingGroupLabel(line)).toBeTruthy();
      },
    );

    it("recorta la etiqueta a su contenido", () => {
      expect(trainingGroupLabel("**Power Jerk**")).toBe("Power Jerk");
      expect(trainingGroupLabel("  ** Strict Press **  ")).toBe("Strict Press");
    });

    // AC 3: solo la línea completa cuenta. Un `**…**` a mitad de frase es énfasis
    // del texto de origen (mismo criterio que isTrainingHeadingLine).
    it.each([
      "Hacer **5 × 2** al 40–60 %.",
      "**Power Clean** + **Power Jerk**",
      "**Power Clean**:",
      "Power Clean",
      "****",
      "**",
      "",
    ])("no abre grupo con %j", (line) => {
      expect(trainingGroupLabel(line)).toBeNull();
    });

    // AC 1: cero regresión en lo ya guardado. Sin marcadores el cuerpo vuelve
    // ENTERO y sin normalizar (CRLF incluido) → el <p> se pinta byte-idéntico.
    it("sin marcadores devuelve un único grupo con el texto exacto", () => {
      const body = "Clean and Jerk\r\n1. Build to today's 1RM.\r\n2. 3 x 1 @ 80 %.";
      expect(splitTrainingGroups(body)).toEqual([{ label: null, text: body }]);
    });

    it("sin contenido no devuelve grupos", () => {
      expect(splitTrainingGroups("")).toEqual([]);
    });

    // AC 1 · regresión sobre la sesión REAL del 18-ago tal como está guardada hoy
    // (sin marcadores): ni un bloque cambia, ni un carácter se mueve.
    it("no toca la sesión del 18-ago mientras no tenga marcadores", () => {
      const contenido = [
        "Calentamiento:",
        "3 rondas",
        "10 cal row",
        "10 air squats",
        "",
        "Weightlifting / Strength:",
        "Power Clean + Power Jerk",
        "Power Clean",
        "Mantener normal.",
        "Power Jerk",
        "No buscar technical heavy.",
        "",
        "CrossFit:",
        "5 rounds for time",
        "15/12 cal Ski",
      ].join("\n");

      const bodies = splitTrainingContent(contenido).map(trainingBlockText);
      expect(bodies).toHaveLength(3);
      for (const body of bodies) {
        expect(splitTrainingGroups(body)).toEqual([{ label: null, text: body }]);
      }
    });

    // AC 11 · caso canónico: el bloque Weightlifting/Strength de la sesión del
    // jueves 18-ago, con los marcadores puestos.
    it("parte el bloque del 18-ago en entradilla + 5 grupos", () => {
      const body = [
        "Power Clean + Power Jerk",
        "**Power Clean**",
        "Mantener normal.",
        "Puedes buscar carga técnica pesada si el hombro no molesta.",
        "**Power Jerk**",
        "No buscar technical heavy.",
        "Hacer 5 × 2 al 40–60 %.",
        "Técnica perfecta, sin forzar la recepción.",
        "**Si aparece dolor >2/10**",
        "Quitar el jerk.",
        "Hacer solo power clean.",
        "**4 rounds**",
        "Original",
        "5 Power cleans",
        "**Strict Press**",
        "No hacer:",
        "4 × 4 al 80–90 %",
      ].join("\n");

      const groups = splitTrainingGroups(body);

      expect(groups.map((g) => g.label)).toEqual([
        null,
        "Power Clean",
        "Power Jerk",
        "Si aparece dolor >2/10",
        "4 rounds",
        "Strict Press",
      ]);
      // AC 4: lo previo al primer marcador es la entradilla del bloque.
      expect(groups[0]).toEqual({ label: null, text: "Power Clean + Power Jerk" });
      // AC 2: las líneas siguientes pertenecen al grupo hasta el próximo marcador.
      expect(groups[2]?.text).toBe(
        "No buscar technical heavy.\nHacer 5 × 2 al 40–60 %.\nTécnica perfecta, sin forzar la recepción.",
      );
      expect(groups[5]?.text).toBe("No hacer:\n4 × 4 al 80–90 %");
    });

    it("un bloque que abre con marcador no tiene entradilla", () => {
      expect(splitTrainingGroups("**Strict Press**\n4 × 4")).toEqual([
        { label: "Strict Press", text: "4 × 4" },
      ]);
    });

    // Un rótulo sin nada debajo se pinta como línea normal: ni etiquetas
    // flotando sobre una regla, ni grupos vacíos.
    it("baja a texto el rótulo que no tiene líneas propias", () => {
      expect(splitTrainingGroups("Entradilla\n**Descanso**")).toEqual([
        { label: null, text: "Entradilla\nDescanso" },
      ]);
    });

    // El caso real de la IA (5/5 llamadas): marca también la línea que nombra la
    // pareja. Al no tener cuerpo propio, cae sola en su sitio: la entradilla.
    it("la pareja marcada por la IA vuelve a ser entradilla, no un grupo vacío", () => {
      const groups = splitTrainingGroups(
        "**Power Clean + Power Jerk**\n**Power Clean**\nMantener normal.",
      );
      expect(groups).toEqual([
        { label: null, text: "Power Clean + Power Jerk" },
        { label: "Power Clean", text: "Mantener normal." },
      ]);
    });

    // El dato conserva los dos puntos; la ficha no los pinta.
    it("el rótulo se pinta sin los dos puntos finales, pero el dato los conserva", () => {
      expect(trainingGroupDisplayLabel("Si aparece dolor >2/10:")).toBe(
        "Si aparece dolor >2/10",
      );
      expect(trainingGroupDisplayLabel("4 rounds")).toBe("4 rounds");
      expect(trainingGroupLabel("**Si aparece dolor >2/10:**")).toBe(
        "Si aparece dolor >2/10:",
      );
      expect(stripTrainingGroupMarkers("**No hacer:**\nHeavy 4")).toBe(
        "No hacer:\nHeavy 4",
      );
    });

    /*
      AC 11 · el caso canónico, de punta a punta y con la salida LITERAL que
      devolvió el modelo (gemini-3.5-flash-lite, 5/5 llamadas idénticas el
      18-ago). Es la vara de medir del reparto: si un cambio de prompt o de
      modelo empeora la agrupación, se ve aquí antes que en el box.
    */
    it("la sesión del 18-ago formateada da los 5 grupos esperados", () => {
      const formateada = [
        "**Power Clean + Power Jerk**",
        "**Power Clean**",
        "Mantener normal.",
        "Puedes buscar carga técnica pesada si el hombro no molesta.",
        "**Power Jerk**",
        "No buscar technical heavy.",
        "Hacer 5 × 2 al 40–60 %.",
        "Técnica perfecta, sin forzar la recepción.",
        "**Si aparece dolor >2/10:**",
        "Quitar el jerk.",
        "Hacer solo power clean.",
        "**4 rounds**",
        "Original",
        "5 Power cleans",
        "5 Power jerks",
        "Adaptado",
        "5 Power cleans",
        "Sin power jerks",
        "**Strict Press**",
        "No hacer:",
        "Heavy 4",
        "4 × 4 al 80–90 %",
        "Sustitución",
        "Landmine press unilateral — 3 × 8 por lado",
        "RPE 6 aprox.",
        "Sin dolor >2/10",
      ].join("\n");

      const groups = splitTrainingGroups(formateada);
      expect(groups.map((g) => g.label && trainingGroupDisplayLabel(g.label))).toEqual([
        null,
        "Power Clean",
        "Power Jerk",
        "Si aparece dolor >2/10",
        "4 rounds",
        "Strict Press",
      ]);
      expect(groups[0]?.text).toBe("Power Clean + Power Jerk");
      // Las variantes se quedan DENTRO de su grupo: no hay cuarto nivel.
      expect(groups[4]?.text).toContain("Original");
      expect(groups[4]?.text).toContain("Adaptado");
      expect(groups[5]?.text).toContain("Sustitución");
    });

    it("stripTrainingGroupMarkers quita los rótulos y respeta el énfasis de línea", () => {
      expect(
        stripTrainingGroupMarkers("**Power Jerk**\r\nHacer **5 × 2** al 40 %."),
      ).toBe("Power Jerk\r\nHacer **5 × 2** al 40 %.");
    });

    // AC 6: los marcadores son caracteres del contenido como cualquier otro.
    it("no altera la invariante F17 de splitTrainingContent", () => {
      const content =
        "Weightlifting/Strength:\nPower Clean + Power Jerk\n**Power Clean**\nMantener normal.\n\nCrossFit:\n5 rounds for time";
      expect(splitTrainingContent(content).join("")).toBe(content);
    });
  });

  describe("verificador de fidelidad del formateo · F25", () => {
    const ORIGINAL = [
      "Power Clean + Power Jerk",
      "Power Clean",
      "Mantener normal.",
      "",
      "Strict Press",
      "4 × 4 al 80–90 %",
    ].join("\n");

    // AC 8: el camino feliz. Mismo texto, dos líneas envueltas.
    it("acepta el formateo que solo envuelve líneas completas", () => {
      const formatted = ORIGINAL.replace("Power Clean\n", "**Power Clean**\n").replace(
        "Strict Press",
        "**Strict Press**",
      );
      expect(applyTrainingFormat(ORIGINAL, formatted)).toEqual({
        contenido: formatted,
        applied: true,
        groups: 2,
        reason: null,
      });
    });

    it("tolera el ruido de formato (CRLF, espacios de sobra, blancos de más)", () => {
      const noisy =
        "Power Clean + Power Jerk  \r\n**Power  Clean**\r\nMantener normal.\r\n\r\n\r\n**Strict Press**\r\n4 × 4 al 80–90 %\r\n";
      expect(applyTrainingFormat(ORIGINAL, noisy).applied).toBe(true);
    });

    it("un texto sin ningún grupo es una respuesta válida", () => {
      expect(applyTrainingFormat(ORIGINAL, ORIGINAL)).toEqual({
        contenido: ORIGINAL,
        applied: true,
        groups: 0,
        reason: null,
      });
    });

    // AC 9: respuestas manipuladas A PROPÓSITO. En los cuatro casos gana el
    // original: nunca se pierde un "4 × 4 al 80–90 %".
    it.each([
      ["cambia una cifra", ORIGINAL.replace("80–90 %", "80 %")],
      ["omite una línea", ORIGINAL.replace("Mantener normal.\n", "")],
      ["añade una línea", `${ORIGINAL}\nAccesorios: plancha 3 × 1 min`],
      [
        "reordena",
        ["Strict Press", "4 × 4 al 80–90 %", "", "Power Clean", "Mantener normal."].join(
          "\n",
        ),
      ],
      [
        "borra la línea en blanco que separa bloques",
        ORIGINAL.replace("\n\n", "\n"),
      ],
      ["une dos líneas", ORIGINAL.replace("Power Clean\nMantener", "Power Clean Mantener")],
      [
        "envuelve a mitad de línea",
        ORIGINAL.replace("4 × 4 al 80–90 %", "**4 × 4** al 80–90 %"),
      ],
    ])("descarta el formateo si %s", (_caso, manipulado) => {
      const out = applyTrainingFormat(ORIGINAL, manipulado);
      expect(out.applied).toBe(false);
      expect(out.contenido).toBe(ORIGINAL);
      expect(out.reason).toBeTruthy();
    });
  });
});
