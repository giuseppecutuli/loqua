CREATE TABLE "xp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "xp_events_unique_source" UNIQUE("user_id","profile_id","source_type","source_id","reason"),
	CONSTRAINT "xp_events_amount_check" CHECK ("xp_events"."amount" >= 0),
	CONSTRAINT "xp_events_reason_check" CHECK ("xp_events"."reason" in ('correct_attempt','quest','mission','badge','streak_repair','conversation'))
);
--> statement-breakpoint
ALTER TABLE "xp_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_xp_events_user_time" ON "xp_events" USING btree ("user_id","created_at");