import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import {
  CHAT_WEB_SEARCH_KEY,
  getChatWebSearch,
  setSetting,
} from "@/server/db/queries/lookups";

// GET /api/settings/chat-web-search → estado del interruptor global (default ON).
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    return Response.json({ enabled: await getChatWebSearch() });
  } catch (err) {
    return serverError(err);
  }
}

const bodyZ = z.object({ enabled: z.boolean() });

// PATCH /api/settings/chat-web-search → encender/apagar la búsqueda web del chat
// (F05 Fase 1, Ajustes 09 §2). Freno de coste: apaga a la vez la tool y el
// párrafo web del prompt (vuelta a la Fase 0). Sin migración (tabla `settings`).
export async function PATCH(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  try {
    await setSetting(CHAT_WEB_SEARCH_KEY, parsed.data.enabled);
    return Response.json({ enabled: await getChatWebSearch() });
  } catch (err) {
    return serverError(err);
  }
}
