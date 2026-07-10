import { badRequest, ensureAuth, serverError } from "@/lib/api";
import { deleteTemplate } from "@/server/db/queries/mutations";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// DELETE /api/templates/:id → borrar plantilla (F2.6, confirmación en cliente).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const id = parseId((await params).id);
  if (id == null) return badRequest("Id inválido.");

  try {
    await deleteTemplate(id);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
