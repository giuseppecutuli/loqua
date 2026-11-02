CREATE TABLE "assessment_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"dimension" text NOT NULL,
	"score" real NOT NULL,
	"confidence" real,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "assessment_scores_assessment_dimension_unique" UNIQUE("assessment_id","dimension"),
	CONSTRAINT "assessment_scores_dimension_check" CHECK ("assessment_scores"."dimension" in ('grammar','vocabulary','listening','speaking','reading','writing','pragmatics')),
	CONSTRAINT "assessment_scores_score_check" CHECK ("assessment_scores"."score" between 0 and 1),
	CONSTRAINT "assessment_scores_confidence_check" CHECK ("assessment_scores"."confidence" is null or "assessment_scores"."confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "assessment_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"session_id" text,
	"kind" text NOT NULL,
	"target_lang" text NOT NULL,
	"overall_level" text,
	"confidence" real,
	"prompt_id" text,
	"prompt_version" integer,
	"raw_json" jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "assessments_kind_check" CHECK ("assessments"."kind" in ('placement','recheck','media_check')),
	CONSTRAINT "assessments_status_check" CHECK ("assessments"."status" in ('in_progress','completed','abandoned')),
	CONSTRAINT "assessments_overall_level_check" CHECK ("assessments"."overall_level" is null or "assessments"."overall_level" in ('A1','A2','B1','B2','C1','C2')),
	CONSTRAINT "assessments_confidence_check" CHECK ("assessments"."confidence" is null or "assessments"."confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "concept_edges" (
	"parent_id" text NOT NULL,
	"child_id" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	CONSTRAINT "concept_edges_parent_id_child_id_pk" PRIMARY KEY("parent_id","child_id"),
	CONSTRAINT "concept_edges_weight_check" CHECK ("concept_edges"."weight" between 0 and 1),
	CONSTRAINT "concept_edges_distinct_check" CHECK ("concept_edges"."parent_id" <> "concept_edges"."child_id")
);
--> statement-breakpoint
ALTER TABLE "concept_edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"target_lang" text NOT NULL,
	"label" text NOT NULL,
	"skill_id" text NOT NULL,
	"cefr_level" text NOT NULL,
	"rule_text" text,
	"explanation_target" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "concepts_code_lang_unique" UNIQUE("code","target_lang"),
	CONSTRAINT "concepts_cefr_level_check" CHECK ("concepts"."cefr_level" in ('A1','A2','B1','B2','C1','C2'))
);
--> statement-breakpoint
ALTER TABLE "concepts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_packs" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"target_lang" text NOT NULL,
	"native_lang" text NOT NULL,
	"version" integer NOT NULL,
	"checksum" text NOT NULL,
	"min_app_version" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"media_count" integer DEFAULT 0 NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "content_packs_code_lang_version_unique" UNIQUE("code","target_lang","native_lang","version")
);
--> statement-breakpoint
ALTER TABLE "content_packs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "item_concepts" (
	"item_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	CONSTRAINT "item_concepts_item_id_concept_id_pk" PRIMARY KEY("item_id","concept_id"),
	CONSTRAINT "item_concepts_weight_check" CHECK ("item_concepts"."weight" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "item_concepts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"target_lang" text NOT NULL,
	"native_lang" text,
	"type" text NOT NULL,
	"skill_id" text NOT NULL,
	"cefr_level" text NOT NULL,
	"prompt_json" jsonb NOT NULL,
	"answer_key_json" jsonb NOT NULL,
	"explanation_target" text,
	"difficulty_b" real DEFAULT 0 NOT NULL,
	"discrimination" real DEFAULT 1.2 NOT NULL,
	"tags_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topic" text,
	"register" text,
	"license" text,
	"audio_ref" text,
	"review_status" text DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'generated' NOT NULL,
	"prompt_id" text,
	"prompt_version" integer,
	"content_pack_id" text,
	"owner_user_id" uuid,
	"generated_for_profile_id" uuid,
	"generation_reason" text,
	"auto_validated" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "items_type_check" CHECK ("items"."type" in ('cloze','transformation','word_order','dictation','listening_mcq','reading_mcq','free_writing','roleplay','shadowing','reuse_lexicon','error_spotting')),
	CONSTRAINT "items_cefr_level_check" CHECK ("items"."cefr_level" in ('A1','A2','B1','B2','C1','C2')),
	CONSTRAINT "items_review_status_check" CHECK ("items"."review_status" in ('draft','pending','approved','rejected','retired')),
	CONSTRAINT "items_register_check" CHECK ("items"."register" is null or "items"."register" in ('casual','neutral','formal'))
);
--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "level_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"skill_id" text,
	"from_level" text,
	"to_level" text,
	"reason" text NOT NULL,
	"detail_json" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "level_events_reason_check" CHECK ("level_events"."reason" in ('placement','test_out','promotion','remediation','challenge_pass','challenge_fail'))
);
--> statement-breakpoint
ALTER TABLE "level_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"target_lang" text NOT NULL,
	"domain" text NOT NULL,
	"cefr_level" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "skills_code_lang_unique" UNIQUE("code","target_lang"),
	CONSTRAINT "skills_domain_check" CHECK ("skills"."domain" in ('grammar','vocabulary','listening','speaking','pragmatics','reading','writing')),
	CONSTRAINT "skills_cefr_level_check" CHECK ("skills"."cefr_level" in ('A1','A2','B1','B2','C1','C2'))
);
--> statement-breakpoint
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_concept_state" (
	"user_id" uuid NOT NULL,
	"concept_id" text NOT NULL,
	"mastery" real DEFAULT 0 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"last_error_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_concept_state_user_id_concept_id_pk" PRIMARY KEY("user_id","concept_id"),
	CONSTRAINT "user_concept_state_mastery_check" CHECK ("user_concept_state"."mastery" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "user_concept_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_skill_state" (
	"user_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"theta" real DEFAULT 0 NOT NULL,
	"se" real DEFAULT 1 NOT NULL,
	"n_obs" integer DEFAULT 0 NOT NULL,
	"mastery" real DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_skill_state_user_id_skill_id_pk" PRIMARY KEY("user_id","skill_id"),
	CONSTRAINT "user_skill_state_se_check" CHECK ("user_skill_state"."se" > 0),
	CONSTRAINT "user_skill_state_mastery_check" CHECK ("user_skill_state"."mastery" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "user_skill_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_parent_id_concepts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_child_id_concepts_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_concepts" ADD CONSTRAINT "item_concepts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_concepts" ADD CONSTRAINT "item_concepts_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_content_pack_id_content_packs_id_fk" FOREIGN KEY ("content_pack_id") REFERENCES "public"."content_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_generated_for_profile_id_learner_profiles_id_fk" FOREIGN KEY ("generated_for_profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_events" ADD CONSTRAINT "level_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_events" ADD CONSTRAINT "level_events_profile_id_learner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."learner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_events" ADD CONSTRAINT "level_events_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_concept_state" ADD CONSTRAINT "user_concept_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_concept_state" ADD CONSTRAINT "user_concept_state_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_state" ADD CONSTRAINT "user_skill_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skill_state" ADD CONSTRAINT "user_skill_state_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assessments_profile" ON "assessments" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_assessments_user_status" ON "assessments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_concepts_skill" ON "concepts" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "idx_item_concepts_concept" ON "item_concepts" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "idx_items_skill_cefr" ON "items" USING btree ("skill_id","cefr_level");--> statement-breakpoint
CREATE INDEX "idx_items_lang" ON "items" USING btree ("target_lang","cefr_level","difficulty_b");--> statement-breakpoint
CREATE INDEX "idx_items_review" ON "items" USING btree ("review_status","target_lang");--> statement-breakpoint
CREATE INDEX "idx_items_owner" ON "items" USING btree ("owner_user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_level_events_profile" ON "level_events" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_skills_lang_domain" ON "skills" USING btree ("target_lang","domain");