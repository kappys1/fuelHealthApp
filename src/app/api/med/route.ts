import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { medInputZ } from "@/lib/schemas";
import { addMed } from "@/server/db/queries/mutations";
import { listMed } from "@/server/db/queries/med";

// F5.1 · MED — crear medición (fecha libre: entrada retroactiva del histórico).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, medInputZ);
  if ("error" in parsed) return parsed.error;

  try {
    const row = await retry(() => addMed(parsed.data));
    return Response.json({ med: row });
  } catch (err) {
    return serverError(err);
  }
}

// Refetch del historial (con diferencias ya calculadas) tras mutar.
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    const med = await retry(() => listMed());
    return Response.json({ med });
  } catch (err) {
    return serverError(err);
  }
}
