import {
  applyTrainingFormat,
  stripTrainingGroupMarkers,
  type TrainingFormatOutcome,
} from "@/lib/training";
import { runStructured } from "./client";
import { trainingFormatPrompt } from "./prompts";
import { trainingFormatZ } from "./schemas";

/*
  F25 · El formateador y su red de seguridad, en un solo sitio.

  La decisión NO se toma aquí: se toma en `applyTrainingFormat` (pura y testeada,
  con los casos manipulados a propósito del AC 9). Este módulo solo hace las dos
  cosas que necesitan servidor — limpiar la entrada y llamar al modelo.
*/

/**
 * El presupuesto de salida tiene que cubrir el texto ENTERO de vuelta (es un
 * pase-a-través, no un resumen) más el razonamiento. Lección ya pagada tres
 * veces (DECISIONS #48/#52 y el título de F12): en Gemini 3.x los tokens de
 * thinking salen de `maxOutputTokens`, así que un techo justo trunca la
 * respuesta y el fallo aparece como "no se generó salida", no como truncado.
 * ~1 token cada 3 caracteres + 2.048 de colchón para el razonamiento.
 */
export function formatMaxOutputTokens(contenido: string): number {
  return Math.min(16384, 2048 + Math.ceil(contenido.length / 3));
}

/**
 * Marca los rótulos de grupo de una sesión. Devuelve SIEMPRE algo guardable:
 * si la IA se sale del contrato, `contenido` es el original intacto y `applied`
 * es false. Los errores del proveedor sí burbujean (errores de IA visibles):
 * de decidir si eso bloquea o no se encarga quien llama — no bloquea.
 */
export async function formatTrainingContent(
  contenido: string,
): Promise<TrainingFormatOutcome> {
  // Se limpia ANTES de llamar: el modelo siempre ve texto plano, así reformatear
  // dos veces no puede duplicar marcadores (AC 16, idempotencia por construcción).
  const original = stripTrainingGroupMarkers(contenido);
  if (!original.trim()) {
    return { contenido, applied: false, groups: 0, reason: null };
  }

  const out = await runStructured({
    kind: "format",
    task: "estimate",
    prompt: trainingFormatPrompt(original),
    schema: trainingFormatZ,
    maxOutputTokens: formatMaxOutputTokens(original),
  });
  return applyTrainingFormat(original, out.contenido);
}
