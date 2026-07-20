/**
 * Los datos introducidos conscientemente para un día prevalecen sobre la
 * importación; Health rellena únicamente cuando no existe valor manual.
 * `0` es un valor explícito y no se trata como ausencia.
 */
export function effectiveHealthMetric(
  manual: number | null | undefined,
  imported: number | null | undefined,
): number | null {
  return manual ?? imported ?? null;
}

export function importedHealthIsFallback(
  manual: number | null | undefined,
  imported: number | null | undefined,
): boolean {
  return manual == null && imported != null;
}
