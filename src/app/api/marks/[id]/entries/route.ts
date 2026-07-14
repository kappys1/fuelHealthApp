import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { markEntryCreateZ } from "@/lib/schemas";
import { addMarkEntry } from "@/server/db/queries/marks";

function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// F03 · Añadir una entrada fechada a una marca (fecha libre: entrada retroactiva).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const { id: idParam } = await params;
  const markId = parseId(idParam);
  if (markId == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, markEntryCreateZ);
  if ("error" in parsed) return parsed.error;

  try {
    const entry = await retry(() =>
      addMarkEntry({
        markId,
        value: parsed.data.value,
        recordedOn: parsed.data.recordedOn,
        note: parsed.data.note ?? null,
      }),
    );
    return Response.json({ entry });
  } catch (err) {
    return serverError(err);
  }
}
