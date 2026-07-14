CREATE TYPE "public"."mark_measure" AS ENUM('weight', 'time', 'reps', 'distance');--> statement-breakpoint
CREATE TABLE "mark_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mark_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mark_id" integer NOT NULL,
	"value" real NOT NULL,
	"recorded_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_marks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "performance_marks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"measure_type" "mark_measure" NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_mark_id_performance_marks_id_fk" FOREIGN KEY ("mark_id") REFERENCES "public"."performance_marks"("id") ON DELETE cascade ON UPDATE no action;