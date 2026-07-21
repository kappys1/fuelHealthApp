CREATE TYPE "public"."product_unit" AS ENUM('g', 'ml', 'ud');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit" "product_unit" DEFAULT 'g' NOT NULL;