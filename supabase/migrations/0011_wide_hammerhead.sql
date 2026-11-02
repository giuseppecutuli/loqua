CREATE TABLE "user_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"kind" text NOT NULL,
	"comment" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "user_feedback_target_type_check" CHECK ("user_feedback"."target_type" in ('exercise','correction','session','media','app')),
	CONSTRAINT "user_feedback_kind_check" CHECK ("user_feedback"."kind" in ('helpful','not_helpful','wrong','too_easy','too_hard','report')),
	CONSTRAINT "user_feedback_status_check" CHECK ("user_feedback"."status" in ('open','reviewed','resolved'))
);
--> statement-breakpoint
ALTER TABLE "user_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_feedback_user_time" ON "user_feedback" USING btree ("user_id","created_at");