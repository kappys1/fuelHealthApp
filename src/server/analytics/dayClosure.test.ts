import { describe, expect, it } from "vitest";
import { DEFAULT_ATHLETE_PROFILE } from "@/lib/profile";
import {
  classifyClosure,
  objectiveStance,
  trainingTiming,
} from "./dayClosure";
import { gaugeVerdict } from "./gaugeVerdict";

/*
  Cierre determinista del coach (ai-tuner 25-jul). Los fixtures son los DÍAS
  REALES del export de mensajes (20-24 jul): el mismo caso que motivó el fix es la
  referencia del test (skill §6: sin caso, el fix no está terminado).
*/
const T = { kcal: 1800, prot: 110, carb: 215, fat: 55 };

describe("classifyClosure · casos reales del export (20-24 jul)", () => {
  it("21-jul: faltan 10 kcal, proteína sobrada → sin_hueco (NO sugerir comida)", () => {
    // 1790 kcal · 129P/195C/57F
    const v = gaugeVerdict(T, { kcal: 1790, prot: 129, carb: 195, fat: 57 }, null);
    expect(classifyClosure(v)).toBe("sin_hueco");
  });

  it("23-jul: faltan 67 kcal, proteína cubierta → sin_hueco (día cerrado)", () => {
    // 1733 kcal · 114P/181C/60F
    const v = gaugeVerdict(T, { kcal: 1733, prot: 114, carb: 181, fat: 60 }, null);
    expect(classifyClosure(v)).toBe("sin_hueco");
  });

  it("22-jul: faltan 19 kcal y 3 g proteína → sin_hueco (no cerrar por 3 g)", () => {
    // 1781 kcal · 107P/192C/63F
    const v = gaugeVerdict(T, { kcal: 1781, prot: 107, carb: 192, fat: 63 }, null);
    expect(classifyClosure(v)).toBe("sin_hueco");
  });

  it("24-jul: faltan 52 kcal y 22 g proteína → proteina_prioritaria", () => {
    // 88 g proteína frente a 110 → 22 g restantes
    const v = gaugeVerdict(T, { kcal: 1748, prot: 88, carb: 200, fat: 60 }, null);
    expect(classifyClosure(v)).toBe("proteina_prioritaria");
  });

  it("20-jul: faltan 181 kcal, proteína cubierta → hueco_material", () => {
    // 1619 kcal · 121P/… con grasa 25 g corta
    const v = gaugeVerdict(T, { kcal: 1619, prot: 121, carb: 180, fat: 30 }, null);
    expect(classifyClosure(v)).toBe("hueco_material");
  });

  it("pasarse del techo → exceso (manda sobre proteína pendiente)", () => {
    // por encima de kcal aunque falte proteína: el techo manda, no se prescribe añadir
    const v = gaugeVerdict(T, { kcal: 1950, prot: 90, carb: 240, fat: 70 }, null);
    expect(classifyClosure(v)).toBe("exceso");
  });
});

describe("classifyClosure · fronteras de los umbrales (discutibles)", () => {
  it("99 kcal restantes (prot ok) = sin_hueco; 150 = hueco_material", () => {
    expect(
      classifyClosure(gaugeVerdict(T, { kcal: 1701, prot: 110, carb: 215, fat: 55 }, null)),
    ).toBe("sin_hueco"); // 99 restantes
    expect(
      classifyClosure(gaugeVerdict(T, { kcal: 1650, prot: 110, carb: 215, fat: 55 }, null)),
    ).toBe("hueco_material"); // 150 restantes
  });

  it("banda intermedia [100,150) con proteína ok se trata como día cerrado", () => {
    // 120 kcal restantes, proteína cubierta → sin_hueco (no es hueco que rellenar)
    const v = gaugeVerdict(T, { kcal: 1680, prot: 110, carb: 215, fat: 55 }, null);
    expect(classifyClosure(v)).toBe("sin_hueco");
  });

  it("proteína restante 10 g dispara proteina_prioritaria; 9 g no", () => {
    expect(
      classifyClosure(gaugeVerdict(T, { kcal: 1700, prot: 100, carb: 215, fat: 55 }, null)),
    ).toBe("proteina_prioritaria"); // 10 g
    expect(
      classifyClosure(gaugeVerdict(T, { kcal: 1700, prot: 101, carb: 215, fat: 55 }, null)),
    ).toBe("sin_hueco"); // 9 g, kcal restantes 100<150
  });
});

describe("objectiveStance · doctrina desde el texto del objetivo (principio 9)", () => {
  it("el objetivo vigente de Alex (definición/recomp) → deficit (techo)", () => {
    const obj = DEFAULT_ATHLETE_PROFILE.objetivos.at(-1)!.texto;
    expect(objectiveStance(obj)).toBe("deficit");
  });

  it("«recomposición: perder grasa manteniendo/ganando músculo» → deficit pese a «ganando músculo»", () => {
    expect(
      objectiveStance("recomposición: perder grasa manteniendo/ganando músculo"),
    ).toBe("deficit");
  });

  it("volumen → superavit (suelo); mantenimiento → mantenimiento (banda)", () => {
    expect(objectiveStance("volumen: ganar masa muscular")).toBe("superavit");
    expect(objectiveStance("mantenimiento de peso")).toBe("mantenimiento");
  });

  it("sin objetivo mapeable o vacío → desconocido (conservador)", () => {
    expect(objectiveStance("rendir mejor en CrossFit")).toBe("desconocido");
    expect(objectiveStance("")).toBe("desconocido");
    expect(objectiveStance(null)).toBe("desconocido");
  });
});

describe("trainingTiming · franja determinista sin inventar hora", () => {
  it.each(["mañana", "tarde", "descanso", "sin_dato"] as const)(
    "conserva %s para la directriz",
    (slot) => {
      expect(trainingTiming(slot)).toEqual({ rel: slot });
    },
  );
});
