import { APICallError } from "ai";

/*
  Errores de IA SIEMPRE visibles (02-ARQUITECTURA §3.6, CLAUDE.md): el usuario ve
  el mensaje del proveedor + el HTTP status. Nunca fallo silencioso.
*/

export class AiParseError extends Error {
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message);
    this.name = "AiParseError";
  }
}

interface AiErrorInfo {
  /** Mensaje visible (proveedor + contexto). */
  message: string;
  /** Status HTTP a devolver por nuestra route. */
  status: number;
}

export function describeAiError(err: unknown): AiErrorInfo {
  // Error del proveedor (HTTP no-2xx, rate-limit, key inválida…).
  if (APICallError.isInstance(err)) {
    const providerStatus = err.statusCode;
    const detail = extractProviderMessage(err) ?? err.message;
    const status =
      typeof providerStatus === "number" && providerStatus >= 400 && providerStatus < 600
        ? providerStatus
        : 502;
    return {
      message: `IA: ${detail} (proveedor HTTP ${providerStatus ?? "?"})`,
      status,
    };
  }
  // La respuesta no era JSON válido / no cuadró con el schema tras el reintento.
  if (err instanceof AiParseError) {
    return { message: `IA: ${err.message}`, status: 502 };
  }
  if (err instanceof Error) {
    return { message: `IA: ${err.message}`, status: 500 };
  }
  return { message: "IA: error desconocido.", status: 500 };
}

export function aiErrorResponse(err: unknown): Response {
  const { message, status } = describeAiError(err);
  return Response.json({ error: message }, { status });
}

/** Intenta sacar el mensaje humano del cuerpo de error del proveedor. */
function extractProviderMessage(err: APICallError): string | null {
  const body = err.responseBody;
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    /* cuerpo no-JSON: se usa err.message */
  }
  return null;
}
