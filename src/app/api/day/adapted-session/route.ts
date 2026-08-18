import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { adaptedSessionSaveZ, adaptedSessionUndoZ } from "@/lib/schemas";
import {
  AdaptedSessionUndoConflictError,
  saveAdaptedSession,
  undoAdaptedSession,
} from "@/server/db/queries/mutations";

/*
  F26 Fase 2 · la sesión adaptada del día. Una sola puerta de guardado con tres
  orígenes (botón de la ficha, Chat en Fase 3, edición a mano) y un solo destino:
  `days.adapted_*`. NUNCA escribe en `training_sessions` (AC9).
*/

/** POST → guarda o pisa la adaptada; devuelve la foto anterior para deshacer. */
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, adaptedSessionSaveZ);
  if ("error" in parsed) return parsed.error;

  try {
    return Response.json(await saveAdaptedSession(parsed.data));
  } catch (error) {
    return serverError(error);
  }
}

/** PUT → deshacer inmediato del snapshot devuelto por POST (AC10). */
export async function PUT(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, adaptedSessionUndoZ);
  if ("error" in parsed) return parsed.error;

  try {
    await undoAdaptedSession(parsed.data);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AdaptedSessionUndoConflictError) {
      return badRequest(error.message);
    }
    return serverError(error);
  }
}
