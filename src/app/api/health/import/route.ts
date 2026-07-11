import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import {
  applyHealthDays,
  countManualOverwrites,
  recordHealthSync,
} from "@/server/db/queries/health";
import { parseHaeCsv } from "@/server/ingest/hae-csv";

/*
  Import CSV de respaldo de Health Auto Export (F4.2 / 07 §4).
  Dos fases: vista previa (apply=false) → resumen ANTES de aplicar, y aplicar
  (apply=true) → upsert real + registro de sincronización.
*/

const bodyZ = z.object({
  csv: z.string().min(1).max(5_000_000),
  apply: z.boolean().default(false),
});

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    const { csv, apply } = parsed.data;
    const result = parseHaeCsv(csv);
    const overwriteManual = await countManualOverwrites(result.days);

    const summary = {
      rows: result.rows,
      days: result.days.length,
      metrics: result.fields.length,
      fields: result.fields,
      hadKj: result.hadKj,
      hadMl: result.hadMl,
      overwriteManual,
    };

    if (!apply) {
      return Response.json({ preview: true, ...summary });
    }

    const imported = await applyHealthDays(result.days, "csv");
    await recordHealthSync({
      at: new Date().toISOString(),
      source: "csv",
      imported,
    });
    return Response.json({ preview: false, imported, ...summary });
  } catch (err) {
    return serverError(err);
  }
}
