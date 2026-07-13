import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { trainingTipoZ } from "@/lib/schemas";
import { updateTrainingSession } from "@/server/db/queries/training";

// doc 10 B3b · Editar una sesión del plan (incl. kcal editable).
function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const patchZ = z.object({
  nombre: z.string().min(1).max(200).optional(),
  tipo: trainingTipoZ.optional(),
  contenido: z.string().max(4000).optional(),
  kcalMin: z.number().int().min(0).max(20000).nullable().optional(),
  kcalMax: z.number().int().min(0).max(20000).nullable().optional(),
  duracionMin: z.number().int().min(0).max(1000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, patchZ);
  if ("error" in parsed) return parsed.error;

  try {
    await updateTrainingSession(id, parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
