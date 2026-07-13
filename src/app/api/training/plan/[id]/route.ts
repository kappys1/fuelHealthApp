import { badRequest, ensureAuth, serverError } from "@/lib/api";
import { deleteTrainingPlan } from "@/server/db/queries/training";

// doc 10 B3b · Borrar un plan de entreno (cascade a sesiones; days.session_ref → null).
function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");

  try {
    await deleteTrainingPlan(id);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
