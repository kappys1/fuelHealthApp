import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { dateZ } from "@/lib/schemas";
import {
  reassignTrainingSession,
  TrainingAssignmentConflictError,
} from "@/server/db/queries/training";

// doc 10 B3b · Reasignar una sesión a otro día (o desasignar con null).
function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const bodyZ = z.object({ date: dateZ.nullable() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    await reassignTrainingSession(id, parsed.data.date);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof TrainingAssignmentConflictError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    return serverError(err);
  }
}
