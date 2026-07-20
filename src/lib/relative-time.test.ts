import { describe, expect, it } from "vitest";
import { relativeDate } from "./relative-time";

const NOW = "2026-07-20T12:00:00.000Z";

describe("relativeDate", () => {
  it("formatea minutos, horas, ayer y días recientes", () => {
    expect(relativeDate("2026-07-20T11:58:00.000Z", NOW)).toBe("Hace 2 min");
    expect(relativeDate("2026-07-20T09:00:00.000Z", NOW)).toBe("Hace 3 h");
    expect(relativeDate("2026-07-19T11:00:00.000Z", NOW)).toBe("Ayer");
    expect(relativeDate("2026-07-17T12:00:00.000Z", NOW)).toBe("Hace 3 d");
  });

  it("usa fecha corta para hilos antiguos y declara fechas inválidas", () => {
    expect(relativeDate("2026-06-10T12:00:00.000Z", NOW)).toContain("10 jun");
    expect(relativeDate("no-date", NOW)).toBe("Fecha desconocida");
  });
});
