export const CHAT_PHOTO_MARKER = "📷 Foto adjunta";

export interface ChatImagePayload {
  /** Base64 sin prefijo data-url. */
  base64: string;
  mediaType: string;
}

/**
 * Texto visible y persistente del usuario. Los bytes y la instrucción interna de
 * visión nunca entran en el historial.
 */
export function persistedChatUserText(
  question: string,
  hasImage: boolean,
): string {
  if (!hasImage) return question;
  const cleanQuestion = question.trim();
  return cleanQuestion
    ? `${CHAT_PHOTO_MARKER}\n${cleanQuestion}`
    : CHAT_PHOTO_MARKER;
}

/**
 * Instrucción privada del turno multimodal (F05 Fase 2, DECISIONS #74).
 * No forma parte del prompt global congelado ni se persiste.
 */
export function chatImageTurnText(question: string): string {
  const cleanQuestion = question.trim();
  const request = cleanQuestion
    ? `Responde prioritariamente a esta pregunta de Alex: ${cleanQuestion}`
    : "Alex no añadió una pregunta: detecta el tipo de imagen y ofrece el análisis útil correspondiente.";

  return `Hay una foto efímera adjunta en ESTE turno. Analízala solo para asesorar, aplicando la pauta, los objetivos y el consumo del día incluidos en tu contexto. Detecta si es una carta de restaurante, un plato servido o una etiqueta de producto: si es una carta, lee las opciones y recomienda las que mejor encajan; si es un plato, identifica los componentes y estima kcal y macros como RANGOS con supuestos visibles, nunca con falsa precisión sobre cantidades; si es una etiqueta, lee valores, ingredientes y ración y valora el encaje. Si algo no se ve o no puede inferirse con fiabilidad, declara la incertidumbre y pide el dato o una foto mejor. Es SOLO asesoramiento: no registres, crees, edites ni borres comidas y no ofrezcas una acción de registro. ${request}`;
}
