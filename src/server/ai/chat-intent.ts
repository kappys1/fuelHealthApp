/*
  F21 · Detección de intención de ENTRENO/adaptación en un turno del Chat. Pura y
  testeada (AC9): decide si el turno va de entreno, una molestia/lesión o adaptar
  la sesión → solo entonces la ruta inyecta el CONTENIDO real de la(s) sesión(es)
  en el contexto. Si NO dispara, el prompt y el coste son idénticos a hoy (AC8) —
  mismo patrón que el flag `chatWebSearch`.

  Doctrina (spec F21 · riesgo 1): RECALL GENEROSO. Un falso positivo raro solo
  añade unos cientos de tokens de contexto (barato, uso puntual); un falso negativo
  en «léeme la sesión» rompería el AC1, así que la lista es amplia. Los disparadores
  y los no-disparadores canónicos viven en chat-intent.test.ts (lección: todo caso
  de comportamiento acaba en caso canónico).
*/

// Raíces (ya sin acentos, en minúsculas) que se buscan como subcadena sobre el
// mensaje normalizado. Cubren: contexto de entreno, molestia/lesión, zonas del
// cuerpo, y verbos de adaptación/recuperación. Ampliar aquí = añadir su caso al test.
const TRAINING_INTENT_STEMS: readonly string[] = [
  // Contexto de entreno / la sesión en sí
  "entren", // entreno, entrenar, entrenamiento, entrenó
  "sesion", // sesión (ya normalizado)
  "ejercicio",
  "wod",
  "rutina",
  "workout",
  // Molestia / lesión / limitación
  "lesion", // lesión, lesionado
  "dolor",
  "duele",
  "duelen",
  "molest", // molestia, molesto, molesta
  "pinchazo",
  "tendinit", // tendinitis
  "contractura",
  "esguince",
  "sobrecarg", // sobrecarga, sobrecargado
  // Zonas del cuerpo (una limitación se declara por la zona que carga)
  "hombro",
  "rodilla",
  "codo",
  "muneca", // muñeca (normalizado)
  "cadera",
  "espalda",
  "lumbar",
  "cervical",
  "tobillo",
  "isquio", // isquios, isquiotibiales
  "gemelo",
  "cuadriceps", // cuádriceps (normalizado)
  "biceps", // bíceps (normalizado)
  "triceps", // tríceps (normalizado)
  "pierna",
  // Verbos de adaptación / recuperación / trabajo alternativo
  "adapt", // adaptar, adáptame, adaptación
  "sustitu", // sustituir, sustituto, sustitución
  "escalar",
  "escalad", // escalado, escalada del movimiento
  "reemplaz", // reemplazar, reemplazo
  "movilidad",
  "estira", // estiramiento, estirar
  "cardio",
  "antagonist", // antagonista, trabajo antagonista
  "calentamiento",
  "descans", // descanso, descansar (un grupo muscular)
] as const;

/** Quita acentos/diacríticos y pasa a minúsculas (para casar con las raíces). */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * ¿El turno pide leer/adaptar el entreno o habla de una molestia/lesión? Recall
 * generoso a propósito (spec F21). Un mensaje vacío (turno solo-foto) no dispara.
 */
export function detectTrainingAdaptationIntent(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) return false;
  const norm = normalize(trimmed);
  return TRAINING_INTENT_STEMS.some((stem) => norm.includes(stem));
}

/**
 * ¿La conversación reciente va de entreno/adaptación? Detección STICKY sobre la
 * ventana de mensajes que el modelo ve verbatim: en un diálogo de adaptación las
 * respuestas de seguimiento («no, tú lo tienes», «decidamos juntos») pierden las
 * palabras clave, pero la conversación SIGUE siendo de entreno — sin esto el
 * contexto de la sesión se caía turno a turno y el Chat volvía a «solo veo el
 * título» (caso real 29-jul, rompía AC4). Basta con que UN turno del usuario en la
 * ventana haya disparado la intención. Ligado a lo que el modelo ve: si la ventana
 * deja de hablar de entreno, la inyección se detiene sola (respeta AC8).
 */
export function anyTrainingAdaptationIntent(
  messages: readonly string[],
): boolean {
  return messages.some(detectTrainingAdaptationIntent);
}
