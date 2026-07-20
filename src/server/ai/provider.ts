import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { LanguageModel, ToolSet } from "ai";
import { aiApiKey, aiProvider, modelId, type ModelKind } from "./env";

/*
  Adaptador de proveedor (02-ARQUITECTURA §1/§3). El resto de la app solo conoce
  `resolveModel(kind)` y `determinismSettings(...)`; el proveedor concreto se
  decide por `AI_PROVIDER`. Google y Anthropic comparten la clave agnóstica
  `AI_API_KEY`; el resto de features y prompts no conoce el proveedor concreto.
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

let anthropicProvider: ReturnType<typeof createAnthropic> | null = null;
function anthropic() {
  if (!anthropicProvider) {
    anthropicProvider = createAnthropic({ apiKey: aiApiKey() });
  }
  return anthropicProvider;
}

export function resolveModel(kind: ModelKind): LanguageModel {
  const provider = aiProvider();
  const id = modelId(kind);
  switch (provider) {
    case "google":
      return google()(id);
    case "anthropic":
      return anthropic()(id);
    case "openai":
      throw new Error(
        `AI_PROVIDER="${provider}" aún no está cableado en server/ai/provider.ts.`,
      );
  }
}

/**
 * Búsqueda web del chat (F05 Fase 1 · DECISIONS #63). Tool `googleSearch` de
 * Gemini (provider-executed: la ejecuta Google en su servidor y devuelve el texto
 * ya fundamentado, así que el streaming de texto y el cliente NO cambian). Disparo
 * AUTOMÁTICO (el modelo decide cuándo buscar; la cita de fuente obligatoria del
 * prompt es la señal visible — Riesgo §2). SOLO Google la soporta; otros
 * proveedores devuelven {} (sin tool). Es la ÚNICA superficie con web: coach,
 * preparar-visita y estimador NUNCA la reciben (frontera dura del principio 2).
 * La clave del record ha de ser `google_search` (así lo exige @ai-sdk/google).
 */
export function webSearchTools(): ToolSet {
  if (aiProvider() === "google") {
    return { google_search: google().tools.googleSearch({}) };
  }
  return {};
}

/**
 * Nivel de razonamiento por tipo de tarea (04-IA, regla de determinismo):
 * - "estimate": features de estimación (F-IA-2/3/4/5) → coste/latencia bajos.
 * - "vision"/"coach": razonamiento por defecto del modelo.
 */
export type Task = "estimate" | "vision" | "coach";

/**
 * Ajustes de determinismo por proveedor (04-IA / principio 2 «consistencia»):
 * - `temperature: 0` SIEMPRE, TAMBIÉN en Google. El default de Gemini es 1.0
 *   (muy aleatorio): la misma entrada daba resultados dispares (p. ej. el
 *   analizador de WOD variaba de 150 a 240 min). Gemini soporta temperature 0
 *   (decodificación voraz) → misma entrada ≈ misma salida. Esto REVIERTE la
 *   decisión previa de "no fijar temperature en Google".
 * - Google además usa `thinkingLevel` por tarea (low en estimación, medium en
 *   visión) para equilibrar coste/latencia.
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
        temperature: 0,
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
        temperature: 0,
        providerOptions: {
          google: { thinkingConfig: { thinkingLevel: "low" } },
        },
      };
    }
    // Coach / preparar-visita (F-IA-6/7): thinking "medium" — es análisis (mejores
    // preguntas, mejor conexión de datos), NO estimación. El default de Gemini 3
    // gastaba tanto pensando que truncaba la respuesta; la clave NO es pensar menos
    // sino ACOTAR el thinking a "medium" y dar maxOutputTokens de sobra en la route
    // para que quepan razonamiento + texto completo (DECISIONS #48/#52).
    return {
      temperature: 0,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: "medium" } },
      },
    };
  }
  // Anthropic / OpenAI
  return { temperature: 0 };
}
