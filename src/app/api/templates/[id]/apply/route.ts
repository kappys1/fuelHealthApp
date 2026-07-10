import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { dateZ } from "@/lib/schemas";
import { applyTemplate } from "@/server/db/queries/mutations";

const bodyZ = z.object({ date: dateZ });

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// POST /api/templates/:id/apply → añade (no reemplaza) los items al día (F2.6).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const id = parseId((await params).id);
  if (id == null) return badRequest("Id inválido.");

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    const rows = await applyTemplate(id, parsed.data.date);
    return Response.json({ entries: rows, added: rows.length });
  } catch (err) {
    return serverError(err);
  }
}
