import { badRequest, ensureAuth, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { deleteMark } from "@/server/db/queries/marks";

function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// F03 · Borrar una marca ENTERA (cascade a sus entradas). Confirmación en UI (07).
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
    await retry(() => deleteMark(id));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
