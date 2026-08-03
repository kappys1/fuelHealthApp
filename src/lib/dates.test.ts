import { describe, expect, it } from "vitest";
import {
  dayKey,
  endOfMonthKey,
  isDayKey,
  monthKeyOf,
  monthLabel,
  selectedDay,
  shiftMonthKey,
  startOfMonthKey,
} from "./dates";

describe("dayKey (Europe/Madrid)", () => {
  it("invierno: 23:30 UTC ya es el día siguiente en Madrid (UTC+1)", () => {
    expect(dayKey(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-02");
  });

  it("verano: 22:30 UTC ya es el día siguiente en Madrid (UTC+2)", () => {
    expect(dayKey(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });

  it("mediodía UTC cae en el mismo día natural", () => {
    expect(dayKey(new Date("2026-07-09T12:00:00Z"))).toBe("2026-07-09");
  });

  it("NO coincide con la clave ingenua en UTC de fin de día", () => {
    const instant = new Date("2026-07-01T22:30:00Z");
    const naive = instant.toISOString().slice(0, 10); // 2026-07-01 (mal)
    expect(dayKey(instant)).not.toBe(naive);
  });
});

describe("meses naturales (F22 · trayectoria)", () => {
  it("cierra el mes por su último día real, incluidos febrero y bisiestos", () => {
    expect(endOfMonthKey("2026-02")).toBe("2026-02-28");
    expect(endOfMonthKey("2024-02")).toBe("2024-02-29");
    expect(endOfMonthKey("2026-07")).toBe("2026-07-31");
    expect(endOfMonthKey("2026-06")).toBe("2026-06-30");
  });

  it("retrocede meses cruzando el cambio de año", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-01", -13)).toBe("2024-12");
    expect(shiftMonthKey("2026-08", -3)).toBe("2026-05");
  });

  it("deriva mes, primer día y rótulo desde una clave de día", () => {
    expect(monthKeyOf("2026-08-03")).toBe("2026-08");
    expect(startOfMonthKey("2026-08-03")).toBe("2026-08-01");
    expect(monthLabel("2026-07")).toBe("jul");
  });
});

describe("navegación de días", () => {
  it("rechaza fechas de calendario imposibles aunque cumplan el patrón", () => {
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2026-07-20")).toBe(true);
  });

  it("limita URL futuras o inválidas al día actual", () => {
    expect(selectedDay("2026-07-19", "2026-07-20")).toBe("2026-07-19");
    expect(selectedDay("2026-07-21", "2026-07-20")).toBe("2026-07-20");
    expect(selectedDay("2026-02-29", "2026-07-20")).toBe("2026-07-20");
  });
});
