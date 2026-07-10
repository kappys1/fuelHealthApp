import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import {
  getSessionByWeekday,
  SESSION_MAP_KEY,
  setSetting,
} from "@/server/db/queries/lookups";

// GET /api/settings/session-map → mapeo día-semana → sesión (con defaults).
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    return Response.json({ map: await getSessionByWeekday() });
  } catch (err) {
    return serverError(err);
  }
}

const bodyZ = z.object({
  map: z.record(z.enum(["1", "2", "3", "4", "5", "6", "7"]), z.string().max(200)),
});

// PATCH /api/settings/session-map → guardar el mapeo (09 §5, Ajustes).
export async function PATCH(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    await setSetting(SESSION_MAP_KEY, parsed.data.map);
    return Response.json({ map: await getSessionByWeekday() });
  } catch (err) {
    return serverError(err);
  }
}
