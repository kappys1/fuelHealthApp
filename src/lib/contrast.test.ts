import { describe, expect, it } from "vitest";
import { audit, ratio, TOKENS } from "./contrast";

describe("contraste de tokens (05-DISENO §2, WCAG AA)", () => {
  it("todos los pares texto/relleno cumplen su umbral en ambos temas", () => {
    const { rows, failures } = audit();
    const broken = rows
      .filter((r) => r.gating && !r.ok)
      .map((r) => `${r.theme}: ${r.label} = ${r.ratio.toFixed(2)}:1 (<${r.min})`);
    expect(broken, broken.join("; ")).toEqual([]);
    expect(failures).toBe(0);
  });

  it("el par del botón primario es de alto contraste en ambos temas", () => {
    expect(
      ratio(TOKENS.light["primary-fg"], TOKENS.light.primary),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      ratio(TOKENS.dark["primary-fg"], TOKENS.dark.primary),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("el texto atenuado es legible sobre el fondo en oscuro (bug histórico)", () => {
    // Regresión: --muted-foreground NO debe resolver a --surface-2.
    expect(ratio(TOKENS.dark.muted, TOKENS.dark.bg)).toBeGreaterThanOrEqual(4.5);
    expect(TOKENS.dark.muted).not.toBe(TOKENS.dark["surface-2"]);
  });
});
