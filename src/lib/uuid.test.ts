import { describe, expect, it } from "vitest";
import { randomUUID } from "./uuid";

describe("randomUUID · compatibilidad con contexto no seguro", () => {
  it("usa randomUUID nativo cuando el navegador lo expone", () => {
    const expected = "f05ccbb7-0de2-47b5-bbe9-169d17487633";

    expect(
      randomUUID({
        randomUUID: () => expected,
        getRandomValues: () => {
          throw new Error("No debe usar el fallback si hay nativo");
        },
      }),
    ).toBe(expected);
  });

  it("genera un UUID v4 válido por fallback si falta randomUUID (http/LAN)", () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    const insecureCrypto = {
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        if (array instanceof Uint8Array) array.set(bytes);
        return array;
      },
    };

    expect(() => randomUUID(insecureCrypto)).not.toThrow();
    expect(randomUUID(insecureCrypto)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
