import { badRequest, ensureAuth, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { productPatchZ } from "@/lib/schemas";
import {
  deleteProduct,
  toggleProductPin,
  updateProduct,
} from "@/server/db/queries/mutations";

function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/products/[id] → editar el producto. `{ togglePin: true }` alterna el
// pin (chip). Editar NO reescribe entradas ya registradas (AC5).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");

  const raw = await request.json().catch(() => null);
  if (raw && typeof raw === "object" && "togglePin" in raw) {
    try {
      return Response.json(await retry(() => toggleProductPin(id)));
    } catch (err) {
      return serverError(err);
    }
  }

  const parsed = productPatchZ.safeParse(raw);
  if (!parsed.success) return badRequest("Datos de producto inválidos.");

  try {
    await retry(() => updateProduct(id, parsed.data));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/products/[id] → borrar el producto del catálogo (no toca entradas).
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
    await retry(() => deleteProduct(id));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
