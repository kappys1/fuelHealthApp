import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dateZ } from "@/lib/schemas";
import { listTemplates } from "@/server/db/queries/lookups";
import { saveTemplateFromDate } from "@/server/db/queries/mutations";

// GET /api/templates → lista de plantillas.
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    return Response.json({ templates: await listTemplates() });
  } catch (err) {
    return serverError(err);
  }
}

const bodyZ = z.object({ name: z.string().min(1).max(80), date: dateZ });

// POST /api/templates → guardar el día como plantilla (F2.6).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    const row = await saveTemplateFromDate(parsed.data.name, parsed.data.date);
    return Response.json({ template: row });
  } catch (err) {
    return serverError(err);
  }
}
