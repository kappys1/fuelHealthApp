ALTER TABLE "meal_entries" ADD COLUMN "client_mutation_id" text;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD COLUMN "client_mutation_index" integer;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_client_mutation_item_unique" UNIQUE("client_mutation_id","client_mutation_index");