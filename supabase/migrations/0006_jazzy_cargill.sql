CREATE TABLE "attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"session_id" text,
	"session_item_id" text,
	"correct" boolean NOT NULL,
	"score" real,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"hint_used" boolean DEFAULT false NOT NULL,
	"response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attempts_score_check" CHECK ("attempts"."score" is null or "attempts"."score" between 0 and 1),
	CONSTRAINT "attempts_latency_check" CHECK ("attempts"."latency_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text,
	"source" text NOT NULL,
	"span" text NOT NULL,
	"error_type" text NOT NULL,
	"rule_id" text,
	"severity" text NOT NULL,
	"confidence" real NOT NULL,
	"shown_to_user" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "error_events_source_check" CHECK ("error_events"."source" in ('exercise','conversation','assessment','media','self_report')),
	CONSTRAINT "error_events_severity_check" CHECK ("error_events"."severity" in ('low','medium','high')),
	CONSTRAINT "error_events_confidence_check" CHECK ("error_events"."confidence" between 0 and 1),
	CONSTRAINT "error_events_status_check" CHECK ("error_events"."status" in ('open','resolved','ignored'))
);
--> statement-breakpoint
ALTER TABLE "error_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saved_phrases" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"target_lang" text NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "saved_phrases_profile_normalized_unique" UNIQUE("profile_id","normalized_text"),
	CONSTRAINT "saved_phrases_source_check" CHECK ("saved_phrases"."source" in ('exercise','conversation','media','manual'))
);
--> statement-breakpoint
ALTER TABLE "saved_phrases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"item_id" text NOT NULL,
	"block" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"rationale_code" text NOT NULL,
	"rationale_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"served_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "session_items_session_item_unique" UNIQUE("session_id","item_id"),
	CONSTRAINT "session_items_block_check" CHECK ("session_items"."block" in ('review','input','production','assessment','immersive')),
	CONSTRAINT "session_items_status_check" CHECK ("session_items"."status" in ('pending','answered','skipped'))
);
--> statement-breakpoint
ALTER TABLE "session_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"target_lang" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"turns" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sessions_kind_check" CHECK ("sessions"."kind" in ('lesson','review','conversation','assessment','micro','immersive')),
	CONSTRAINT "sessions_status_check" CHECK ("sessions"."status" in ('planned','in_progress','completed','abandoned')),
	CONSTRAINT "sessions_turns_check" CHECK ("sessions"."turns" >= 0),
	CONSTRAINT "sessions_tokens_in_check" CHECK ("sessions"."tokens_in" >= 0),
	CONSTRAINT "sessions_tokens_out_check" CHECK ("sessions"."tokens_out" >= 0),
	CONSTRAINT "sessions_cost_check" CHECK ("sessions"."cost_usd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "srs_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"card_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"fsrs_json" jsonb NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	"stability" real DEFAULT 0 NOT NULL,
	"difficulty" real DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"leech" boolean DEFAULT false NOT NULL,
	"last_review_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "srs_cards_source_unique" UNIQUE("user_id","source_type","source_id","card_type"),
	CONSTRAINT "srs_cards_card_type_check" CHECK ("srs_cards"."card_type" in ('recognition','production')),
	CONSTRAINT "srs_cards_source_type_check" CHECK ("srs_cards"."source_type" in ('item','saved_phrase','media_phrase')),
	CONSTRAINT "srs_cards_state_check" CHECK ("srs_cards"."state" in ('new','learning','review','relearning')),
	CONSTRAINT "srs_cards_stability_check" CHECK ("srs_cards"."stability" >= 0),
	CONSTRAINT "srs_cards_difficulty_check" CHECK ("srs_cards"."difficulty" >= 0),
	CONSTRAINT "srs_cards_reps_check" CHECK ("srs_cards"."reps" >= 0),
	CONSTRAINT "srs_cards_lapses_check" CHECK ("srs_cards"."lapses" >= 0)
);
--> statement-breakpoint
ALTER TABLE "srs_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "srs_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"elapsed_days" real DEFAULT 0 NOT NULL,
	"scheduled_days" real DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "srs_reviews_rating_check" CHECK ("srs_reviews"."rating" between 1 and 4),
	CONSTRAINT "srs_reviews_elapsed_check" CHECK ("srs_reviews"."elapsed_days" >= 0),
	CONSTRAINT "srs_reviews_scheduled_check" CHECK ("srs_reviews"."scheduled_days" >= 0),
	CONSTRAINT "srs_reviews_duration_check" CHECK ("srs_reviews"."duration_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "srs_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_item_id_session_items_id_fk" FOREIGN KEY ("session_item_id") REFERENCES "public"."session_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_phrases" ADD CONSTRAINT "saved_phrases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_phrases" ADD CONSTRAINT "saved_phrases_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_reviews" ADD CONSTRAINT "srs_reviews_card_id_srs_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."srs_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_reviews" ADD CONSTRAINT "srs_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attempts_user_time" ON "attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_attempts_item" ON "attempts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_attempts_session" ON "attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_errors_user_time" ON "error_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_errors_rule" ON "error_events" USING btree ("user_id","rule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_errors_open" ON "error_events" USING btree ("user_id","status") WHERE "error_events"."status" = 'open';--> statement-breakpoint
CREATE INDEX "idx_saved_phrases_profile" ON "saved_phrases" USING btree ("profile_id","created_at") WHERE "saved_phrases"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_session_items_session" ON "session_items" USING btree ("session_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_session_items_item" ON "session_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_time" ON "sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_profile_status" ON "sessions" USING btree ("profile_id","status");--> statement-breakpoint
CREATE INDEX "idx_srs_due" ON "srs_cards" USING btree ("user_id","due_at") WHERE "srs_cards"."deleted_at" is null and "srs_cards"."suspended" = false;--> statement-breakpoint
CREATE INDEX "idx_srs_source" ON "srs_cards" USING btree ("user_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_srs_reviews_card" ON "srs_reviews" USING btree ("card_id","reviewed_at");