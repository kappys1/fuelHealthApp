import { ensureAuth, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { dateZ } from "@/lib/schemas";
import { getPlanContext } from "@/server/db/queries/plan";

// GET /api/plan?date= → versión vigente + opciones + derivado + targets efectivos.
export async function GET(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const url = new URL(request.url);
  const raw = url.searchParams.get("date");
  const date = raw && dateZ.safeParse(raw).success ? raw : dayKey();

  try {
    const ctx = await getPlanContext(date);
    if (!ctx) return Response.json({ error: "No hay plan." }, { status: 404 });
    return Response.json(ctx);
  } catch (err) {
    return serverError(err);
  }
}
