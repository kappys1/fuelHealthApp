import { describe, expect, it } from "vitest";
import { ApiError, isRetriableRequestError } from "./request-errors";

describe("isRetriableRequestError", () => {
  it("reintenta fallos de red y respuestas transitorias", () => {
    expect(isRetriableRequestError(new TypeError("Load failed"))).toBe(true);
    expect(isRetriableRequestError(new ApiError("Servicio no disponible", 503))).toBe(true);
    expect(isRetriableRequestError(new ApiError("Demasiadas peticiones", 429))).toBe(true);
  });

  it("no encola errores de validación, auth o abortos explícitos", () => {
    expect(isRetriableRequestError(new ApiError("Entrada inválida", 400))).toBe(false);
    expect(isRetriableRequestError(new ApiError("No autorizado", 401))).toBe(false);
    expect(isRetriableRequestError(new DOMException("Aborted", "AbortError"))).toBe(false);
  });
});
