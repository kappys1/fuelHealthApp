import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import {
  claimAssistantTurn,
  completeAssistantTurn,
  createThread,
  deleteEmptyThread,
  ensureChatUserMessage,
  getChatTurn,
  listThreads,
  releaseAssistantTurn,
  touchThread,
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
  Puente Coach → Chat (F01 Fase 2 · A1). Persiste la pregunta y la lectura ya
  generada, sin una segunda llamada a la IA. handoffId hace que reintentos, doble
  clic y peticiones concurrentes recuperen el mismo hilo.
*/
const seedZ = z.object({
  userMessage: z.string().min(1).max(200),
  assistantMessage: z.string().min(1).max(4000),
  handoffId: z.string().min(16).max(180),
});

async function completedSeed(
  handoffId: string,
  assistantMessage: string,
): Promise<number | null> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const turn = await getChatTurn(handoffId);
    if (turn?.assistantContent) {
      if (turn.assistantContent !== assistantMessage) {
        throw new Error("La lectura del Coach ya pertenece a otro contenido.");
      }
      return turn.threadId;
    }
    if (attempt < 11) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
  return null;
}

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, seedZ);
  if ("error" in parsed) return parsed.error;
  const { userMessage, assistantMessage, handoffId } = parsed.data;

  let createdThreadId: number | null = null;
  try {
    const existing = await retry(() => getChatTurn(handoffId));
    if (existing) {
      if (existing.userContent !== userMessage) {
        throw new Error("La lectura del Coach ya pertenece a otra pregunta.");
      }
      if (existing.assistantContent) {
        if (existing.assistantContent !== assistantMessage) {
          throw new Error("La lectura del Coach ya pertenece a otro contenido.");
        }
        return Response.json({ threadId: existing.threadId });
      }
    }

    createdThreadId = existing
      ? null
      : await retry(() => createThread(threadTitleFrom(userMessage)));
    const requestedThreadId = existing?.threadId ?? createdThreadId;
    if (requestedThreadId === null) {
      throw new Error("No se pudo preparar el hilo del Coach.");
    }

    const turn = await retry(() =>
      ensureChatUserMessage(requestedThreadId, handoffId, userMessage),
    );
    const threadId = turn.threadId;
    if (createdThreadId !== null && createdThreadId !== threadId) {
      const losingThreadId = createdThreadId;
      await retry(() => deleteEmptyThread(losingThreadId));
      createdThreadId = null;
    }

    const claim = await retry(() => claimAssistantTurn(threadId, handoffId));
    if (claim.status === "claimed") {
      try {
        await completeAssistantTurn(claim.messageId, assistantMessage);
      } catch (error) {
        const settledThreadId = await completedSeed(handoffId, assistantMessage);
        if (settledThreadId === null) {
          await releaseAssistantTurn(claim.messageId).catch(() => undefined);
          throw error;
        }
      }
    } else if (claim.status === "complete") {
      if (claim.content !== assistantMessage) {
        throw new Error("La lectura del Coach ya pertenece a otro contenido.");
      }
    } else {
      const settledThreadId = await completedSeed(handoffId, assistantMessage);
      if (settledThreadId === null) {
        return Response.json(
          { error: "La conversación se está preparando. Vuelve a intentarlo." },
          { status: 409 },
        );
      }
    }

    await retry(() => touchThread(threadId));
    return Response.json({ threadId });
  } catch (err) {
    if (createdThreadId !== null) {
      try {
        await deleteEmptyThread(createdThreadId);
      } catch {
        // El siguiente reintento recuperará el turno por handoffId.
      }
    }
    return serverError(err);
  }
}
