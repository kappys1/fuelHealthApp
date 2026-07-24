ALTER TABLE "chat_messages" ADD COLUMN "turn_id" text;--> statement-breakpoint
CREATE INDEX "chat_messages_thread_created_idx" ON "chat_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_turn_role_unique" UNIQUE("turn_id","role");