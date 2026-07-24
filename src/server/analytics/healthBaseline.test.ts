import { describe, expect, it } from "vitest";
import {
  buildHealthBaseline,
  type BaselineHealthRow,
} from "./healthBaseline";

const row = (
  values: Partial<BaselineHealthRow> = {},
): BaselineHealthRow => ({
  hrvMs: null,
  restingHr: null,
  sleepH: null,
  steps: null,
  ...values,
});

describe("buildHealthBaseline", () => {
  it("calcula el delta del valor crudo contra los 30 días anteriores", () => {
    const out = buildHealthBaseline({
      current: row({ hrvMs: 58, restingHr: 48, sleepH: 8, steps: 12_000 }),
      history: [
        row({ hrvMs: 50, restingHr: 50, sleepH: 7, steps: 8_000 }),
        row({ hrvMs: 54, restingHr: 52, sleepH: 7.5, steps: 10_000 }),
      ],
      from: "2026-06-20",
      to: "2026-07-19",
    });

    expect(out.metrics.hrvMs).toEqual({
      current: 58,
      average30d: 52,
      delta: 6,
      sampleCount: 2,
    });
    expect(out.metrics.restingHr.delta).toBe(-3);
    expect(out.metrics.sleepH.delta).toBeCloseTo(0.75);
    expect(out.metrics.steps.delta).toBe(3_000);
  });

  it("conserva sueño crudo 0 pero lo excluye de la media histórica", () => {
    const out = buildHealthBaseline({
      current: row({ sleepH: 0 }),
      history: [row({ sleepH: 0 }), row({ sleepH: -1 }), row({ sleepH: 7 })],
      from: "2026-06-20",
      to: "2026-07-19",
    });

    expect(out.metrics.sleepH).toEqual({
      current: 0,
      average30d: 7,
      delta: null,
      sampleCount: 1,
    });
  });

  it("no inventa medias ni deltas cuando faltan muestras", () => {
    const out = buildHealthBaseline({
      current: row({ hrvMs: 61 }),
      history: [],
      from: "2026-06-20",
      to: "2026-07-19",
    });

    expect(out.metrics.hrvMs).toEqual({
      current: 61,
      average30d: null,
      delta: null,
      sampleCount: 0,
    });
    expect(out.metrics.steps.current).toBeNull();
  });
});
