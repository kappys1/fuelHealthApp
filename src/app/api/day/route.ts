import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { bloatZ, dateZ, phaseZ } from "@/lib/schemas";
import { getTodayPayload } from "@/server/db/queries/today";
import { upsertDayFields } from "@/server/db/queries/mutations";

// GET /api/day?date=YYYY-MM-DD → payload agregado de la pantalla Hoy.
export async function GET(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? dayKey();
  if (!dateZ.safeParse(date).success) return badRequest("Fecha inválida.");

  try {
    return Response.json(await retry(() => getTodayPayload(date)));
  } catch (err) {
    return serverError(err);
  }
}

const patchZ = z.object({
  date: dateZ,
  patch: z
    .object({
      weight: z.number().min(0).max(500).nullable(),
      waterL: z.number().min(0).max(20).nullable(),
      bodyFatPct: z.number().min(0).max(100).nullable(),
      sessionLabel: z.string().max(200).nullable(),
      sessionKcal: z.number().int().min(0).max(20000).nullable(),
      sessionRef: z.number().int().min(0).nullable(),
      phase: phaseZ.nullable(),
      bloat: bloatZ.nullable(),
      notes: z.string().max(4000).nullable(),
    })
    .partial(),
});

// PATCH /api/day → autosave de los campos del día (07 §1).
export async function PATCH(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, patchZ);
  if ("error" in parsed) return parsed.error;

  try {
    await upsertDayFields(parsed.data.date, parsed.data.patch);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
