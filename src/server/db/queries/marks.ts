import { asc, eq } from "drizzle-orm";
import type { MeasureType } from "@/lib/marks";
import { db, schema } from "@/server/db";

/*
  Queries de marcas / registros de rendimiento (F03). Molde: med.ts (CRUD retroactivo
  con fecha libre) + training.ts (padre + hijos). "Última"/"mejor"/"¿mejora?" NO se
  calculan aquí: se derivan en lectura con lib/marks.ts (client-safe) → sin
  desincronización. Estas queries solo leen/escriben filas.
*/

export interface MarkEntryDTO {
  id: number;
  markId: number;
  value: number;
  recordedOn: string;
  note: string | null;
}

export interface MarkDTO {
  id: number;
  name: string;
  measureType: MeasureType;
  unit: string;
  family: string | null;
  entries: MarkEntryDTO[];
}

/**
 * Todas las marcas con sus entradas (ascendente por fecha). Datos pequeños para un
 * usuario único → sin lazy-load. Lo consumen el bloque de Plan·Entrenos, el sheet
 * de detalle, el carril del Historial y el contexto de IA (Chat/Visita).
 */
export async function listMarksWithEntries(): Promise<MarkDTO[]> {
  const [marks, entries] = await Promise.all([
    db
      .select()
      .from(schema.performanceMarks)
      .orderBy(
        asc(schema.performanceMarks.name),
        asc(schema.performanceMarks.id),
      ),
    db
      .select()
      .from(schema.markEntries)
      .orderBy(
        asc(schema.markEntries.recordedOn),
        asc(schema.markEntries.id),
      ),
  ]);

  const byMark = new Map<number, MarkEntryDTO[]>();
  for (const e of entries) {
    const list = byMark.get(e.markId) ?? [];
    list.push({
      id: e.id,
      markId: e.markId,
      value: e.value,
      recordedOn: e.recordedOn,
      note: e.note,
    });
    byMark.set(e.markId, list);
  }

  return marks.map((m) => ({
    id: m.id,
    name: m.name,
    measureType: m.measureType as MeasureType,
    unit: m.unit,
    family: m.family,
    entries: byMark.get(m.id) ?? [],
  }));
}

export async function createMark(input: {
  name: string;
  measureType: MeasureType;
  unit: string;
  family?: string | null;
}): Promise<{ id: number }> {
  const [row] = await db
    .insert(schema.performanceMarks)
    .values({
      name: input.name,
      measureType: input.measureType,
      unit: input.unit,
      family: input.family ?? null,
    })
    .returning({ id: schema.performanceMarks.id });
  if (!row) throw new Error("No se pudo crear la marca.");
  return row;
}

export async function addMarkEntry(input: {
  markId: number;
  value: number;
  recordedOn: string;
  note: string | null;
}): Promise<MarkEntryDTO> {
  const [row] = await db
    .insert(schema.markEntries)
    .values({
      markId: input.markId,
      value: input.value,
      recordedOn: input.recordedOn,
      note: input.note,
    })
    .returning();
  if (!row) throw new Error("No se pudo añadir la entrada.");
  return {
    id: row.id,
    markId: row.markId,
    value: row.value,
    recordedOn: row.recordedOn,
    note: row.note,
  };
}

export async function updateMarkEntry(
  id: number,
  patch: { value?: number; recordedOn?: string; note?: string | null },
): Promise<void> {
  await db.update(schema.markEntries).set(patch).where(eq(schema.markEntries.id, id));
}

export async function deleteMarkEntry(id: number): Promise<void> {
  await db.delete(schema.markEntries).where(eq(schema.markEntries.id, id));
}

/** Borra una marca entera (cascade a sus entradas). Requiere confirmación en UI (07). */
export async function deleteMark(id: number): Promise<void> {
  await db.delete(schema.performanceMarks).where(eq(schema.performanceMarks.id, id));
}
