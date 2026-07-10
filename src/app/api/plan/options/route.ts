import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { dateZ, optionZ } from "@/lib/schemas";
import { addPlanOption } from "@/server/db/queries/mutations";

const bodyZ = optionZ.extend({ date: dateZ.optional() });

// POST /api/plan/options → nueva opción en la versión vigente (F1.3, sin IA en F1).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  const { date, ...opt } = parsed.data;
  try {
    const row = await addPlanOption(date ?? dayKey(), opt);
    return Response.json({ option: row });
  } catch (err) {
    return serverError(err);
  }
}
