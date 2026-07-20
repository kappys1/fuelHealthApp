import { describe, expect, it } from "vitest";
import {
  bestEntry,
  doubleReference,
  formatMarkValue,
  formatSeconds,
  higherIsBetter,
  latestRecordPercentage,
  latestChange,
  latestEntry,
  marksByRecency,
  markValueToInput,
  parseMarkValue,
  parseTimeToSeconds,
  percentOf,
} from "./marks";

// Helper: entrada mínima (id incremental por defecto = orden de inserción).
const e = (id: number, value: number, recordedOn: string) => ({
  id,
  value,
  recordedOn,
});

describe("dirección de 'mejor' según el tipo", () => {
  it("peso/reps/distancia: más es mejor; tiempo: menos es mejor", () => {
    expect(higherIsBetter("weight")).toBe(true);
    expect(higherIsBetter("reps")).toBe(true);
    expect(higherIsBetter("distance")).toBe(true);
    expect(higherIsBetter("time")).toBe(false);
  });
});

describe("latestEntry", () => {
  it("es la más reciente por fecha (empate → mayor id)", () => {
    const entries = [
      e(1, 100, "2026-01-01"),
      e(3, 110, "2026-03-01"),
      e(2, 105, "2026-02-01"),
    ];
    expect(latestEntry(entries)?.value).toBe(110);
  });
  it("empate de fecha: gana el id mayor (registrado después)", () => {
    const entries = [e(1, 100, "2026-05-01"), e(2, 107, "2026-05-01")];
    expect(latestEntry(entries)?.value).toBe(107);
  });
  it("sin entradas → null", () => {
    expect(latestEntry([])).toBeNull();
  });
});

describe("bestEntry", () => {
  it("peso: el valor máximo", () => {
    const entries = [
      e(1, 100, "2026-01-01"),
      e(2, 112, "2026-02-01"),
      e(3, 108, "2026-03-01"),
    ];
    expect(bestEntry("weight", entries)?.value).toBe(112);
  });
  it("tiempo: el valor mínimo (más rápido)", () => {
    const entries = [
      e(1, 250, "2026-01-01"),
      e(2, 225, "2026-02-01"),
      e(3, 240, "2026-03-01"),
    ];
    expect(bestEntry("time", entries)?.value).toBe(225);
  });
  it("empate: gana la más antigua (primer récord)", () => {
    const entries = [e(1, 110, "2026-01-01"), e(2, 110, "2026-03-01")];
    expect(bestEntry("weight", entries)?.id).toBe(1);
  });
});

describe("latestChange (¿la última mejora respecto a la anterior?)", () => {
  it("peso subiendo → mejora", () => {
    const c = latestChange("weight", [
      e(1, 105, "2026-01-01"),
      e(2, 110, "2026-02-01"),
    ]);
    expect(c).toEqual({ delta: 5, better: true });
  });
  it("peso bajando → empeora", () => {
    const c = latestChange("weight", [
      e(1, 110, "2026-01-01"),
      e(2, 107, "2026-02-01"),
    ]);
    expect(c).toEqual({ delta: -3, better: false });
  });
  it("tiempo bajando → mejora (más rápido)", () => {
    const c = latestChange("time", [
      e(1, 250, "2026-01-01"),
      e(2, 225, "2026-02-01"),
    ]);
    expect(c?.better).toBe(true);
    expect(c?.delta).toBe(-25);
  });
  it("compara la última con la INMEDIATAMENTE anterior, no con el récord", () => {
    // récord histórico = 112, pero la última (108) mejora respecto a la anterior (105).
    const c = latestChange("weight", [
      e(1, 100, "2026-01-01"),
      e(2, 112, "2026-02-01"),
      e(3, 105, "2026-03-01"),
      e(4, 108, "2026-04-01"),
    ]);
    expect(c).toEqual({ delta: 3, better: true });
  });
  it("<2 entradas o sin cambio → null", () => {
    expect(latestChange("weight", [e(1, 100, "2026-01-01")])).toBeNull();
    expect(
      latestChange("weight", [
        e(1, 100, "2026-01-01"),
        e(2, 100, "2026-02-01"),
      ]),
    ).toBeNull();
  });
});

describe("percentOf (calculadora de marcas de peso)", () => {
  it("85 % de 110 = 93,5 (AC 4)", () => {
    expect(percentOf(110, 85)).toBe(93.5);
  });
  it("70 % de 100 = 70", () => {
    expect(percentOf(100, 70)).toBe(70);
  });
});

describe("marksByRecency (carril «recientes» del Historial, F04)", () => {
  const mk = (id: number, name: string, dates: string[]) => ({
    id,
    name,
    entries: dates.map((d, i) => e(id * 100 + i, 100 + i, d)),
  });

  it("ordena por la fecha de la ÚLTIMA entrada, más reciente primero", () => {
    const marks = [
      mk(1, "Snatch", ["2026-01-01", "2026-03-10"]),
      mk(2, "Squat", ["2026-06-20"]),
      mk(3, "Fran", ["2026-02-01", "2026-05-05"]),
    ];
    expect(marksByRecency(marks).map((m) => m.name)).toEqual([
      "Squat", // 2026-06-20
      "Fran", // 2026-05-05
      "Snatch", // 2026-03-10
    ]);
  });

  it("las marcas sin entradas van al final", () => {
    const marks = [
      mk(1, "Vacía", []),
      mk(2, "Reciente", ["2026-07-01"]),
    ];
    expect(marksByRecency(marks).map((m) => m.name)).toEqual([
      "Reciente",
      "Vacía",
    ]);
  });

  it("empate de fecha → gana la entrada registrada después (id mayor)", () => {
    const a = { id: 1, name: "A", entries: [e(10, 100, "2026-05-01")] };
    const b = { id: 2, name: "B", entries: [e(20, 100, "2026-05-01")] };
    expect(marksByRecency([a, b]).map((m) => m.name)).toEqual(["B", "A"]);
  });

  it("no muta el array de entrada", () => {
    const marks = [mk(1, "A", ["2026-01-01"]), mk(2, "B", ["2026-02-01"])];
    const copy = [...marks];
    marksByRecency(marks);
    expect(marks).toEqual(copy);
  });
});

