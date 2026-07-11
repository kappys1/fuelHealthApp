import { NextResponse } from "next/server";
import {
  applyHealthDays,
  insertWorkouts,
  recordHealthSync,
} from "@/server/db/queries/health";
import { parseHaeJson } from "@/server/ingest/hae-json";

/*
  Endpoint de ingesta de Apple Health (Health Auto Export, F4.1 / 03-DATOS §4.1).
  Exento de sesión (usa token propio) — ver proxy.ts.

  Auth: Authorization: Bearer HEALTH_INGEST_TOKEN. Payload máx. 1 MB. Parser
  tolerante al JSON de las Automations. Upsert por fecha (fusión por campo;
  precedencia sobre lo manual en la vista efectiva). Responde { imported }.
*/

export const dynamic = "force-dynamic";
const MAX_BYTES = 1_000_000; // 1 MB (02-ARQUITECTURA §5)

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const token = process.env.HEALTH_INGEST_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Límite de tamaño (por cabecera y por cuerpo real).
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ error: "Payload demasiado grande (máx 1 MB)." }, { status: 413 });
  }
  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return NextResponse.json({ error: "Payload demasiado grande (máx 1 MB)." }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  try {
    const { days, workouts } = parseHaeJson(json);
    const imported = await applyHealthDays(days, "endpoint");
    const workoutsAdded = await insertWorkouts(workouts);
    await recordHealthSync({
      at: new Date().toISOString(),
      source: "endpoint",
      imported,
    });
    return NextResponse.json({ imported, workouts: workoutsAdded });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error procesando la ingesta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
