import { NextResponse } from "next/server";

/*
  Endpoint de ingesta de Apple Health (Health Auto Export).
  Exento de sesión (usa token propio) — ver proxy.ts.
  IMPLEMENTACIÓN COMPLETA EN FASE 3. En Fase 0 es solo un stub que valida el
  token para poder verificar la exención del proxy.
*/
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const token = process.env.HEALTH_INGEST_TOKEN;

  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Ingesta no implementada todavía (Fase 3)." },
    { status: 501 },
  );
}
