CREATE TYPE "public"."product_source" AS ENUM('etiqueta', 'manual', 'legacy');--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"base_g" integer,
	"base_kcal" integer NOT NULL,
	"base_prot" real NOT NULL,
	"base_carb" real NOT NULL,
	"base_fat" real NOT NULL,
	"grupo" "grp",
	"source" "product_source" NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_unique" UNIQUE("name")
);
