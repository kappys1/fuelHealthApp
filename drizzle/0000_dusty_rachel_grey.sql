CREATE TYPE "public"."bloat" AS ENUM('ninguna', 'leve', 'moderada', 'alta');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."grp" AS ENUM('Verdura', 'Hidratos', 'Proteína', 'Grasa', 'Otros', 'Opción única');--> statement-breakpoint
CREATE TYPE "public"."health_source" AS ENUM('endpoint', 'csv');--> statement-breakpoint
CREATE TYPE "public"."meal" AS ENUM('almuerzo', 'comida', 'merienda', 'cena', 'extra');--> statement-breakpoint
CREATE TYPE "public"."meal_source" AS ENUM('plan', 'foto', 'manual', 'ia', 'fav', 'plantilla');--> statement-breakpoint
CREATE TYPE "public"."phase" AS ENUM('normal', 'carga', 'competicion', 'recuperacion');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"thread_id" integer NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_threads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "day_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	CONSTRAINT "day_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "days" (
	"date" date PRIMARY KEY NOT NULL,
	"weight" real,
	"water_l" real,
	"body_fat_pct" real,
	"session_label" text,
	"session_kcal" integer,
	"phase" "phase",
	"bloat" "bloat",
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "diet_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "diet_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"effective_from" date NOT NULL,
	"kcal_target" integer NOT NULL,
	"prot_target" real NOT NULL,
	"carb_target" real,
	"fat_target" real,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "favorites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"meal" "meal" NOT NULL,
	"name" text NOT NULL,
	"kcal" integer NOT NULL,
	"prot" real NOT NULL,
	"carb" real NOT NULL,
	"fat" real NOT NULL,
	CONSTRAINT "favorites_meal_name_unique" UNIQUE("meal","name")
);
--> statement-breakpoint
CREATE TABLE "health_metrics" (
	"date" date PRIMARY KEY NOT NULL,
	"steps" integer,
	"active_kcal" integer,
	"basal_kcal" integer,
	"hrv_ms" real,
	"sleep_h" real,
	"resting_hr" integer,
	"vo2max" real,
	"water_l" real,
	"weight" real,
	"body_fat_pct" real,
	"source" "health_source" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meal_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"meal" "meal" NOT NULL,
	"name" text NOT NULL,
	"kcal" integer NOT NULL,
	"prot" real NOT NULL,
	"carb" real NOT NULL,
	"fat" real NOT NULL,
	"source" "meal_source" NOT NULL,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "med_measurements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "med_measurements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"fat_kg" real,
	"muscle_kg" real,
	"weight_kg" real
);
--> statement-breakpoint
CREATE TABLE "plan_options" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plan_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"diet_version_id" integer NOT NULL,
	"meal" "meal" NOT NULL,
	"grp" "grp" NOT NULL,
	"name" text NOT NULL,
	"base_g" integer,
	"kcal" integer NOT NULL,
	"prot" real NOT NULL,
	"carb" real NOT NULL,
	"fat" real NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workouts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"type" text NOT NULL,
	"duration_min" integer,
	"avg_hr" integer,
	"active_kcal" integer
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_date_days_date_fk" FOREIGN KEY ("date") REFERENCES "public"."days"("date") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_options" ADD CONSTRAINT "plan_options_diet_version_id_diet_versions_id_fk" FOREIGN KEY ("diet_version_id") REFERENCES "public"."diet_versions"("id") ON DELETE cascade ON UPDATE no action;