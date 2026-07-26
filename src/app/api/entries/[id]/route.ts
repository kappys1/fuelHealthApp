import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { mealZ, productUnitZ } from "@/lib/schemas";
import { deleteEntry, updateEntry } from "@/server/db/queries/mutations";

const patchZ = z
  .object({
    meal: mealZ,
    name: z.string().min(1).max(600),
    kcal: z.number().int().min(0).max(20000),
    prot: z.number().min(0).max(2000),
    carb: z.number().min(0).max(2000),
    fat: z.number().min(0).max(2000),
    // Cantidad editada (F06): reescala kcal/macros desde la base inmutable.
    grams: z.number().int().min(0).max(20000).nullable(),
    unit: productUnitZ,
    // Base (F14 · Parte A): normalmente inmutable, pero al editar una entrada del
    // caso 2 (con gramos, sin base) el editor deriva y persiste la base efectiva
    // → la entrada queda «sanada» y la próxima edición es caso 1 nativo.
    baseG: z.number().int().min(0).max(20000).nullable(),
    baseKcal: z.number().int().min(0).max(20000).nullable(),
    baseProt: z.number().min(0).max(2000).nullable(),
    baseCarb: z.number().min(0).max(2000).nullable(),
    baseFat: z.number().min(0).max(2000).nullable(),
  })
  .partial();

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/entries/:id → edición en línea (F2.9).
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
    const row = await updateEntry(id, parsed.data);
    if (!row) return badRequest("Entrada no encontrada.");
    return Response.json({ entry: row });
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/entries/:id → borrar (undo del lado cliente, 07 §2).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const id = parseId((await params).id);
  if (id == null) return badRequest("Id inválido.");

  try {
    const row = await deleteEntry(id);
    if (!row) return badRequest("Entrada no encontrada.");
    return Response.json({ entry: row });
  } catch (err) {
    return serverError(err);
  }
}
