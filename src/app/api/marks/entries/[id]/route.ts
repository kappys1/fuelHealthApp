import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { markEntryPatchZ } from "@/lib/schemas";
import { deleteMarkEntry, updateMarkEntry } from "@/server/db/queries/marks";

function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// F03 · Editar una entrada (optimista con undo en UI). La ruta estática `entries`
// convive con la dinámica `[id]` de /api/marks (Next resuelve la estática primero).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, markEntryPatchZ);
  if ("error" in parsed) return parsed.error;

  try {
    await retry(() => updateMarkEntry(id, parsed.data));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}

// F03 · Borrar una entrada (optimista con undo en UI — el undo re-crea la entrada).
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
    await retry(() => deleteMarkEntry(id));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
