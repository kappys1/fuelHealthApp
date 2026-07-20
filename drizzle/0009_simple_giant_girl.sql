CREATE TABLE "bloat_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bloat_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"severity" "bloat" NOT NULL,
	"occurred_at" time(0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bloat_events" ADD CONSTRAINT "bloat_events_date_days_date_fk" FOREIGN KEY ("date") REFERENCES "public"."days"("date") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bloat_events_date_time_idx" ON "bloat_events" USING btree ("date","occurred_at");