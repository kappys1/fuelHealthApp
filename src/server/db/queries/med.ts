import { asc } from "drizzle-orm";
import {
  computeMedDeltas,
  type MedWithDelta,
} from "@/server/analytics/medDeltas";
import { db, schema } from "@/server/db";

/*
  Historial de mediciones del nutricionista (MED · F5). Se devuelve ascendente con
  la diferencia vs la medición anterior ya calculada (analytics/medDeltas, puro y
  testeado). Lo consume la pantalla MED, «Preparar visita» (F-IA-7) y el chat
  (F-IA-8) — todos comparan MED solo con MED (principio 5).
*/

export type { MedWithDelta } from "@/server/analytics/medDeltas";

export async function listMed(): Promise<MedWithDelta[]> {
  const rows = await db
    .select()
    .from(schema.medMeasurements)
    .orderBy(asc(schema.medMeasurements.date), asc(schema.medMeasurements.id));
  return computeMedDeltas(
    rows.map((r) => ({
      id: r.id,
      date: r.date,
      fatKg: r.fatKg,
      muscleKg: r.muscleKg,
      weightKg: r.weightKg,
    })),
  );
}
