import type { ModelMessage } from "ai";
import { z } from "zod";
import {
  type ChatImagePayload,
  chatImageTurnText,
} from "@/lib/chat-turn";
import { CHAT_MAX_CHARS } from "@/lib/schemas";

export const CHAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const CHAT_IMAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

function base64ByteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

function isCanonicalBase64(value: string): boolean {
  if (value.length % 4 !== 0) return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value;
  } catch {
    return false;
  }
}

export const chatImageSchema = z
  .object({
    base64: z
      .string()
      .min(1, "La imagen está vacía.")
      .superRefine((value, ctx) => {
        // El límite se comprueba antes de decodificar para acotar memoria. La
        // comparación canónica rechaza caracteres/padding inválidos sin ejecutar
        // una regex gigante (que desbordaba la pila cerca de 8 MB).
        if (base64ByteLength(value) > CHAT_IMAGE_MAX_BYTES) {
          ctx.addIssue({
            code: "custom",
            message: "La imagen supera el límite de 8 MB.",
          });
          return;
        }
        if (!isCanonicalBase64(value)) {
          ctx.addIssue({
            code: "custom",
            message: "La imagen no contiene base64 válido.",
          });
        }
      }),
    mediaType: z.enum(CHAT_IMAGE_MEDIA_TYPES, {
      error: "El formato de imagen no está permitido.",
    }),
  })
  .strict();

export const chatRequestSchema = z
  .object({
    threadId: z.number().int().positive().nullable().optional(),
    message: z.string().max(CHAT_MAX_CHARS),
    image: chatImageSchema.optional(),
    turnId: z.uuid().optional(),
    // Compatibilidad con clientes anteriores. La deduplicación real usa turnId.
    retry: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.image && value.message.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["message"],
        message: "Escribe una pregunta o adjunta una foto.",
      });
    }
  });

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  turnId: string | null;
}

// F12 Fase 4 · dedup semántica del doble envío. Ventana en la que un segundo envío
// idéntico (turnId DISTINTO, mismo hilo) cuya primera respuesta sigue pendiente se
// considera duplicado. Igual que el lock de turno (STALE_TURN_MS): pasada la ventana,
// un turno pendiente se da por abandonado y repetir vuelve a estar permitido.
export const CHAT_DEDUP_WINDOW_MS = 5 * 60 * 1000;

export interface ChatTurnSnapshot {
  turnId: string;
  userContent: string;
  /** null = aún sin fila de asistente; "" = placeholder pendiente; texto = completa. */
  assistantContent: string | null;
  createdAtMs: number;
}

/**
 * Decide si un envío entrante (texto `content` en un hilo) es un DUPLICADO de un turno
 * cuya respuesta sigue pendiente (AC9 · repro del 21-jul). Devuelve el turnId del
 * duplicado pendiente, o null si no lo hay.
 *
 * Regla (mirando el turno más reciente con ese mismo texto, dentro de la ventana):
 * - respuesta pendiente (sin asistente o placeholder "") → es el doble envío → dedup.
 * - respuesta COMPLETA → repetir la pregunta está permitido → NO dedup.
 * - fuera de la ventana → el turno pendiente se da por abandonado → NO dedup.
 * Pura y testeable; la query (findPendingDuplicateTurn) solo le pasa los snapshots.
 */
export function findPendingDuplicate(
  turns: readonly ChatTurnSnapshot[],
  content: string,
  nowMs: number,
  staleMs: number = CHAT_DEDUP_WINDOW_MS,
): string | null {
  const sameText = turns
    .filter((t) => t.userContent === content)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  for (const t of sameText) {
    if (nowMs - t.createdAtMs > staleMs) continue; // abandonado → permitir
    if (t.assistantContent == null || t.assistantContent === "") return t.turnId;
    return null; // el más reciente con ese texto ya tiene respuesta → repetir permitido
  }
  return null;
}

/**
 * Mantiene el historial como texto y sustituye exclusivamente el mensaje de
 * usuario del turno actual por las partes multimodales de AI SDK 7.
 */
export function buildChatModelMessages(
  messages: ChatHistoryMessage[],
  currentTurnId: string,
  image: ChatImagePayload | undefined,
  question: string,
): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    if (
      image &&
      message.role === "user" &&
      message.turnId === currentTurnId
    ) {
      return {
        role: "user",
        content: [
          {
            type: "file",
            mediaType: image.mediaType,
            data: image.base64,
          },
          { type: "text", text: chatImageTurnText(question) },
        ],
      };
    }
    return { role: message.role, content: message.content };
  });
}
