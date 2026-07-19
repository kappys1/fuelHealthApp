import { describe, expect, it } from "vitest";
import { caloricContribution } from "./intake";

describe("caloricContribution (Atwater P×4/C×4/F×9)", () => {
  it("reparte las kcal por macro y suma el total", () => {
    const c = caloricContribution(40, 60, 20);
    expect(c.protKcal).toBe(160);
    expect(c.carbKcal).toBe(240);
    expect(c.fatKcal).toBe(180);
    expect(c.totalKcal).toBe(580);
  });

  it("cero macros → cero", () => {
    const c = caloricContribution(0, 0, 0);
    expect(c.totalKcal).toBe(0);
  });

  it("respeta decimales de gramos (se redondea en UI, no aquí)", () => {
    const c = caloricContribution(46.5, 0, 5.2);
    expect(c.protKcal).toBeCloseTo(186, 6);
    expect(c.fatKcal).toBeCloseTo(46.8, 6);
  });
});
