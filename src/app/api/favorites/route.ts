import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { mealZ } from "@/lib/schemas";
import { listFavorites } from "@/server/db/queries/lookups";
import { toggleFavorite } from "@/server/db/queries/mutations";

// GET /api/favorites → lista de favoritos (chips).
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    return Response.json({ favorites: await listFavorites() });
  } catch (err) {
    return serverError(err);
  }
}

const bodyZ = z.object({
  meal: mealZ,
  name: z.string().min(1).max(600),
  kcal: z.number().int().min(0).max(20000),
  prot: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
});

// POST /api/favorites → toggle ★ por (meal, name) (F2.4).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    return Response.json(await toggleFavorite(parsed.data));
  } catch (err) {
    return serverError(err);
  }
}
