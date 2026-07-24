import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

/*
  Hilos de chat (F-IA-8). Persistencia de conversaciones «pregúntale a tus datos».
  El contexto se ensambla FRESCO en cada turno (server/ai/context); aquí solo se
  guardan los mensajes y el resumen cacheado de los mensajes antiguos.
*/

// 24 (antes 12): más historial verbatim → el chat «te sigue» mejor y hace falta
// resumir menos (DECISIONS #54). Con el modelo del chat el contexto cabe de sobra.
export const CHAT_WINDOW = 24; // últimos N mensajes que viajan verbatim
export const SUMMARY_BATCH = 6; // re-resumir cada N mensajes que envejecen

export interface ThreadDTO {
  id: number;
  title: string;
  updatedAt: string;
  messageCount: number;
  preview: string | null;
}

export interface MessageDTO {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  turnId: string | null;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

export async function listThreads(): Promise<ThreadDTO[]> {
  const rows = await db
    .select({
      id: schema.chatThreads.id,
      title: schema.chatThreads.title,
      updatedAt: schema.chatThreads.updatedAt,
      messageCount: sql<number>`count(${schema.chatMessages.id}) filter (where ${schema.chatMessages.content} <> '')`,
      preview: sql<string | null>`(
        select ${schema.chatMessages.content}
        from ${schema.chatMessages}
        where ${schema.chatMessages.threadId} = ${schema.chatThreads.id}
          and ${schema.chatMessages.content} <> ''
        order by ${schema.chatMessages.createdAt} desc, ${schema.chatMessages.id} desc
        limit 1
      )`,
    })
    .from(schema.chatThreads)
    .leftJoin(
      schema.chatMessages,
      eq(schema.chatMessages.threadId, schema.chatThreads.id),
    )
    .groupBy(
      schema.chatThreads.id,
      schema.chatThreads.title,
      schema.chatThreads.updatedAt,
    )
    .orderBy(desc(schema.chatThreads.updatedAt), desc(schema.chatThreads.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: iso(r.updatedAt),
    messageCount: Number(r.messageCount),
    preview: r.preview,
  }));
}

export interface ThreadDetail {
  id: number;
  title: string;
  summary: string | null;
  summaryMsgCount: number;
  updatedAt: string;
  messages: MessageDTO[];
}

export async function getThread(id: number): Promise<ThreadDetail | null> {
  const [thread] = await db
    .select()
    .from(schema.chatThreads)
    .where(eq(schema.chatThreads.id, id));
  if (!thread) return null;
  const rows = await db
    .select()
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.threadId, id),
        ne(schema.chatMessages.content, ""),
      ),
    )
    .orderBy(asc(schema.chatMessages.createdAt), asc(schema.chatMessages.id));
  return {
    id: thread.id,
    title: thread.title,
    summary: thread.summary,
    summaryMsgCount: thread.summaryMsgCount,
    updatedAt: iso(thread.updatedAt),
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: iso(r.createdAt),
      turnId: r.turnId,
    })),
  };
}

/**
 * Título del hilo: resumen determinista de la primera pregunta. Un título generado
 * por IA queda como mejora menor y nunca bloquea la lista ni añade coste al abrirla.
 */
export function threadTitleFrom(message: string): string {
  const clean = message
    .trim()
    .replace(/^[¿¡]+/, "")
    .replace(/\s+/g, " ");
  const sentence = clean.split(/[.!?\n]/, 1)[0]?.trim() ?? "";
  const words = sentence.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 58 ? `${words.slice(0, 55).trimEnd()}…` : words || "Nuevo hilo";
}

export async function createThread(title: string): Promise<number> {
  const [row] = await db
    .insert(schema.chatThreads)
    .values({ title })
    .returning({ id: schema.chatThreads.id });
  if (!row) throw new Error("No se pudo crear el hilo.");
  return row.id;
}

export async function addChatMessage(
  threadId: number,
  role: "user" | "assistant",
  content: string,
  turnId: string | null = null,
): Promise<void> {
  await db.insert(schema.chatMessages).values({ threadId, role, content, turnId });
}

export interface ChatTurnState {
  threadId: number;
  userContent: string;
  assistantId: number | null;
  assistantContent: string | null;
  assistantCreatedAt: Date | null;
}

