CREATE TYPE "public"."training_source" AS ENUM('pdf', 'foto', 'texto');--> statement-breakpoint
CREATE TYPE "public"."training_tipo" AS ENUM('fuerza', 'halterofilia', 'gimnasticos', 'metabolico', 'aerobico', 'mixto', 'descanso', 'otro');--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "training_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"programa" text NOT NULL,
	"etiqueta" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"source" "training_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "training_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_id" integer NOT NULL,
	"key" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "training_tipo" NOT NULL,
	"contenido" text NOT NULL,
	"kcal_min" integer,
	"kcal_max" integer,
	"duracion_min" integer,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "session_ref" integer;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_session_ref_training_sessions_id_fk" FOREIGN KEY ("session_ref") REFERENCES "public"."training_sessions"("id") ON DELETE set null ON UPDATE no action;