import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { trainingSlotZ } from "@/lib/schemas";
import {
  getTrainingByWeekday,
  getTrainingByWeekdayReviewed,
  setTrainingByWeekday,
} from "@/server/db/queries/lookups";
import { z } from "zod";

// GET /api/settings/session-map → mapeo día-semana → sesión (con defaults).
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    const [map, reviewed] = await Promise.all([
      getTrainingByWeekday(),
      getTrainingByWeekdayReviewed(),
    ]);
    return Response.json({ map, reviewed });
  } catch (err) {
    return serverError(err);
  }
}

const bodyZ = z.object({
  map: z.record(
    z.enum(["1", "2", "3", "4", "5", "6", "7"]),
    trainingSlotZ,
  ),
});

// PATCH /api/settings/session-map → guardar el mapeo (09 §5, Ajustes).
export async function PATCH(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    await setTrainingByWeekday(parsed.data.map);
    return Response.json({
      map: await getTrainingByWeekday(),
      reviewed: true,
    });
  } catch (err) {
    return serverError(err);
  }
}
