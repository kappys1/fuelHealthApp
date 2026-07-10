import type { z } from "zod";
import { getSession } from "./session";

/** Guardia de sesión para API routes (defensa en profundidad sobre el proxy). */
export async function ensureAuth(): Promise<Response | null> {
  const session = await getSession();
  if (!session.authenticated) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  return null;
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function serverError(err: unknown): Response {
  const message = err instanceof Error ? err.message : "Error del servidor.";
  return Response.json({ error: message }, { status: 500 });
}

/** Parsea y valida el body JSON contra un schema Zod. */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: badRequest("Cuerpo JSON inválido.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: badRequest("Datos inválidos.") };
  }
  return { data: parsed.data };
}
