import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { LanguageModel } from "ai";
import { aiApiKey, aiProvider, modelId, type ModelKind } from "./env";

/*
  Adaptador de proveedor (02-ARQUITECTURA §1/§3). El resto de la app solo conoce
  `resolveModel(kind)` y `determinismSettings(...)`; el proveedor concreto se
  decide por `AI_PROVIDER`. Hoy está cableado Google (@ai-sdk/google); añadir
  otro proveedor = instalar su paquete + un caso aquí, sin tocar features/prompts.
*/

let googleProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;
function google() {
  if (!googleProvider) {
    // La key va explícita: el default del SDK es GOOGLE_GENERATIVE_AI_API_KEY,
    // pero nosotros la unificamos en AI_API_KEY para ser agnósticos (02 §4).
    googleProvider = createGoogleGenerativeAI({ apiKey: aiApiKey() });
  }
  return googleProvider;
}

export function resolveModel(kind: ModelKind): LanguageModel {
  const provider = aiProvider();
  const id = modelId(kind);
  switch (provider) {
    case "google":
      return google()(id);
    case "anthropic":
    case "openai":
      throw new Error(
        `AI_PROVIDER="${provider}" aún no está cableado. Instala @ai-sdk/${provider} y añade el caso en server/ai/provider.ts (los prompts y features no cambian).`,
      );
  }
}

/**
 * Nivel de razonamiento por tipo de tarea (04-IA, regla de determinismo):
 * - "estimate": features de estimación (F-IA-2/3/4/5) → coste/latencia bajos.
 * - "vision"/"coach": razonamiento por defecto del modelo.
 */
export type Task = "estimate" | "vision" | "coach";

/**
 * Ajustes de determinismo por proveedor (04-IA):
 * - Anthropic/OpenAI: `temperature: 0` SIEMPRE (misma entrada → misma salida).
 * - Google (Gemini 3.x): NO tocar temperature (Google lo desaconseja); usar
 *   `thinkingLevel: "low"` en estimación y el default en visión/coach. La menor
 *   garantía de determinismo se compensa con las cláusulas de consistencia que
 *   los prompts ya llevan ("la variante más común, de forma consistente").
 */
export interface DeterminismSettings {
  temperature?: number;
  providerOptions?: ProviderOptions;
}

export function determinismSettings(task: Task): DeterminismSettings {
  const provider = aiProvider();
  if (provider === "google") {
    // Visión (F-IA-1): razonamiento "medium" + resolución de imagen ALTA para
    // juzgar mejor proporciones/tamaño de ración. Compromiso: 04-IA decía
    // "default en visión", pero el default de Gemini 3.5 Flash tardaba ~1,6 min
    // (inviable en móvil); "medium" + alta resolución equilibra calidad/latencia.
    if (task === "vision") {
      return {
        providerOptions: {
          google: {
            thinkingConfig: { thinkingLevel: "medium" },
            mediaResolution: "MEDIA_RESOLUTION_HIGH",
          },
        },
      };
    }
    // Estimación de texto (F-IA-2/3/4/5): "low" (coste/latencia bajos).
    if (task === "estimate") {
      return {
        providerOptions: {
          google: { thinkingConfig: { thinkingLevel: "low" } },
        },
      };
    }
    return {}; // coach (Fase 4): thinking por defecto del modelo
  }
  // Anthropic / OpenAI
  return { temperature: 0 };
}
