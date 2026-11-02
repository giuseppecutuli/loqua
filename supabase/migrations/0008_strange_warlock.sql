CREATE TABLE "session_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"audio_ref" text,
	"transcript_meta_json" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "session_turns_role_check" CHECK ("session_turns"."role" in ('user','tutor','system')),
	CONSTRAINT "session_turns_content_check" CHECK (length("session_turns"."content") > 0)
);
--> statement-breakpoint
ALTER TABLE "session_turns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_turns" ADD CONSTRAINT "session_turns_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_turns_session" ON "session_turns" USING btree ("session_id","created_at");