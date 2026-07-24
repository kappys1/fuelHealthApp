import type { ChatImagePayload } from "@/lib/chat-turn";

export interface ChatCrypto {
  randomUUID?: () => string;
  getRandomValues: <T extends ArrayBufferView | null>(array: T) => T;
}

/** Identidad del turno creada en cliente antes de tocar estado o red. */
export function createChatTurnId(
  source: ChatCrypto = globalThis.crypto,
): string {
  if (typeof source.randomUUID === "function") {
    return source.randomUUID();
  }

  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export interface FailedChatTurn {
  retryText: string;
  turnId: string;
  image?: ChatImagePayload | null;
}

export interface ChatSendPlan {
  turnId: string;
  appendUserMessage: boolean;
  image: ChatImagePayload | null;
}

/**
 * Decide la identidad de un envío antes de tocar estado o red.
 *
 * Un retry explícito (o reenviar el mismo texto mientras ese fallo sigue activo)
 * conserva turnId e imagen efímera; un envío ya completado recibe identidad nueva.
 */
export function planChatSend(args: {
  message: string;
  image?: ChatImagePayload | null;
  retryTurnId?: string;
  failedTurn: FailedChatTurn | null;
  candidateTurnId: string;
}): ChatSendPlan {
  const failedTurn =
    args.failedTurn &&
    (args.retryTurnId === args.failedTurn.turnId ||
      (!args.retryTurnId && args.message === args.failedTurn.retryText))
      ? args.failedTurn
      : null;

  return {
    turnId: args.retryTurnId ?? failedTurn?.turnId ?? args.candidateTurnId,
    appendUserMessage: args.retryTurnId == null && failedTurn == null,
    image: failedTurn?.image ?? args.image ?? null,
  };
}
