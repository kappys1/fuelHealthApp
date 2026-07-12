import { ChatClient } from "@/components/chat/chat-client";
import { listThreads } from "@/server/db/queries/chat";

// Chat sobre tus datos (F-IA-8). Los hilos llegan renderizados del servidor; el
// contexto de cada respuesta se ensambla fresco en la route de streaming.
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const threads = await listThreads();
  return <ChatClient initialThreads={threads} />;
}
