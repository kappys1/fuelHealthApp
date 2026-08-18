/*
  Configuración de IA por variables de entorno (02-ARQUITECTURA §4).
  La capa es agnóstica de proveedor: cambiar `AI_PROVIDER` + los `AI_MODEL_*`
  reapunta todas las features sin tocar código (los prompts son literales de 04-IA).
  Las keys viven SOLO en el servidor; nunca llegan al cliente.
*/

export type AiProvider = "google" | "anthropic" | "openai";

/** Qué modelo usar por feature (04-IA §"Modelos y coste por feature"). */
export type ModelKind = "vision" | "text" | "coach" | "chat" | "title" | "format";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Falta la variable de entorno ${name}. Configura la IA en .env.local / Vercel (02-ARQUITECTURA §4).`,
    );
  }
  return v;
}

export function aiProvider(): AiProvider {
  const p = (process.env.AI_PROVIDER ?? "google").toLowerCase();
  if (p !== "google" && p !== "anthropic" && p !== "openai") {
    throw new Error(`AI_PROVIDER no soportado: "${p}" (usa google | anthropic | openai).`);
  }
  return p;
}

export function aiApiKey(): string {
  return required("AI_API_KEY");
}

export function modelId(kind: ModelKind): string {
  switch (kind) {
    case "vision":
      return required("AI_MODEL_VISION");
    case "text":
      return required("AI_MODEL_TEXT");
    case "coach":
      return required("AI_MODEL_COACH");
    case "chat":
      // El chat (F-IA-8) usa su PROPIO modelo, más capaz (razona sobre tus datos
      // y sostiene el hilo): AI_MODEL_CHAT. Si no está definido, cae al del coach
      // → no rompe deploys existentes; subir el chat = definir AI_MODEL_CHAT.
      return process.env.AI_MODEL_CHAT ?? required("AI_MODEL_COACH");
    case "title":
      // Título del hilo (F12): modelo barato (Flash-Lite), 1 llamada por hilo. Si
      // AI_MODEL_TITLE no está definido, cae al del chat → no rompe deploys; el
      // título es cosmético y su fallback último es el recorte determinista.
      return process.env.AI_MODEL_TITLE ?? modelId("chat");
    case "format":
      // Formato de la ficha de entreno (F25): marcar rótulos de grupo. Es la
      // tarea más mecánica del catálogo (el modelo solo decide "esta línea es
      // un rótulo") → el modelo más barato disponible. Misma cascada que el
      // título: si AI_MODEL_FORMAT no está definido, cae al del título (que a
      // su vez cae al del chat) → no rompe deploys existentes.
      return process.env.AI_MODEL_FORMAT ?? modelId("title");
  }
}
