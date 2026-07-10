import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { optionZ } from "@/lib/schemas";
import { deletePlanOption, updatePlanOption } from "@/server/db/queries/mutations";

const patchZ = optionZ.partial();

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/plan/options/:id → editar opción (F1.3).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const id = parseId((await params).id);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, patchZ);
  if ("error" in parsed) return parsed.error;

  try {
    const row = await updatePlanOption(id, parsed.data);
    if (!row) return badRequest("Opción no encontrada.");
    return Response.json({ option: row });
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/plan/options/:id → borrar opción (F1.3, confirmación en cliente).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const id = parseId((await params).id);
  if (id == null) return badRequest("Id inválido.");

  try {
    await deletePlanOption(id);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
