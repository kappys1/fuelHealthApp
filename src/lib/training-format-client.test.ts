import { describe, expect, it } from "vitest";
import type { TrainingFormatOutcome } from "@/lib/training";
import { formatNotice, formatOrKeep } from "./training-format-client";

const ok = (contenido: string, groups: number): TrainingFormatOutcome => ({
  contenido,
  applied: true,
  groups,
  reason: null,
});

describe("formatOrKeep · F25 · nunca bloquea (AC10)", () => {
  it("devuelve el texto marcado cuando la IA responde", async () => {
    const out = await formatOrKeep("Power Clean\n5 × 2", async () =>
      ok("**Power Clean**\n5 × 2", 1),
    );

    expect(out.contenido).toBe("**Power Clean**\n5 × 2");
    expect(out.applied).toBe(true);
  });

  it("si la llamada falla, conserva el original y explica por qué", async () => {
    const out = await formatOrKeep("Power Clean\n5 × 2", () => {
      throw new Error("IA: 503 sin capacidad");
    });

    expect(out.contenido).toBe("Power Clean\n5 × 2");
    expect(out.applied).toBe(false);
    expect(out.reason).toBe("IA: 503 sin capacidad");
  });

  it("si se aborta por tiempo, lo dice con sus palabras", async () => {
    const out = await formatOrKeep("Power Clean", (_text, signal) => {
      // Simula el techo de FORMAT_TIMEOUT_MS sin tener que esperarlo.
      Object.defineProperty(signal, "aborted", { value: true });
      throw new Error("The operation was aborted.");
    });

    expect(out.contenido).toBe("Power Clean");
    expect(out.reason).toBe(
      "El formateo tardó demasiado; se ha guardado el texto tal cual.",
    );
  });

  it("no llama a la IA con un contenido vacío, y eso no es un fallo", async () => {
    let called = false;
    const out = await formatOrKeep("   ", async () => {
      called = true;
      return ok("x", 0);
    });

    expect(called).toBe(false);
    expect(out.applied).toBe(false);
    expect(out.reason).toBeNull();
  });
});

describe("formatNotice · qué merece aviso", () => {
  it("calla cuando todo se aplicó", () => {
    expect(formatNotice([ok("a", 2), ok("b", 0)])).toBeNull();
  });

  // Que la IA no vea grupos NO es un fallo: hay sesiones sin estructura que
  // marcar. Avisar de eso sería ruido en cada import.
  it("calla cuando simplemente no había grupos que marcar", () => {
    expect(
      formatNotice([{ contenido: "a", applied: false, groups: 0, reason: null }]),
    ).toBeNull();
  });

  it("da el motivo real cuando falla una sola sesión", () => {
    expect(
      formatNotice([
        ok("a", 1),
        { contenido: "b", applied: false, groups: 0, reason: "IA: timeout" },
      ]),
    ).toBe("IA: timeout");
  });

  it("resume cuando fallan varias", () => {
    const failed = {
      contenido: "x",
      applied: false,
      groups: 0,
      reason: "IA: 503",
    };
    expect(formatNotice([failed, failed, ok("c", 1)])).toBe(
      "2 sesiones se han guardado sin formato.",
    );
  });
});
