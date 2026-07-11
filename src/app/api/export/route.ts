import { ensureAuth, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { exportAll } from "@/server/db/queries/backup";
import { setSetting } from "@/server/db/queries/lookups";

/*
  Export JSON completo en 1 clic (F4.5 / principio 7). Descarga con nombre
  fuelboard-export-YYYY-MM-DD.json. Registra lastExport.
*/
export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  try {
    const data = await exportAll();
    await setSetting("lastExport", { at: data.exportedAt });
    const filename = `fuelboard-export-${dayKey()}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
