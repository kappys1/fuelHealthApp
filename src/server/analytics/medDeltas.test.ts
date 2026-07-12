import { describe, expect, it } from "vitest";
import { computeMedDeltas, type MedMeasurement } from "./medDeltas";

/*
  Números de referencia: el histórico MED de Alex (03-DATOS §6):
  volumen sept-2025→ene-2026 (89,7→94,5 kg; grasa 7,71→10,77; músculo 51,54→52,13).
*/
function med(
  id: number,
  date: string,
  fatKg: number | null,
  muscleKg: number | null,
  weightKg: number | null,
): MedMeasurement {
  return { id, date, fatKg, muscleKg, weightKg };
}

describe("computeMedDeltas (F5.2)", () => {
  it("calcula SIEMPRE actual − anterior (no copia los signos volteados del Excel)", () => {
    const rows = [
      med(1, "2025-09-05", 7.71, 51.54, 89.7),
      med(2, "2026-01-09", 10.77, 52.13, 94.5),
    ];
    const [first, second] = computeMedDeltas(rows);

    // La primera no tiene anterior.
    expect(first!.delta).toEqual({ fatKg: null, muscleKg: null, weightKg: null });

    // Ganó grasa (+) y músculo (+) y peso (+) en el volumen: signos correctos.
    expect(second!.delta.fatKg).toBeCloseTo(3.06, 2);
    expect(second!.delta.muscleKg).toBeCloseTo(0.59, 2);
    expect(second!.delta.weightKg).toBeCloseTo(4.8, 2);
  });

  it("ordena por fecha ascendente aunque lleguen desordenadas", () => {
    const rows = [
      med(2, "2026-05-01", 11.06, 53.13, 96.2),
      med(1, "2026-07-04", 8.99, 51.79, 91.7),
    ];
    const out = computeMedDeltas(rows);
    expect(out.map((r) => r.date)).toEqual(["2026-05-01", "2026-07-04"]);
    // Definición: perdió grasa (−) y algo de músculo (−) y peso (−).
    expect(out[1]!.delta.fatKg).toBeCloseTo(-2.07, 2);
    expect(out[1]!.delta.muscleKg).toBeCloseTo(-1.34, 2);
    expect(out[1]!.delta.weightKg).toBeCloseTo(-4.5, 2);
  });

  it("delta null si falta el valor en cualquiera de los dos extremos", () => {
    const rows = [
      med(1, "2026-06-01", 9.0, null, 92.0),
      med(2, "2026-07-01", 8.5, 52.0, 91.0),
    ];
    const [, second] = computeMedDeltas(rows);
    expect(second!.delta.fatKg).toBeCloseTo(-0.5, 2);
    expect(second!.delta.muscleKg).toBeNull(); // el anterior no tenía músculo
    expect(second!.delta.weightKg).toBeCloseTo(-1, 2);
  });
});
