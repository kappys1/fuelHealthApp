import { describe, expect, it } from "vitest";
import { energyBalance } from "./energyBalance";

describe("energyBalance (ingesta − gasto, contexto ±25 %)", () => {
  it("14-jul: día de entreno → déficit pese a pasarse del objetivo de ingesta", () => {
    const b = energyBalance({
      intakeKcal: 1987,
      basalKcal: 1800,
      activeKcal: 950,
      sessionKcal: 600,
    });
    expect(b.basis).toBe("watch");
    expect(b.expenditureKcal).toBe(2750); // basal + activas (NO suma la sesión → sin doble conteo)
    expect(b.balanceKcal).toBe(1987 - 2750); // −763 = déficit real del día
    expect(b.breakdown).toBe("basal 1800 + activas 950");
  });

  it("sin activas del reloj: usa la sesión estimada como sustituto", () => {
    const b = energyBalance({
      intakeKcal: 1987,
      basalKcal: 1800,
      activeKcal: null,
      sessionKcal: 600,
    });
    expect(b.basis).toBe("estimate");
    expect(b.expenditureKcal).toBe(2400);
  });

  it("sin datos de gasto → balance null (el coach omite la línea)", () => {
    const b = energyBalance({
      intakeKcal: 1987,
      basalKcal: null,
      activeKcal: null,
      sessionKcal: null,
    });
    expect(b.basis).toBe("none");
    expect(b.balanceKcal).toBeNull();
  });
});
