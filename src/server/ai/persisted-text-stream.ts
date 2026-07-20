interface PersistedTextStreamOptions {
  deltas: AsyncIterable<string>;
  onComplete: (content: string) => Promise<void>;
  onError: (error: unknown) => Promise<void>;
  headers?: HeadersInit;
}

interface StreamPartLike {
  type: string;
  text?: string;
  error?: unknown;
  reason?: string;
}

/** AI SDK textStream omits error parts; consume the full stream and fail loudly. */
export async function* verifiedTextDeltas(
  parts: AsyncIterable<StreamPartLike>,
): AsyncGenerator<string> {
  for await (const part of parts) {
    if (part.type === "text-delta") {
      if (typeof part.text !== "string") throw new Error("Delta de IA inválido.");
      yield part.text;
    } else if (part.type === "error") {
      throw part.error instanceof Error
        ? part.error
        : new Error("La respuesta de la IA se interrumpió.");
    } else if (part.type === "abort") {
      throw new Error(part.reason || "La respuesta de la IA se canceló.");
    }
  }
}

/** Streams text to the client but only closes successfully after it is persisted. */
export function persistedTextStreamResponse({
  deltas,
  onComplete,
  onError,
  headers,
}: PersistedTextStreamOptions): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let content = "";
      try {
        for await (const delta of deltas) {
          content += delta;
          controller.enqueue(encoder.encode(delta));
        }
        if (!content.trim()) {
          throw new Error("La IA no devolvió una respuesta.");
        }
        await onComplete(content);
        controller.close();
      } catch (error) {
        await onError(error).catch(() => undefined);
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
