import {
  anyTrainingAdaptationIntent,
  detectTrainingAdaptationIntent,
} from "@/server/ai/chat-intent";

/*
  F26 Fase 3 · la acción del Chat: «Adaptar la sesión de hoy».

  **Enmienda del 18-ago con evidencia de uso (DECISIONS #101).** La spec decía
  «Guardar como sesión adaptada de hoy» prerrellenando el editor con el TEXTO de
  la respuesta. Al usarlo se vio que eso no funciona: el Chat **conversa**, no
  produce sesiones. Su respuesta es consejo en prosa («si la tracción te molesta,
  cambia la cuerda por…»), con markdown y una pregunta al final — pegar eso en
  `adapted_session` mete prosa donde va un entreno. La sesión de verdad la produce
  el generador (F-IA-12), y esa sí sale con la estructura del plan.

  Así que el botón deja de prometer que la respuesta es una sesión y pasa a ser un
  **atajo al mismo flujo de la ficha**, con el motivo ya escrito a partir de lo que
  Alex le contó al Chat. Una sola puerta de guardado y un solo generador; el Chat
  hace lo que sabe hacer, que es hablar.

  La acción la pinta la APP, nunca la emite el modelo (patrón F14·B): el AC5 de F21
  —«no guarda ni afirma haber guardado»— se mantiene por construcción.

  Dos decisiones de visibilidad (una acción de más cuesta una mirada; una de menos
  cuesta la feature):
  1. **Solo bajo la ÚLTIMA respuesta.** Es la que Alex está leyendo; pintarla bajo
     cada respuesta llenaría de botones un hilo largo.
  2. **Intención STICKY**, la misma que usa el servidor para inyectar el contexto:
     en un diálogo de adaptación los seguimientos («mejor con remo», «y el martes?»)
     pierden las palabras clave pero siguen siendo de entreno. Ventana corta, no el
     hilo entero: si la conversación se va a otro tema, el botón desaparece solo.
     Con el significado nuevo, un disparo generoso ya no miente — ofrecer adaptar
     mientras habláis del entreno es razonable aunque la respuesta fuera una pregunta.
*/

/** Mensajes de Alex que se miran hacia atrás para decidir si sigue siendo de entreno. */
export const ADAPT_ACTION_WINDOW = 3;

export function shouldOfferAdaptedSave(
  messages: readonly { role: "user" | "assistant"; content: string }[],
  opts: { streaming: boolean },
): boolean {
  // Mientras la respuesta se está escribiendo, aún no hay turno cerrado.
  if (opts.streaming) return false;
  if (messages.at(-1)?.role !== "assistant") return false;
  return anyTrainingAdaptationIntent(recentUserMessages(messages));
}

/** Límite del campo `motivo` en el endpoint (`adaptedSessionSaveZ`/adapt-session). */
const MOTIVO_MAX = 300;

/**
 * Motivo con el que se abre la hoja: **las palabras de Alex**, no un resumen de
 * la IA. Se coge su último mensaje de la ventana que disparó la intención — el
 * más cercano a lo que acaba de pedir — y es editable antes de generar. Si nada
 * dispara (no debería, el botón no estaría), devuelve "".
 */
export function adaptMotiveFromChat(
  messages: readonly { role: "user" | "assistant"; content: string }[],
): string {
  const candidate = [...recentUserMessages(messages)]
    .reverse()
    .find(detectTrainingAdaptationIntent);
  return (candidate ?? "").trim().slice(0, MOTIVO_MAX);
}

function recentUserMessages(
  messages: readonly { role: "user" | "assistant"; content: string }[],
): string[] {
  return messages
    .filter((m) => m.role === "user")
    .slice(-ADAPT_ACTION_WINDOW)
    .map((m) => m.content);
}
