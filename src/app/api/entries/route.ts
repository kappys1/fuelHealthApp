import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dateZ, newEntryZ } from "@/lib/schemas";
import { addEntries } from "@/server/db/queries/mutations";

const bodyZ = z.object({
  date: dateZ,
  entries: z.array(newEntryZ).min(1).max(50),
  clientMutationId: z.uuid().optional(),
});

// POST /api/entries → añade 1..N entradas al día (F2.1/F2.2/F2.8 separado).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    const rows = await addEntries(
      parsed.data.date,
      parsed.data.entries.map((e) => ({ ...e, photoUrl: e.photoUrl ?? null })),
      parsed.data.clientMutationId,
    );
    return Response.json({ entries: rows });
  } catch (err) {
    return serverError(err);
  }
}
