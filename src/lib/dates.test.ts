import { describe, expect, it } from "vitest";
import { dayKey, isDayKey, selectedDay } from "./dates";

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
