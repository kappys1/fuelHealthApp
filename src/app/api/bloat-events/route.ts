import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { bloatEventCreateZ, dateZ } from "@/lib/schemas";
import {
  createBloatEvent,
  listBloatEvents,
} from "@/server/db/queries/bloat";

export async function GET(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const date = new URL(request.url).searchParams.get("date");
  if (!date || !dateZ.safeParse(date).success) return badRequest("Fecha inválida.");

  try {
    return Response.json({ events: await listBloatEvents(date) });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bloatEventCreateZ);
  if ("error" in parsed) return parsed.error;

  try {
    return Response.json({ event: await createBloatEvent(parsed.data) });
  } catch (err) {
    return serverError(err);
  }
}
