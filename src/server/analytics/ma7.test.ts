import { describe, expect, it } from "vitest";
import {
  eligibleWeightSeries,
  ma7At,
  ma7Series,
  weightChartSeries,
} from "./ma7";
import type { AnalyticsRecord } from "./types";

const T = { kcal: 1800, prot: 110 };
function rec(
  date: string,
  weight: number | null,
  phase: AnalyticsRecord["phase"] = null,
): AnalyticsRecord {
  return {
    date,
    weight,
    phase,
    logged: false,
    kcal: 0,
    prot: 0,
    target: T,
    flexibleMeals: { planned: [], real: [] },
  };
}

describe("eligibleWeightSeries — exclusiones (03 §3)", () => {
  const records: AnalyticsRecord[] = [
    rec("2026-06-01", 92), // normal → incluido
    rec("2026-06-02", 91.8, "carga"), // fase especial → excluido
    rec("2026-06-03", 91.5, "competicion"), // fase especial → excluido
    rec("2026-06-04", 93), // 1 día tras competición → excluido
    rec("2026-06-05", 92.5), // 2 días tras competición → excluido
    rec("2026-06-06", 91), // 3 días tras → incluido
    rec("2026-06-07", null), // sin peso → excluido
  ];

  it("excluye fases especiales y los 2 días post-competición", () => {
    const s = eligibleWeightSeries(records);
    expect(s.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-06"]);
    expect(s.map((p) => p.weight)).toEqual([92, 91]);
  });

  it("ma7At promedia solo lo elegible dentro de la ventana [d-6, d]", () => {
    const s = eligibleWeightSeries(records);
    expect(ma7At(s, "2026-06-01")).toBe(92); // solo el propio día
    expect(ma7At(s, "2026-06-06")).toBe(91.5); // (92 + 91) / 2
    expect(ma7At(s, "2026-05-01")).toBeNull(); // ventana vacía
  });
});

describe("ma7 — media de ventana", () => {
  const records: AnalyticsRecord[] = [
    rec("2026-01-01", 90),
    rec("2026-01-02", 90),
    rec("2026-01-03", 90),
    rec("2026-01-04", 90),
    rec("2026-01-05", 90),
    rec("2026-01-06", 90),
    rec("2026-01-07", 97),
  ];

  it("ma7 al día 7 = (90×6 + 97) / 7 = 91", () => {
    const s = eligibleWeightSeries(records);
    expect(ma7At(s, "2026-01-07")).toBeCloseTo(91, 10);
  });

  it("ma7Series da un punto por fecha con peso elegible", () => {
    expect(ma7Series(records)).toHaveLength(7);
  });

  it("un marcador flexible real no elimina el peso de ma7", () => {
    const withFlexible: AnalyticsRecord[] = records.map((record, index) =>
      index === 6
        ? {
            ...record,
            flexibleMeals: { planned: [], real: ["cena"] },
          }
        : record,
    );
    expect(eligibleWeightSeries(withFlexible)).toHaveLength(7);
    expect(ma7At(eligibleWeightSeries(withFlexible), "2026-01-07")).toBeCloseTo(
      91,
      10,
    );
  });
});

/*
  F22 · AC7 — la serie del gráfico no puede ocultar los días sin pesaje.

  El bug tenía dos capas: `connectNulls` en Recharts, sí, pero antes de eso el
  gráfico solo recibía días CON peso, así que el eje los pegaba uno detrás de otro y
  el hueco ni existía como dato. Un hueco tiene que llegar como `weight: null`.
*/
describe("F22 · weightChartSeries (AC7)", () => {
  const rows = [
    rec("2026-07-20", 92),
    rec("2026-07-21", 91.8),
    // 22 y 23 SIN pesaje: el hueco que se leía como «peso estable».
    rec("2026-07-22", null),
    rec("2026-07-23", null),
    rec("2026-07-24", 91.2),
  ];

  it("emite un punto por día natural, con null donde no hubo pesaje", () => {
    const series = weightChartSeries(rows, "2026-07-20", "2026-07-24");
    expect(series.map((p) => p.date)).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
    ]);
    expect(series.map((p) => p.weight)).toEqual([92, 91.8, null, null, 91.2]);
  });

  it("emite el día aunque no exista fila en records (día nunca tocado)", () => {
    const series = weightChartSeries(
      [rec("2026-07-20", 92), rec("2026-07-24", 91.2)],
      "2026-07-20",
      "2026-07-24",
    );
    expect(series).toHaveLength(5);
    expect(series.filter((p) => p.weight == null)).toHaveLength(3);
  });

  it("la ma7 sí es continua en el hueco: es una media calculada, no una medición", () => {
    const series = weightChartSeries(rows, "2026-07-20", "2026-07-24");
    // Sin pesaje no hay punto propio de ma7 (la serie elegible no lo tiene)...
    expect(series[2]!.ma7).toBeNull();
    // ...pero los días con pesaje sí lo llevan, y el gráfico une esa línea.
    expect(series[0]!.ma7).not.toBeNull();
    expect(series[4]!.ma7).not.toBeNull();
  });

  it("la ma7 del borde izquierdo visible incluye los 6 días previos al rango", () => {
    const history = [
      rec("2026-07-14", 93),
      rec("2026-07-15", 93),
      rec("2026-07-16", 93),
      ...rows,
    ];
    const conHistoria = weightChartSeries(history, "2026-07-20", "2026-07-24");
    const sinHistoria = weightChartSeries(rows, "2026-07-20", "2026-07-24");
    expect(conHistoria[0]!.ma7).not.toBeCloseTo(sinHistoria[0]!.ma7 as number, 6);
  });

  it("un día en fase especial no aporta ma7 aunque tenga peso (regresión)", () => {
    const withPhase = [
      rec("2026-07-20", 92),
      rec("2026-07-21", 95, "carga"),
    ];
    const series = weightChartSeries(withPhase, "2026-07-20", "2026-07-21");
    expect(series[1]!.weight).toBe(95); // el peso crudo sigue viéndose
    expect(series[1]!.ma7).toBeNull(); // pero no entra en la media
  });
});
