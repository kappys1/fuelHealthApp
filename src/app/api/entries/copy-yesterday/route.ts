import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { shiftDayKey } from "@/lib/dates";
import { dateZ } from "@/lib/schemas";
import { copyEntriesFrom } from "@/server/db/queries/mutations";

const bodyZ = z.object({ date: dateZ });

// POST /api/entries/copy-yesterday → duplica las entradas del día anterior (F2.5).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    const from = shiftDayKey(parsed.data.date, -1);
    const rows = await copyEntriesFrom(from, parsed.data.date);
    return Response.json({ entries: rows, copied: rows.length, from });
  } catch (err) {
    return serverError(err);
  }
}
