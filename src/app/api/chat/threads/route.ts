import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import {
  addChatMessage,
  createThread,
  listThreads,
  threadTitleFrom,
} from "@/server/db/queries/chat";

// Lista de hilos de chat (F-IA-8). La creación normal ocurre en el primer mensaje.
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

/*
  Puente Coach → Chat (F01 Fase 2 · A1). Siembra un hilo NUEVO con la pregunta del
  usuario y el texto que el Coach acaba de mostrar como respuesta del asistente.
  SIN llamada a la IA: solo persiste dos mensajes; el siguiente turno del Chat usa
  su contexto fresco normal (ya con fecha y plan correctos tras Fases 0-1).
*/
const seedZ = z.object({
  userMessage: z.string().min(1).max(200),
  assistantMessage: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, seedZ);
  if ("error" in parsed) return parsed.error;
  const { userMessage, assistantMessage } = parsed.data;

  try {
    const threadId = await retry(() =>
      createThread(threadTitleFrom(userMessage)),
    );
    await retry(() => addChatMessage(threadId, "user", userMessage));
    await retry(() => addChatMessage(threadId, "assistant", assistantMessage));
    return Response.json({ threadId });
  } catch (err) {
    return serverError(err);
  }
}
