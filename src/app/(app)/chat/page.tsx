import { ChatClient } from "@/components/chat/chat-client";
import { retry } from "@/lib/retry";
import { listThreads } from "@/server/db/queries/chat";

// Chat sobre tus datos (F-IA-8). Los hilos llegan renderizados del servidor; el
// contexto de cada respuesta se ensambla fresco en la route de streaming.
export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const [threads, sp] = await Promise.all([retry(() => listThreads()), searchParams]);
  // Puente Coach → Chat (F01 Fase 2): ?thread=<id> abre ese hilo al entrar.
  const initialThreadId = sp.thread ? Number(sp.thread) : null;
  const renderedAt = new Date().toISOString();
  return (
    <ChatClient
      initialThreads={threads}
      nowIso={renderedAt}
      initialThreadId={
        initialThreadId != null && Number.isFinite(initialThreadId)
          ? initialThreadId
          : null
      }
    />
  );
}
