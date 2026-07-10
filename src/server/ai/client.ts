import { generateText, type ModelMessage, NoObjectGeneratedError, Output } from "ai";
import type { z } from "zod";
import type { ModelKind } from "./env";
import { AiParseError } from "./errors";
import { determinismSettings, resolveModel, type Task } from "./provider";

/*
  Núcleo de llamada a IA (04-IA §"Reglas globales", CLAUDE.md):
  - Prompts LITERALES (los construye server/ai/prompts.ts) — aquí no se toca texto.
  - Salida estructurada NATIVA del proveedor (Output.object): con Google esto
    fuerza responseSchema y garantiza JSON válido contra el schema Zod. Sustituye
    al parseo manual (04-IA §6 asumía Claude; con Gemini, un modelo de visión
    "hablador" producía JSON malformado — la propia spec pide revalidar la
    disciplina JSON al cambiar de proveedor).
  - Si el objeto no se genera: 1 reintento AÑADIENDO al prompt el error.
  - Si vuelve a fallar: AiParseError → la route lo hace visible (errors.ts).
  - Errores del proveedor (APICallError) burbujean tal cual a la route.
*/

export interface AiImage {
  /** base64 SIN prefijo data-url. */
  base64: string;
  /** p. ej. "image/jpeg". */
  mediaType: string;
}

export interface RunOptions<T> {
  kind: ModelKind;
  task: Task;
  prompt: string;
  images?: AiImage[];
  schema: z.ZodType<T>;
  maxOutputTokens: number;
}

export async function runStructured<T>(opts: RunOptions<T>): Promise<T> {
  const model = resolveModel(opts.kind);
  const settings = determinismSettings(opts.task);

  let prompt = opts.prompt;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model,
        messages: buildMessages(prompt, opts.images),
        maxOutputTokens: opts.maxOutputTokens,
        output: Output.object({ schema: opts.schema }),
        ...settings,
      });
      return output;
    } catch (err) {
      // Solo tratamos aquí el fallo de generación de objeto; los errores del
      // proveedor (APICallError: key, rate-limit, red…) burbujean a la route.
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      lastError =
        err.cause instanceof Error ? err.cause.message : (err.text ?? err.message);
      if (attempt === 0) {
        // Reintento: se re-adjunta el error al prompt original (04-IA §6).
        prompt = `${opts.prompt}\n\nTu respuesta anterior no se pudo procesar (${lastError}). Responde SOLO con JSON válido que cumpla EXACTAMENTE el formato pedido, sin markdown ni texto extra.`;
      }
    }
  }

  throw new AiParseError(
    `no se pudo interpretar la respuesta tras un reintento (${lastError}).`,
    lastError,
  );
}

function buildMessages(prompt: string, images?: AiImage[]): ModelMessage[] {
  if (!images || images.length === 0) {
    return [{ role: "user", content: prompt }];
  }
  // Orden 04-IA: bloque imagen + bloque texto.
  return [
    {
      role: "user",
      content: [
        ...images.map((im) => ({
          type: "file" as const,
          mediaType: im.mediaType,
          data: im.base64,
        })),
        { type: "text" as const, text: prompt },
      ],
    },
  ];
}
