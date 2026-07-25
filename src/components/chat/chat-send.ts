import type { ChatImagePayload } from "@/lib/chat-turn";
import { randomUUID, type UuidCrypto } from "@/lib/uuid";

/** Identidad del turno creada en cliente antes de tocar estado o red. */
export function createChatTurnId(source: UuidCrypto = globalThis.crypto): string {
  return randomUUID(source);
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
