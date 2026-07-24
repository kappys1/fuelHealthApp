ALTER TABLE "training_plans" ADD COLUMN "import_request_id" text;--> statement-breakpoint
ALTER TABLE "training_plans" ADD COLUMN "import_fingerprint" text;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_import_request_id_unique" UNIQUE("import_request_id");