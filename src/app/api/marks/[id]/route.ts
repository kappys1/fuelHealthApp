import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { markPatchZ } from "@/lib/schemas";
import { deleteMark, updateMark } from "@/server/db/queries/marks";

function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// F11 · Editar la marca (nombre y/o familia; optimista con revert en UI). NO toca
// measureType/unit. Molde del PATCH de /api/marks/entries/[id].
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, markPatchZ);
  if ("error" in parsed) return parsed.error;

  try {
    await retry(() => updateMark(id, parsed.data));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
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