/** Localiza un turno por su id global, incluso si el navegador perdió el id del hilo. */
export async function getChatTurn(turnId: string): Promise<ChatTurnState | null> {
  const rows = await db
    .select({
      id: schema.chatMessages.id,
      threadId: schema.chatMessages.threadId,
      role: schema.chatMessages.role,
      content: schema.chatMessages.content,
      createdAt: schema.chatMessages.createdAt,
    })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.turnId, turnId));
  const user = rows.find((row) => row.role === "user");
  if (!user) return null;
  const assistant = rows.find((row) => row.role === "assistant");
  return {
    threadId: user.threadId,
    userContent: user.content,
    assistantId: assistant?.id ?? null,
    assistantContent: assistant?.content ?? null,
    assistantCreatedAt: assistant?.createdAt ?? null,
  };
}

/** Inserta el mensaje una sola vez; un turnId repetido recupera el original. */
export async function ensureChatUserMessage(
  threadId: number,
  turnId: string,
  content: string,
): Promise<ChatTurnState> {
  await db
    .insert(schema.chatMessages)
    .values({ threadId, role: "user", content, turnId })
    .onConflictDoNothing({
      target: [schema.chatMessages.turnId, schema.chatMessages.role],
    });
  const turn = await getChatTurn(turnId);
  if (!turn) throw new Error("No se pudo guardar el turno del chat.");
  if (turn.userContent !== content) {
    throw new Error("El identificador del turno ya pertenece a otro mensaje.");
  }
  return turn;
}

export type AssistantTurnClaim =
  | { status: "claimed"; messageId: number }
  | { status: "complete"; content: string }
  | { status: "pending" };

const STALE_TURN_MS = 5 * 60 * 1000;

/**
 * La fila vacía es el lock persistente del turno. Solo quien la inserta genera IA;
 * el resto recupera el resultado o recibe pending. Un lock abandonado expira.
 */
export async function claimAssistantTurn(
  threadId: number,
  turnId: string,
): Promise<AssistantTurnClaim> {
  const insertPlaceholder = () =>
    db
      .insert(schema.chatMessages)
      .values({ threadId, role: "assistant" as const, content: "", turnId })
      .onConflictDoNothing({
        target: [schema.chatMessages.turnId, schema.chatMessages.role],
      })
      .returning({ id: schema.chatMessages.id });

  const [claimed] = await insertPlaceholder();
  if (claimed) return { status: "claimed", messageId: claimed.id };

  const turn = await getChatTurn(turnId);
  if (turn?.assistantContent) {
    return { status: "complete", content: turn.assistantContent };
  }
  if (!turn?.assistantId || !turn.assistantCreatedAt) return { status: "pending" };

  const [removed] = await db
    .delete(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.id, turn.assistantId),
        eq(schema.chatMessages.content, ""),
        lt(schema.chatMessages.createdAt, new Date(Date.now() - STALE_TURN_MS)),
      ),
    )
    .returning({ id: schema.chatMessages.id });
  if (!removed) return { status: "pending" };

  const [reclaimed] = await insertPlaceholder();
  return reclaimed
    ? { status: "claimed", messageId: reclaimed.id }
    : { status: "pending" };
}

export async function completeAssistantTurn(
  messageId: number,
  content: string,
): Promise<void> {
  const [completed] = await db
    .update(schema.chatMessages)
    .set({ content })
    .where(
      and(
        eq(schema.chatMessages.id, messageId),
        eq(schema.chatMessages.content, ""),
      ),
    )
    .returning({ id: schema.chatMessages.id });
  if (!completed) {
    throw new Error("El turno del chat ya no pertenece a esta respuesta.");
  }
}

export async function releaseAssistantTurn(messageId: number): Promise<void> {
  await db
    .delete(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.id, messageId),
        eq(schema.chatMessages.content, ""),
      ),
    );
}

export async function deleteEmptyThread(id: number): Promise<void> {
  await db.execute(sql`
    delete from ${schema.chatThreads}
    where ${schema.chatThreads.id} = ${id}
      and not exists (
        select 1 from ${schema.chatMessages}
        where ${schema.chatMessages.threadId} = ${id}
      )
  `);
}

/** Marca el hilo como usado (para el orden de la lista). */
export async function touchThread(threadId: number): Promise<void> {
  await db
    .update(schema.chatThreads)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.chatThreads.id, threadId));
}

export async function saveThreadSummary(
  threadId: number,
  summary: string,
  count: number,
): Promise<void> {
  await db
    .update(schema.chatThreads)
    .set({ summary, summaryMsgCount: count })
    .where(eq(schema.chatThreads.id, threadId));
}

export async function deleteThread(id: number): Promise<void> {
  await db.delete(schema.chatThreads).where(eq(schema.chatThreads.id, id));
}
