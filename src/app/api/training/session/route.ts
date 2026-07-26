import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import {
  canonicalTrainingSessionZ,
  canonicalTrainingUndoZ,
} from "@/lib/schemas";
import {
  CanonicalTrainingUndoConflictError,
  saveCanonicalTrainingSession,
  undoCanonicalTrainingSession,
} from "@/server/db/queries/training";

/** F17 · Mismo comando de persistencia para crear/sustituir desde Plan y Hoy. */
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, canonicalTrainingSessionZ);
  if ("error" in parsed) return parsed.error;

  try {
    return Response.json(await saveCanonicalTrainingSession(parsed.data));
  } catch (error) {
    return serverError(error);
  }
}

/** Undo inmediato del snapshot devuelto por POST. */
export async function PUT(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, canonicalTrainingUndoZ);
  if ("error" in parsed) return parsed.error;

  try {
    await undoCanonicalTrainingSession(parsed.data);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CanonicalTrainingUndoConflictError) {
      return badRequest(error.message);
    }
    return serverError(error);
  }
}
