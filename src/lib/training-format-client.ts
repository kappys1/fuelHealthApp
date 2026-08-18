import { api } from "@/lib/client-api";
import type { TrainingFormatOutcome } from "@/lib/training";

/*
  F25 · Fase 3 · El pegamento de los tres caminos de entrada.

  La regla que manda es del AC 10: **guardar una sesión no puede depender de que
  responda un modelo**. Por eso el fallo no se propaga nunca — se convierte en el
  texto original con `applied:false` y un motivo real que la UI pueda enseñar.
  Quien llama siempre recibe algo guardable y decide si avisar.
*/

/** Techo de espera. Pasado esto se sigue con el texto plano (AC 10). */
export const FORMAT_TIMEOUT_MS = 30_000;

/** La llamada de red, inyectable para poder probar el fallo sin mockear módulos. */
export type FormatCall = (
  contenido: string,
  signal: AbortSignal,
) => Promise<TrainingFormatOutcome>;

export async function formatOrKeep(
  contenido: string,
  call: FormatCall = (text, signal) => api.formatTraining(text, signal),
): Promise<TrainingFormatOutcome> {
  if (!contenido.trim()) {
    return { contenido, applied: false, groups: 0, reason: null };
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FORMAT_TIMEOUT_MS);
  try {
    return await call(contenido, abort.signal);
  } catch (error) {
    return {
      contenido,
      applied: false,
      groups: 0,
      reason: abort.signal.aborted
        ? "El formateo tardó demasiado; se ha guardado el texto tal cual."
        : error instanceof Error
          ? error.message
          : "No se pudo dar formato.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Aviso para el usuario tras formatear N contenidos, o null si todo fue bien.
 * Distingue los dos silencios que no son iguales: que la IA fallara (hay que
 * decirlo) y que no viera ningún grupo (no hay nada que avisar).
 */
export function formatNotice(outcomes: TrainingFormatOutcome[]): string | null {
  const failed = outcomes.filter((o) => !o.applied && o.reason !== null);
  if (failed.length === 0) return null;
  return failed.length === 1
    ? failed[0]!.reason
    : `${failed.length} sesiones se han guardado sin formato.`;
}
