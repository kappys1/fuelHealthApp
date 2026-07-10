/*
  Configuración de IA por variables de entorno (02-ARQUITECTURA §4).
  La capa es agnóstica de proveedor: cambiar `AI_PROVIDER` + los `AI_MODEL_*`
  reapunta todas las features sin tocar código (los prompts son literales de 04-IA).
  Las keys viven SOLO en el servidor; nunca llegan al cliente.
*/

export type AiProvider = "google" | "anthropic" | "openai";

/** Qué modelo usar por feature (04-IA §"Modelos y coste por feature"). */
export type ModelKind = "vision" | "text" | "coach";

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
  }
}
