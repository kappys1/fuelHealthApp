import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { bloatEventPatchZ } from "@/lib/schemas";
import {
  deleteBloatEvent,
  updateBloatEvent,
} from "@/server/db/queries/bloat";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  const id = parseId((await params).id);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, bloatEventPatchZ);
  if ("error" in parsed) return parsed.error;
  try {
    const event = await updateBloatEvent(id, parsed.data);
    if (!event) return badRequest("Marcador no encontrado.");
    return Response.json({ event });
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
  const id = parseId((await params).id);
  if (id == null) return badRequest("Id inválido.");

  try {
    const event = await deleteBloatEvent(id);
    return Response.json({ event });
  } catch (err) {
    return serverError(err);
  }
}
