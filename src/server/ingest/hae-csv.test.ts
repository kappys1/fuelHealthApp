import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHaeCsv } from "./hae-csv";

const dir = fileURLToPath(new URL("./__fixtures__/", import.meta.url));

describe("parseHaeCsv — fixture español (03 §4.2)", () => {
  const csv = readFileSync(`${dir}hae-sample.csv`, "utf8");
  const r = parseHaeCsv(csv);

  it("ignora filas sin fecha 'YYYY-MM-DD' (fila 'Total')", () => {
    expect(r.rows).toBe(3);
    expect(r.days).toHaveLength(3);
  });

  it("detecta las 10 métricas mapeables", () => {
    // peso, grasa, activa, basal, pasos, agua, hrv, sueño, fc reposo, vo2
    expect(r.fields).toHaveLength(10);
    expect(new Set(r.fields)).toEqual(
      new Set([
        "weight",
        "bodyFatPct",
        "activeKcal",
        "basalKcal",
        "steps",
        "waterL",
        "hrvMs",
        "sleepH",
        "restingHr",
        "vo2max",
      ]),
    );
  });

  it("convierte kJ→kcal y mL→L, marca los avisos", () => {
    expect(r.hadKj).toBe(true);
    expect(r.hadMl).toBe(true);
    const d = r.days[0]!;
    expect(d.activeKcal).toBe(830); // 3472,72 kJ / 4,184
    expect(d.basalKcal).toBe(2054); // 8593,94 kJ / 4,184
    expect(d.waterL).toBeCloseTo(3, 6); // 3000 mL / 1000
  });

  it("NO confunde «Peso (kg)» con «Longitud del Paso al Caminar» (colisión peso/paso)", () => {
    // El peso viene vacío en el fixture (báscula Xiaomi no sincroniza) → null,
    // pero la columna «Paso» (72,3 cm) NO debe haberse mapeado a peso.
    for (const d of r.days) expect(d.weight ?? null).toBeNull();
  });

  it("reproduce los valores de referencia de Alex (03 §4.2)", () => {
    const avg = (pick: (d: (typeof r.days)[number]) => number | null | undefined) =>
      r.days.reduce((a, d) => a + (pick(d) ?? 0), 0) / r.days.length;
    expect(avg((d) => d.activeKcal)).toBeCloseTo(830, 0); // ~830 activas
    expect(avg((d) => d.basalKcal)).toBeCloseTo(2054, 0); // ~2.054 basales
    expect(avg((d) => d.steps)).toBeCloseTo(13300, 0); // ~13.300 pasos
    // TDEE Apple ≈ activas + basales ≈ 2.884
    expect(avg((d) => d.activeKcal) + avg((d) => d.basalKcal)).toBeCloseTo(2884, 0);
    expect(avg((d) => d.restingHr)).toBeCloseTo(47, 0);
    expect(avg((d) => d.vo2max)).toBeCloseTo(50.1, 2);
    expect(avg((d) => d.hrvMs)).toBeCloseTo(67, 0);
  });
});

describe("parseHaeCsv — casos límite", () => {
  it("autodetecta el delimitador coma y la cabecera inglesa", () => {
    const csv = [
      "Date,Active Energy (kcal),Step Count (count),Weight (kg)",
      "2026-05-01 00:00:00,812.5,13010,91.2",
    ].join("\n");
    const r = parseHaeCsv(csv);
    expect(r.rows).toBe(1);
    expect(r.hadKj).toBe(false); // ya viene en kcal
    const d = r.days[0]!;
    expect(d.activeKcal).toBe(813); // entero
    expect(d.steps).toBe(13010);
    expect(d.weight).toBeCloseTo(91.2, 6);
  });

  it("fusiona filas repetidas de la misma fecha", () => {
    const csv = [
      "Fecha/Hora;Peso (kg);Conteo de Pasos (recuentos)",
      "2026-05-02 00:00:00;90,5;",
      "2026-05-02 12:00:00;;5000",
    ].join("\n");
    const r = parseHaeCsv(csv);
    expect(r.days).toHaveLength(1);
    expect(r.days[0]!.weight).toBeCloseTo(90.5, 6);
    expect(r.days[0]!.steps).toBe(5000);
  });

  it("archivo vacío → resultado vacío, sin lanzar", () => {
    expect(parseHaeCsv("")).toEqual({
      days: [],
      rows: 0,
      fields: [],
      hadKj: false,
      hadMl: false,
    });
  });
});

// CSV real de Alex (gitignored: datos de salud personales). Este test se salta
// donde el archivo no existe; en local valida el AC de la Fase 3 (31 filas / 10
// métricas / aviso kJ) y que las medias caen en los valores de referencia (§4.2).
describe.runIf(existsSync(`${dir}hae-real.csv`))("parseHaeCsv — CSV real de Alex", () => {
  const csv = readFileSync(`${dir}hae-real.csv`, "utf8");
  const r = parseHaeCsv(csv);
  const avg = (f: keyof (typeof r.days)[number]) => {
    const vals = r.days
      .map((d) => d[f])
      .filter((v): v is number => typeof v === "number");
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  it("da 31 filas y 10 métricas, con aviso kJ y mL (AC Fase 3)", () => {
    expect(r.rows).toBe(31);
    expect(r.fields).toHaveLength(10);
    expect(new Set(r.fields)).toEqual(
      new Set([
        "weight",
        "bodyFatPct",
        "activeKcal",
        "basalKcal",
        "steps",
        "waterL",
        "hrvMs",
        "sleepH",
        "restingHr",
        "vo2max",
      ]),
    );
    expect(r.hadKj).toBe(true);
    expect(r.hadMl).toBe(true);
  });

  it("reproduce los valores de referencia de Alex (§4.2)", () => {
    expect(avg("activeKcal")).toBeGreaterThan(700); // ~830
    expect(avg("activeKcal")).toBeLessThan(950);
    expect(avg("basalKcal")).toBeGreaterThan(1900); // ~2.054
    expect(avg("basalKcal")).toBeLessThan(2150);
    expect(avg("steps")).toBeGreaterThan(9000); // ~13.300 (jun-jul)
    expect(avg("restingHr")).toBeGreaterThan(43); // ~47
    expect(avg("restingHr")).toBeLessThan(51);
    expect(avg("vo2max")).toBeGreaterThan(47); // ~50
    expect(avg("hrvMs")).toBeGreaterThan(55); // ~67
  });
});
