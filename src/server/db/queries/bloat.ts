import { asc, eq, sql } from "drizzle-orm";
import type { BloatKey } from "@/lib/macros";
import { db, schema } from "@/server/db";

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

export async function createBloatEvent(input: {
  date: string;
  severity: BloatKey;
  occurredAt: string;
}): Promise<BloatEventDTO> {
  const latestSeverity = sql<(typeof schema.bloatEnum.enumValues)[number] | null>`(
    select latest.severity
    from ${schema.bloatEvents} latest
    where latest.date = ${input.date}
    order by latest.occurred_at desc, latest.id desc
    limit 1
  )`;
  const [, rows] = await db.batch([
    db.insert(schema.days).values({ date: input.date }).onConflictDoNothing(),
    db
      .insert(schema.bloatEvents)
      .values(input)
      .onConflictDoUpdate({
        target: [schema.bloatEvents.date, schema.bloatEvents.occurredAt],
        set: { severity: input.severity },
      })
      .returning(),
    db
      .update(schema.days)
      .set({ bloat: latestSeverity })
      .where(eq(schema.days.date, input.date)),
  ]);
  const row = rows[0];
  if (!row) throw new Error("No se pudo guardar el marcador de hinchazón.");
  return toDTO(row);
}

export async function updateBloatEvent(
  id: number,
  patch: Partial<Pick<BloatEventDTO, "severity" | "occurredAt">>,
): Promise<BloatEventDTO | null> {
  const dateForId = sql<string>`(select ${schema.bloatEvents.date} from ${schema.bloatEvents} where ${schema.bloatEvents.id} = ${id})`;
  const latestSeverity = sql<(typeof schema.bloatEnum.enumValues)[number] | null>`(
    select latest.severity
    from ${schema.bloatEvents} latest
    where latest.date = ${dateForId}
    order by latest.occurred_at desc, latest.id desc
    limit 1
  )`;
  const [rows] = await db.batch([
    db
      .update(schema.bloatEvents)
      .set(patch)
      .where(eq(schema.bloatEvents.id, id))
      .returning(),
    db
      .update(schema.days)
      .set({ bloat: latestSeverity })
      .where(eq(schema.days.date, dateForId)),
  ]);
  const row = rows[0];
  if (!row) return null;
  return toDTO(row);
}

export async function deleteBloatEvent(id: number): Promise<BloatEventDTO | null> {
  const [existing] = await db
    .select({ date: schema.bloatEvents.date })
    .from(schema.bloatEvents)
    .where(eq(schema.bloatEvents.id, id));
  if (!existing) return null;
  const latestSeverity = sql<(typeof schema.bloatEnum.enumValues)[number] | null>`(
    select latest.severity
    from ${schema.bloatEvents} latest
    where latest.date = ${existing.date}
    order by latest.occurred_at desc, latest.id desc
    limit 1
  )`;
  const [rows] = await db.batch([
    db
      .delete(schema.bloatEvents)
      .where(eq(schema.bloatEvents.id, id))
      .returning(),
    db
      .update(schema.days)
      .set({ bloat: latestSeverity })
      .where(eq(schema.days.date, existing.date)),
  ]);
  const row = rows[0];
  if (!row) return null;
  return toDTO(row);
}
