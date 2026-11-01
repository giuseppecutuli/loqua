CREATE TABLE "backup_meta" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"format_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"app_version" text NOT NULL,
	"checksum" text NOT NULL,
	"location" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backup_meta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "consents_user_kind_version_unique" UNIQUE("user_id","kind","version"),
	CONSTRAINT "consents_kind_check" CHECK ("consents"."kind" in ('terms', 'privacy', 'voice', 'ai_processing', 'analytics'))
);
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"name" text,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "devices_platform_check" CHECK ("devices"."platform" in ('android', 'ios', 'web', 'desktop'))
);
--> statement-breakpoint
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learner_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"target_lang" text DEFAULT 'en' NOT NULL,
	"native_lang" text DEFAULT 'it' NOT NULL,
	"explanation_mode" text DEFAULT 'target_simple' NOT NULL,
	"proficiency_framework" text DEFAULT 'CEFR' NOT NULL,
	"proficiency_estimate" text,
	"goal" text,
	"daily_minutes" integer DEFAULT 20 NOT NULL,
	"streak_mode" text DEFAULT 'flexible' NOT NULL,
	"timezone" text DEFAULT 'Europe/Rome' NOT NULL,
	"interests_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"self_assessment_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "learner_profiles_user_pair_unique" UNIQUE("user_id","target_lang","native_lang"),
	CONSTRAINT "learner_profiles_explanation_mode_check" CHECK ("learner_profiles"."explanation_mode" in ('target_simple', 'native')),
	CONSTRAINT "learner_profiles_goal_check" CHECK ("learner_profiles"."goal" is null or "learner_profiles"."goal" in ('work', 'travel', 'daily', 'comprehension', 'exam')),
	CONSTRAINT "learner_profiles_daily_minutes_check" CHECK ("learner_profiles"."daily_minutes" between 5 and 60),
	CONSTRAINT "learner_profiles_streak_mode_check" CHECK ("learner_profiles"."streak_mode" in ('daily', 'flexible', 'weekend_off'))
);
--> statement-breakpoint
ALTER TABLE "learner_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"desired_retention" real DEFAULT 0.9 NOT NULL,
	"ai_daily_budget_usd" real DEFAULT 0.5 NOT NULL,
	"model_prefs_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notification_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "settings_desired_retention_check" CHECK ("settings"."desired_retention" between 0.80 and 0.95),
	CONSTRAINT "settings_ai_budget_check" CHECK ("settings"."ai_daily_budget_usd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_conflict_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"resolution" text NOT NULL,
	"detail_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_conflict_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_state" (
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"last_pull_at" timestamp with time zone,
	"last_push_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sync_state_user_id_device_id_pk" PRIMARY KEY("user_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "sync_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"ui_locale" text DEFAULT 'it' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_ui_locale_check" CHECK ("users"."ui_locale" in ('it', 'en'))
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "backup_meta" ADD CONSTRAINT "backup_meta_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_conflict_log" ADD CONSTRAINT "sync_conflict_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backup_meta_user" ON "backup_meta" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_consents_user" ON "consents" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "idx_devices_user" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_user" ON "learner_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sync_conflicts_user" ON "sync_conflict_log" USING btree ("user_id","created_at");