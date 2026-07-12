import { ensureAuth, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { listThreads } from "@/server/db/queries/chat";

// Lista de hilos de chat (F-IA-8). La creación ocurre en el primer mensaje.
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    const threads = await retry(() => listThreads());
    return Response.json({ threads });
  } catch (err) {
    return serverError(err);
  }
}