describe("latestRecordPercentage", () => {
  it("usa última/récord cuando un valor mayor es mejor", () => {
    const entries = [
      e(1, 110, "2026-01-01"),
      e(2, 100, "2026-02-01"),
    ];
    expect(latestRecordPercentage("weight", entries)).toBeCloseTo(90.91, 2);
  });

  it("invierte a récord/última cuando un tiempo menor es mejor", () => {
    const entries = [
      e(1, 300, "2026-01-01"),
      e(2, 330, "2026-02-01"),
    ];
    expect(latestRecordPercentage("time", entries)).toBeCloseTo(90.91, 2);
  });

  it("devuelve 100 cuando la última entrada es el récord", () => {
    expect(latestRecordPercentage("reps", [e(1, 12, "2026-01-01")])).toBe(100);
  });
});

describe("doubleReference (calculadora doble última/récord, F04)", () => {
  it("récord por encima de la última → distintas (dos referencias)", () => {
    // récord 110 (feb) por encima de la última 103 (abr) → distinct.
    const entries = [
      e(1, 100, "2026-01-01"),
      e(2, 110, "2026-02-01"),
      e(3, 103, "2026-04-01"),
    ];
    expect(doubleReference("weight", entries)).toEqual({
      last: 103,
      record: 110,
      distinct: true,
    });
  });
  it("la última ES el récord → una sola línea (distinct false)", () => {
    const entries = [e(1, 100, "2026-01-01"), e(2, 112, "2026-02-01")];
    expect(doubleReference("weight", entries)).toEqual({
      last: 112,
      record: 112,
      distinct: false,
    });
  });
  it("una sola entrada → una sola línea", () => {
    expect(doubleReference("weight", [e(1, 103, "2026-01-01")])).toEqual({
      last: 103,
      record: 103,
      distinct: false,
    });
  });
  it("aplicando % a ambas: 85 % de 103 = 87,55 y de 110 = 93,5 (AC 1)", () => {
    const ref = doubleReference("weight", [
      e(1, 110, "2026-02-01"),
      e(2, 103, "2026-04-01"),
    ])!;
    expect(percentOf(ref.last, 85)).toBeCloseTo(87.55, 5);
    expect(percentOf(ref.record, 85)).toBe(93.5);
  });
  it("sin entradas → null", () => {
    expect(doubleReference("weight", [])).toBeNull();
  });
});

describe("tiempo: parse/format mm:ss", () => {
  it("parsea m:ss y h:mm:ss", () => {
    expect(parseTimeToSeconds("3:45")).toBe(225);
    expect(parseTimeToSeconds("1:00:00")).toBe(3600);
    expect(parseTimeToSeconds("0:30")).toBe(30);
  });
  it("parsea un número suelto como segundos", () => {
    expect(parseTimeToSeconds("90")).toBe(90);
  });
  it("cadena inválida → null", () => {
    expect(parseTimeToSeconds("")).toBeNull();
    expect(parseTimeToSeconds("abc")).toBeNull();
    expect(parseTimeToSeconds("1:2:3:4")).toBeNull();
  });
  it("formatea segundos a mm:ss y h:mm:ss", () => {
    expect(formatSeconds(225)).toBe("3:45");
    expect(formatSeconds(3600)).toBe("1:00:00");
    expect(formatSeconds(3661)).toBe("1:01:01");
  });
  it("round-trip parse→format", () => {
    expect(formatSeconds(parseTimeToSeconds("12:07") as number)).toBe("12:07");
  });
});

describe("parseMarkValue / markValueToInput", () => {
  it("tiempo: acepta mm:ss y devuelve segundos", () => {
    expect(parseMarkValue("time", "3:45")).toBe(225);
    expect(markValueToInput("time", 225)).toBe("3:45");
  });
  it("peso: acepta coma decimal", () => {
    expect(parseMarkValue("weight", "93,5")).toBe(93.5);
    expect(markValueToInput("weight", 93.5)).toBe("93.5");
  });
  it("valor inválido o negativo → null", () => {
    expect(parseMarkValue("weight", "")).toBeNull();
    expect(parseMarkValue("weight", "abc")).toBeNull();
    expect(parseMarkValue("reps", "-3")).toBeNull();
  });
});

describe("formatMarkValue", () => {
  it("tiempo → mm:ss (ignora la unidad)", () => {
    expect(formatMarkValue("time", 225, "min")).toBe("3:45");
  });
  it("peso/reps/distancia → número + unidad, sin ceros de cola", () => {
    expect(formatMarkValue("weight", 110, "kg")).toBe("110 kg");
    expect(formatMarkValue("weight", 93.5, "kg")).toBe("93,5 kg");
    expect(formatMarkValue("reps", 20, "reps")).toBe("20 reps");
    expect(formatMarkValue("distance", 5, "km")).toBe("5 km");
  });
});
