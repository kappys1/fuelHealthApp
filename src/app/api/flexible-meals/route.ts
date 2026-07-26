import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dateZ, flexibleMealZ } from "@/lib/schemas";
import {
  markFlexibleMeal,
  unmarkFlexibleMeal,
} from "@/server/db/queries/mutations";

const bodyZ = z.object({
  date: dateZ,
  meal: flexibleMealZ,
});

// PUT/DELETE son idempotentes: la cola offline puede repetirlos sin duplicar.
export async function PUT(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    await markFlexibleMeal(parsed.data.date, parsed.data.meal);
    return Response.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    await unmarkFlexibleMeal(parsed.data.date, parsed.data.meal);
    return Response.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
