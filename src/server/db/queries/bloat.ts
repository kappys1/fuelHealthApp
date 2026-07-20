import { asc, desc, eq } from "drizzle-orm";
import type { BloatKey } from "@/lib/macros";
import { db, schema } from "@/server/db";
import { ensureDay } from "./mutations";

export interface BloatEventDTO {
  id: number;
  date: string;
  severity: BloatKey;
  /** Hora local del día en formato HH:mm:ss, tal como la devuelve Postgres. */
  occurredAt: string;
  createdAt: string;
}

function toDTO(row: typeof schema.bloatEvents.$inferSelect): BloatEventDTO {
  return {
    id: row.id,
    date: row.date,
    severity: row.severity as BloatKey,
    occurredAt: row.occurredAt,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export async function listBloatEvents(date: string): Promise<BloatEventDTO[]> {
  const rows = await db
    .select()
    .from(schema.bloatEvents)
    .where(eq(schema.bloatEvents.date, date))
    .orderBy(asc(schema.bloatEvents.occurredAt), asc(schema.bloatEvents.id));
  return rows.map(toDTO);
}

async function syncLegacySummary(date: string): Promise<void> {
  const [latest] = await db
    .select({ severity: schema.bloatEvents.severity })
    .from(schema.bloatEvents)
    .where(eq(schema.bloatEvents.date, date))
    .orderBy(desc(schema.bloatEvents.occurredAt), desc(schema.bloatEvents.id))
    .limit(1);

  await db
    .update(schema.days)
    .set({ bloat: latest?.severity ?? null })
    .where(eq(schema.days.date, date));
}

export async function createBloatEvent(input: {
  date: string;
  severity: BloatKey;
  occurredAt: string;
}): Promise<BloatEventDTO> {
  await ensureDay(input.date);
  const [row] = await db
    .insert(schema.bloatEvents)
    .values(input)
    .returning();
  if (!row) throw new Error("No se pudo guardar el marcador de hinchazón.");
  await syncLegacySummary(input.date);
  return toDTO(row);
}

export async function updateBloatEvent(
  id: number,
  patch: Partial<Pick<BloatEventDTO, "severity" | "occurredAt">>,
): Promise<BloatEventDTO | null> {
  const [row] = await db
    .update(schema.bloatEvents)
    .set(patch)
    .where(eq(schema.bloatEvents.id, id))
    .returning();
  if (!row) return null;
  await syncLegacySummary(row.date);
  return toDTO(row);
}

export async function deleteBloatEvent(id: number): Promise<BloatEventDTO | null> {
  const [row] = await db
    .delete(schema.bloatEvents)
    .where(eq(schema.bloatEvents.id, id))
    .returning();
  if (!row) return null;
  await syncLegacySummary(row.date);
  return toDTO(row);
}
