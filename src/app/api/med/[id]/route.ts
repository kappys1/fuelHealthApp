import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { medPatchZ } from "@/lib/schemas";
import { deleteMed, updateMed } from "@/server/db/queries/mutations";

// F5.1 · MED — editar / borrar una medición.
function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, medPatchZ);
  if ("error" in parsed) return parsed.error;

  try {
    const row = await retry(() => updateMed(id, parsed.data));
    if (!row) return badRequest("Medición no encontrada.");
    return Response.json({ med: row });
  } catch (err) {
    return serverError(err);
  }
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
    await retry(() => deleteMed(id));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
