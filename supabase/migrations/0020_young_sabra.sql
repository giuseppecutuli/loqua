CREATE TABLE "media_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"region" text NOT NULL,
	"provider" text NOT NULL,
	"access_type" text NOT NULL,
	"provider_url" text,
	"price_note" text,
	"last_checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_availability_media_region_provider_access_unique" UNIQUE("media_id","region","provider","access_type"),
	CONSTRAINT "media_availability_access_type_check" CHECK ("media_availability"."access_type" in ('subscription','rent','buy','free','library'))
);
--> statement-breakpoint
ALTER TABLE "media_availability" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media_guides" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"profile_id" uuid,
	"cefr_level" text NOT NULL,
	"guide_json" jsonb NOT NULL,
	"prompt_id" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_guides_media_profile_level_prompt_unique" UNIQUE("media_id","profile_id","cefr_level","prompt_version"),
	CONSTRAINT "media_guides_cefr_level_check" CHECK ("media_guides"."cefr_level" in ('A1','A2','B1','B2','C1','C2'))
);
--> statement-breakpoint
ALTER TABLE "media_guides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media_phrases" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"target_lang" text NOT NULL,
	"phrase" text NOT NULL,
	"normalized" text NOT NULL,
	"location_ref" text,
	"note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_phrases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_id" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"progress_pct" real DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_progress_profile_media_unique" UNIQUE("profile_id","media_id"),
	CONSTRAINT "media_progress_status_check" CHECK ("media_progress"."status" in ('planned','watching','reading','finished','abandoned')),
	CONSTRAINT "media_progress_progress_pct_check" CHECK ("media_progress"."progress_pct" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "media_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media_title_tags" (
	"media_id" text NOT NULL,
	"tag" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	CONSTRAINT "media_title_tags_media_id_tag_pk" PRIMARY KEY("media_id","tag"),
	CONSTRAINT "media_title_tags_weight_check" CHECK ("media_title_tags"."weight" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "media_title_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media_titles" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"target_lang" text NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"release_year" integer,
	"synopsis_native" text,
	"difficulty_band" text,
	"difficulty_score" real,
	"coverage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"editorial_quality" real DEFAULT 3 NOT NULL,
	"language_variety" text,
	"subtitle_availability_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"speech_rate_wpm" integer,
	"duration_minutes" integer,
	"episode_count" integer,
	"episode_minutes" integer,
	"page_count" integer,
	"age_rating" text,
	"content_warnings_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"genres_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"themes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_ids_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cover_ref" text,
	"license_note" text,
	"review_status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_titles_kind_check" CHECK ("media_titles"."kind" in ('movie','series','book','podcast')),
	CONSTRAINT "media_titles_difficulty_band_check" CHECK ("media_titles"."difficulty_band" is null or "media_titles"."difficulty_band" in ('A1','A2','B1','B2','C1','C2')),
	CONSTRAINT "media_titles_difficulty_score_check" CHECK ("media_titles"."difficulty_score" is null or "media_titles"."difficulty_score" between 0 and 1),
	CONSTRAINT "media_titles_editorial_quality_check" CHECK ("media_titles"."editorial_quality" between 1 and 5),
	CONSTRAINT "media_titles_language_variety_check" CHECK ("media_titles"."language_variety" is null or "media_titles"."language_variety" in ('us','uk','au','mixed')),
	CONSTRAINT "media_titles_review_status_check" CHECK ("media_titles"."review_status" in ('draft','approved','rejected','retired'))
);
--> statement-breakpoint
ALTER TABLE "media_titles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"recommendation_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer,
	"reason_code" text,
	"difficulty_feedback" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "recommendation_feedback_recommendation_user_unique" UNIQUE("recommendation_id","user_id"),
	CONSTRAINT "recommendation_feedback_rating_check" CHECK ("recommendation_feedback"."rating" is null or "recommendation_feedback"."rating" between 1 and 5),
	CONSTRAINT "recommendation_feedback_difficulty_check" CHECK ("recommendation_feedback"."difficulty_feedback" is null or "recommendation_feedback"."difficulty_feedback" in ('too_easy','ok','too_hard'))
);
--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_id" text NOT NULL,
	"score" real NOT NULL,
	"score_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason_text" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'shown' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "recommendations_source_check" CHECK ("recommendations"."source" in ('rule','llm')),
	CONSTRAINT "recommendations_status_check" CHECK ("recommendations"."status" in ('shown','accepted','rejected','started','finished','abandoned','expired'))
);
--> statement-breakpoint
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_taste_profile" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"formats_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"genres_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"themes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disliked_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"genre_weights_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theme_weights_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"difficulty_tolerance" text DEFAULT 'balanced' NOT NULL,
	"subtitle_pref" text DEFAULT 'target' NOT NULL,
	"accents_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region" text DEFAULT 'IT' NOT NULL,
	"weekly_minutes" integer DEFAULT 120 NOT NULL,
	"max_age_rating" text,
	"coverage_offset" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_taste_profile_difficulty_tolerance_check" CHECK ("user_taste_profile"."difficulty_tolerance" in ('easy','balanced','challenging')),
	CONSTRAINT "user_taste_profile_subtitle_pref_check" CHECK ("user_taste_profile"."subtitle_pref" in ('target','native','both','none')),
	CONSTRAINT "user_taste_profile_weekly_minutes_check" CHECK ("user_taste_profile"."weekly_minutes" between 30 and 900),
	CONSTRAINT "user_taste_profile_coverage_offset_check" CHECK ("user_taste_profile"."coverage_offset" between -0.02 and 0.02)
);
--> statement-breakpoint
ALTER TABLE "user_taste_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_availability" ADD CONSTRAINT "media_availability_media_id_media_titles_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_guides" ADD CONSTRAINT "media_guides_media_id_media_titles_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_guides" ADD CONSTRAINT "media_guides_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_phrases" ADD CONSTRAINT "media_phrases_media_id_media_titles_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_progress" ADD CONSTRAINT "media_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_progress" ADD CONSTRAINT "media_progress_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_progress" ADD CONSTRAINT "media_progress_media_id_media_titles_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_titles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_title_tags" ADD CONSTRAINT "media_title_tags_media_id_media_titles_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_media_id_media_titles_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_titles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_taste_profile" ADD CONSTRAINT "user_taste_profile_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_availability_region_provider" ON "media_availability" USING btree ("region","provider");--> statement-breakpoint
CREATE INDEX "idx_media_guides_media_profile" ON "media_guides" USING btree ("media_id","profile_id");--> statement-breakpoint
CREATE INDEX "idx_media_phrases_media" ON "media_phrases" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "idx_media_progress_profile_status" ON "media_progress" USING btree ("profile_id","status");--> statement-breakpoint
CREATE INDEX "idx_media_titles_level" ON "media_titles" USING btree ("kind","target_lang","difficulty_score");--> statement-breakpoint
CREATE INDEX "idx_media_titles_review" ON "media_titles" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "idx_recommendation_feedback_user_time" ON "recommendation_feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_recommendations_profile_status_time" ON "recommendations" USING btree ("profile_id","status","created_at");