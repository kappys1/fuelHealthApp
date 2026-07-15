import { describe, expect, it } from "vitest";
import type { Macros } from "@/lib/macros";
import { gaugeVerdict } from "./gaugeVerdict";

/*
  Veredicto único UI↔coach. El caso guía es el 14-jul (día bueno que el coach
  trataba como fracaso): objetivos cubiertos y +187 kcal a la vez, grasa +11 g
  que NO llega a «notable».
*/

const TARGETS = { kcal: 1800, prot: 110, carb: 215, fat: 55 };
// 14-jul real: 1987 kcal, 114P / 227C / 66F.
const JUL14: Macros = { kcal: 1987, prot: 114, carb: 227, fat: 66 };

describe("gaugeVerdict (fuente única del veredicto del día)", () => {
  it("14-jul: cubierto Y pasado a la vez; la grasa (+11) NO es notable", () => {
    const v = gaugeVerdict(TARGETS, JUL14, null);
    expect(v.covered).toBe(true);
    expect(v.over).toBe(true);
    expect(v.kcalOver).toBe(187);
    expect(v.kcalRemaining).toBe(0);
    expect(v.fat.over).toBe(11);
    expect(v.notablyOver).toEqual([]); // +11 g < 25 % de 55 (13,75)
  });

  it("marca un macro notablemente pasado (grasa muy por encima)", () => {
    const v = gaugeVerdict(TARGETS, { kcal: 2200, prot: 114, carb: 227, fat: 90 }, null);
    expect(v.fat.notablyOver).toBe(true); // +35 g > 13,75
    expect(v.notablyOver).toContain("fat");
    expect(v.covered).toBe(true); // sigue cubierto, pero con aviso
  });

  it("día incompleto: no cubierto, con lo que falta", () => {
    const v = gaugeVerdict(TARGETS, { kcal: 900, prot: 40, carb: 100, fat: 20 }, null);
    expect(v.covered).toBe(false);
    expect(v.over).toBe(false);
    expect(v.kcalRemaining).toBe(900);
    expect(v.prot.remaining).toBe(70);
  });

  it("fase especial y competición se marcan aparte", () => {
    expect(gaugeVerdict(TARGETS, JUL14, "carga").phase).toBe("special");
    expect(gaugeVerdict(TARGETS, JUL14, "competicion").phase).toBe("competicion");
    expect(gaugeVerdict(TARGETS, JUL14, null).phase).toBe("normal");
  });
});
