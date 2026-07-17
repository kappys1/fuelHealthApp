import {
  generateText,
  type ModelMessage,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
} from "ai";
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
      // Fallos de GENERACIÓN (reintentables); los del proveedor (APICallError:
      // key, rate-limit, red…) burbujean a la route. `generateText` + Output.object
      // lanza DOS clases distintas: NoObjectGeneratedError (hubo texto pero no cuadró
      // con el schema) y NoOutputGeneratedError (no hubo salida útil — p. ej. el
      // thinking de Gemini agotó maxOutputTokens y truncó antes del JSON). Antes solo
      // capturábamos la primera → la segunda burbujeaba cruda y la route la devolvía
      // como 500 genérico, sin reintento ni mensaje (rompía «errores de IA siempre
      // visibles»). Ahora ambas → reintento y, si persiste, AiParseError (502 visible).
      if (
        !NoObjectGeneratedError.isInstance(err) &&
        !NoOutputGeneratedError.isInstance(err)
      ) {
        throw err;
      }
      lastError =
        err.cause instanceof Error
          ? err.cause.message
          : NoObjectGeneratedError.isInstance(err)
            ? (err.text ?? err.message)
            : err.message;
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

export interface RunTextOptions {
  kind: ModelKind;
  task: Task;
  prompt: string;
  images?: AiImage[];
  maxOutputTokens: number;
}

/*
  Respuesta en TEXTO plano (coach F-IA-6, preparar-visita F-IA-7): no hay schema
  ni Output.object. Los errores del proveedor (APICallError) burbujean a la route
  (errors.ts los hace visibles). El chat (F-IA-8) va por streaming aparte.
*/
export async function runText(opts: RunTextOptions): Promise<string> {
  const model = resolveModel(opts.kind);
  const settings = determinismSettings(opts.task);
  const { text } = await generateText({
    model,
    messages: buildMessages(opts.prompt, opts.images),
    maxOutputTokens: opts.maxOutputTokens,
    ...settings,
  });
  return text;
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
