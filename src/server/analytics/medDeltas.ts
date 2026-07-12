/*
  Diferencias entre mediciones del nutricionista (MED · F5.2) — PURO.

  Regla NO negociable (principio 5 + F5.2): la diferencia se calcula SIEMPRE como
  `actual − anterior`. El Excel del dietista trae los signos volteados; la app
  nunca los copia, los recalcula. El color semántico lo decide la UI según la
  dirección favorable de cada métrica (grasa↓ bien, músculo↑ bien).

  Vive en analytics (no en el componente) por la regla «ni una fórmula en
  componentes»: la usa tanto la query de servidor como la tabla del cliente.
*/

export interface MedMeasurement {
  id: number;
  date: string; // 'YYYY-MM-DD' (Europe/Madrid)
  fatKg: number | null;
  muscleKg: number | null;
  weightKg: number | null;
}

export interface MedDelta {
  fatKg: number | null;
  muscleKg: number | null;
  weightKg: number | null;
}

export interface MedWithDelta extends MedMeasurement {
  /** Diferencia vs la MED inmediatamente anterior (actual − anterior). */
  delta: MedDelta;
}

/** Redondea a 2 decimales evitando arrastre binario. null si falta algún extremo. */
function diff(cur: number | null, prev: number | null | undefined): number | null {
  if (cur == null || prev == null) return null;
  return Math.round((cur - prev) * 100) / 100;
}

/**
 * Ordena por fecha ascendente y añade la diferencia vs la medición anterior.
 * La primera medición no tiene anterior → deltas null.
 */
export function computeMedDeltas(
  rows: readonly MedMeasurement[],
): MedWithDelta[] {
  const asc = [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  );
  return asc.map((r, i) => {
    const prev = i > 0 ? asc[i - 1]! : null;
    return {
      ...r,
      delta: {
        fatKg: diff(r.fatKg, prev?.fatKg),
        muscleKg: diff(r.muscleKg, prev?.muscleKg),
        weightKg: diff(r.weightKg, prev?.weightKg),
      },
    };
  });
}
