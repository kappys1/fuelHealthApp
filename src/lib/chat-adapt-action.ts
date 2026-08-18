import { anyTrainingAdaptationIntent } from "@/server/ai/chat-intent";

/*
  F26 Fase 3 · ¿toca pintar «Guardar como sesión adaptada de hoy» bajo la última
  respuesta del Chat?

  La acción la pinta la APP, nunca la emite el modelo (patrón F14·B): así el texto
  del Chat sigue siendo el de siempre y el AC5 de F21 —«no guarda ni afirma haber
  guardado»— se mantiene por construcción, no por confianza.

  Dos decisiones de diseño, las dos por el mismo motivo (una acción de más cuesta
  una mirada; una de menos cuesta la feature):
  1. **Solo bajo la ÚLTIMA respuesta.** Es la que Alex está leyendo. Pintarla bajo
     cada respuesta del hilo llenaría de botones una conversación larga.
  2. **Intención STICKY**, la misma que usa el servidor para inyectar el contexto
     (`anyTrainingAdaptationIntent`): en un diálogo de adaptación los seguimientos
     («mejor con remo», «y el martes?») pierden las palabras clave pero siguen
     siendo de entreno. Se mira una ventana corta de mensajes de Alex, no el hilo
     entero: si la conversación se va a otro tema, el botón desaparece solo.
*/

/** Mensajes de Alex que se miran hacia atrás para decidir si sigue siendo de entreno. */
export const ADAPT_ACTION_WINDOW = 3;

export function shouldOfferAdaptedSave(
  messages: readonly { role: "user" | "assistant"; content: string }[],
  opts: { streaming: boolean },
): boolean {
  // Mientras la respuesta se está escribiendo no hay nada que guardar todavía.
  if (opts.streaming) return false;
  if (messages.at(-1)?.role !== "assistant") return false;
  const recentUser = messages
    .filter((m) => m.role === "user")
    .slice(-ADAPT_ACTION_WINDOW)
    .map((m) => m.content);
  return anyTrainingAdaptationIntent(recentUser);
}
