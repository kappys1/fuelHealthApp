import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { markCreateZ } from "@/lib/schemas";
import { createMark, listMarksWithEntries } from "@/server/db/queries/marks";

// F03 · Marcas — crear una marca (nombre libre + tipo de medida + unidad).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, markCreateZ);
  if ("error" in parsed) return parsed.error;

  try {
    const row = await retry(() => createMark(parsed.data));
    return Response.json({ id: row.id });
  } catch (err) {
    return serverError(err);
  }
}

// Refetch de todas las marcas con sus entradas tras mutar.
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    const marks = await retry(() => listMarksWithEntries());
    return Response.json({ marks });
  } catch (err) {
    return serverError(err);
  }
}
