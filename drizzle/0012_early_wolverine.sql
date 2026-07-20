WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "date", "occurred_at"
      ORDER BY "id"
    ) - 1 AS offset_micros
  FROM "bloat_events"
)
UPDATE "bloat_events" event
SET "occurred_at" = event."occurred_at" + ranked.offset_micros * interval '1 microsecond'
FROM ranked
WHERE event."id" = ranked."id"
  AND ranked.offset_micros > 0;--> statement-breakpoint
DROP INDEX "bloat_events_date_time_idx";--> statement-breakpoint
ALTER TABLE "bloat_events" ADD CONSTRAINT "bloat_events_date_time_unique" UNIQUE("date","occurred_at");
