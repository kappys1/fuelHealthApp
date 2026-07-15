import { asc, desc, eq, sql } from "drizzle-orm";
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
}

export interface MessageDTO {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

export async function listThreads(): Promise<ThreadDTO[]> {
  const rows = await db
    .select({
      id: schema.chatThreads.id,
      title: schema.chatThreads.title,
      updatedAt: schema.chatThreads.updatedAt,
    })
    .from(schema.chatThreads)
    .orderBy(desc(schema.chatThreads.updatedAt), desc(schema.chatThreads.id));
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: iso(r.updatedAt) }));
}

export interface ThreadDetail {
  id: number;
  title: string;
  summary: string | null;
  summaryMsgCount: number;
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
    .where(eq(schema.chatMessages.threadId, id))
    .orderBy(asc(schema.chatMessages.createdAt), asc(schema.chatMessages.id));
  return {
    id: thread.id,
    title: thread.title,
    summary: thread.summary,
    summaryMsgCount: thread.summaryMsgCount,
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: iso(r.createdAt),
    })),
  };
}

/** Título del hilo: primeras ~6 palabras de la primera pregunta (F-IA-8). */
export function threadTitleFrom(message: string): string {
  const words = message.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 60 ? `${words.slice(0, 57)}…` : words || "Nuevo hilo";
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
): Promise<void> {
  await db.insert(schema.chatMessages).values({ threadId, role, content });
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
