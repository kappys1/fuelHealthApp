import { describe, expect, it } from "vitest";
import {
  effectiveHealthMetric,
  importedHealthIsFallback,
} from "./effective-health";

describe("precedencia manual sobre Health", () => {
  it("conserva el valor manual cuando ambas fuentes tienen dato", () => {
    expect(effectiveHealthMetric(91.2, 92.6)).toBe(91.2);
    expect(importedHealthIsFallback(91.2, 92.6)).toBe(false);
  });

  it("usa Health solo para rellenar un hueco manual", () => {
    expect(effectiveHealthMetric(null, 92.6)).toBe(92.6);
    expect(importedHealthIsFallback(null, 92.6)).toBe(true);
  });

  it("preserva cero como dato manual explícito", () => {
    expect(effectiveHealthMetric(0, 2.4)).toBe(0);
    expect(importedHealthIsFallback(0, 2.4)).toBe(false);
  });
});
