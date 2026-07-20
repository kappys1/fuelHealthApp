import { describe, expect, it, vi } from "vitest";
import {
  persistedTextStreamResponse,
  verifiedTextDeltas,
} from "./persisted-text-stream";

async function* chunks(values: string[], failure?: Error) {
  for (const value of values) yield value;
  if (failure) throw failure;
}

describe("persistedTextStreamResponse", () => {
  it("solo completa el stream después de persistir el texto entero", async () => {
    const onComplete = vi.fn(async () => undefined);
    const onError = vi.fn(async () => undefined);
    const response = persistedTextStreamResponse({
      deltas: chunks(["Hola", " Alex"]),
      onComplete,
      onError,
    });

    await expect(response.text()).resolves.toBe("Hola Alex");
    expect(onComplete).toHaveBeenCalledWith("Hola Alex");
    expect(onError).not.toHaveBeenCalled();
  });

  it("propaga un stream parcial como error y libera el turno", async () => {
    const failure = new Error("provider disconnected");
    const onComplete = vi.fn(async () => undefined);
    const onError = vi.fn(async () => undefined);
    const response = persistedTextStreamResponse({
      deltas: chunks(["Respuesta parcial"], failure),
      onComplete,
      onError,
    });

    await expect(response.text()).rejects.toThrow("provider disconnected");
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it("convierte una parte error del AI SDK en fallo aunque ya hubiera deltas", async () => {
    async function* parts() {
      yield { type: "text-delta", text: "Respuesta parcial" };
      yield { type: "error", error: new Error("provider error part") };
    }
    const response = persistedTextStreamResponse({
      deltas: verifiedTextDeltas(parts()),
      onComplete: vi.fn(async () => undefined),
      onError: vi.fn(async () => undefined),
    });

    await expect(response.text()).rejects.toThrow("provider error part");
  });
});
