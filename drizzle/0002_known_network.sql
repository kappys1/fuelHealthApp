ALTER TABLE "chat_threads" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "summary_msg_count" integer DEFAULT 0 NOT NULL;