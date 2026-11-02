import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').unique(),
    uiLocale: text('ui_locale').notNull().default('it'),
    ...auditColumns(),
  },
  (table) => [check('users_ui_locale_check', sql`${table.uiLocale} in ('it', 'en')`)],
).enableRLS();

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    name: text('name'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    ...auditColumns(),
  },
  (table) => [
    index('idx_devices_user').on(table.userId),
    check('devices_platform_check', sql`${table.platform} in ('android', 'ios', 'web', 'desktop')`),
  ],
).enableRLS();

export const learnerProfiles = pgTable(
  'learner_profiles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetLang: text('target_lang').notNull().default('en'),
    nativeLang: text('native_lang').notNull().default('it'),
    explanationMode: text('explanation_mode').notNull().default('target_simple'),
    proficiencyFramework: text('proficiency_framework').notNull().default('CEFR'),
    proficiencyEstimate: text('proficiency_estimate'),
    goal: text('goal'),
    dailyMinutes: integer('daily_minutes').notNull().default(20),
    streakMode: text('streak_mode').notNull().default('flexible'),
    timezone: text('timezone').notNull().default('Europe/Rome'),
    interestsJson: jsonb('interests_json')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    selfAssessmentJson: jsonb('self_assessment_json')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    ...auditColumns(),
  },
  (table) => [
    index('idx_profiles_user').on(table.userId),
    unique('learner_profiles_user_pair_unique').on(
      table.userId,
      table.targetLang,
      table.nativeLang,
    ),
    check(
      'learner_profiles_explanation_mode_check',
      sql`${table.explanationMode} in ('target_simple', 'native')`,
    ),
    check(
      'learner_profiles_goal_check',
      sql`${table.goal} is null or ${table.goal} in ('work', 'travel', 'daily', 'comprehension', 'exam')`,
    ),
    check('learner_profiles_daily_minutes_check', sql`${table.dailyMinutes} between 5 and 60`),
    check(
      'learner_profiles_streak_mode_check',
      sql`${table.streakMode} in ('daily', 'flexible', 'weekend_off')`,
    ),
  ],
).enableRLS();

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    version: text('version').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_consents_user').on(table.userId, table.kind),
    unique('consents_user_kind_version_unique').on(table.userId, table.kind, table.version),
    check(
      'consents_kind_check',
      sql`${table.kind} in ('terms', 'privacy', 'voice', 'ai_processing', 'analytics')`,
    ),
  ],
).enableRLS();

export const settings = pgTable(
  'settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    desiredRetention: real('desired_retention').notNull().default(0.9),
    aiDailyBudgetUsd: real('ai_daily_budget_usd').notNull().default(0.5),
    modelPrefsJson: jsonb('model_prefs_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    notificationJson: jsonb('notification_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...auditColumns(),
  },
  (table) => [
    check('settings_desired_retention_check', sql`${table.desiredRetention} between 0.80 and 0.95`),
    check('settings_ai_budget_check', sql`${table.aiDailyBudgetUsd} >= 0`),
  ],
).enableRLS();

export const backupMeta = pgTable(
  'backup_meta',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    formatVersion: integer('format_version').notNull(),
    schemaVersion: text('schema_version').notNull(),
    appVersion: text('app_version').notNull(),
    checksum: text('checksum').notNull(),
    location: text('location'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [index('idx_backup_meta_user').on(table.userId, table.createdAt)],
).enableRLS();

export const contentPacks = pgTable(
  'content_packs',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    targetLang: text('target_lang').notNull(),
    nativeLang: text('native_lang').notNull(),
    version: integer('version').notNull(),
    checksum: text('checksum').notNull(),
    minAppVersion: text('min_app_version'),
    itemCount: integer('item_count').notNull().default(0),
    mediaCount: integer('media_count').notNull().default(0),
    appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('content_packs_code_lang_version_unique').on(
      table.code,
      table.targetLang,
      table.nativeLang,
      table.version,
    ),
  ],
).enableRLS();

export const skills = pgTable(
  'skills',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    targetLang: text('target_lang').notNull(),
    domain: text('domain').notNull(),
    cefrLevel: text('cefr_level').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('skills_code_lang_unique').on(table.code, table.targetLang),
    index('idx_skills_lang_domain').on(table.targetLang, table.domain),
    check(
      'skills_domain_check',
      sql`${table.domain} in ('grammar','vocabulary','listening','speaking','pragmatics','reading','writing')`,
    ),
    check('skills_cefr_level_check', sql`${table.cefrLevel} in ('A1','A2','B1','B2','C1','C2')`),
  ],
).enableRLS();

export const concepts = pgTable(
  'concepts',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    targetLang: text('target_lang').notNull(),
    label: text('label').notNull(),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
    cefrLevel: text('cefr_level').notNull(),
    ruleText: text('rule_text'),
    explanationTarget: text('explanation_target'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('concepts_code_lang_unique').on(table.code, table.targetLang),
    index('idx_concepts_skill').on(table.skillId),
    check('concepts_cefr_level_check', sql`${table.cefrLevel} in ('A1','A2','B1','B2','C1','C2')`),
  ],
).enableRLS();

export const conceptEdges = pgTable(
  'concept_edges',
  {
    parentId: text('parent_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    childId: text('child_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    weight: real('weight').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.parentId, table.childId] }),
    check('concept_edges_weight_check', sql`${table.weight} between 0 and 1`),
    check('concept_edges_distinct_check', sql`${table.parentId} <> ${table.childId}`),
  ],
).enableRLS();

export const items = pgTable(
  'items',
  {
    id: text('id').primaryKey(),
    targetLang: text('target_lang').notNull(),
    nativeLang: text('native_lang'),
    type: text('type').notNull(),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
    cefrLevel: text('cefr_level').notNull(),
    promptJson: jsonb('prompt_json')
      .$type<{ prompt: string; options: readonly { id: string; text: string }[] }>()
      .notNull(),
    answerKeyJson: jsonb('answer_key_json').$type<{ correctOptionId: string }>().notNull(),
    explanationTarget: text('explanation_target'),
    difficultyB: real('difficulty_b').notNull().default(0),
    discrimination: real('discrimination').notNull().default(1.2),
    tagsJson: jsonb('tags_json')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    topic: text('topic'),
    register: text('register'),
    license: text('license'),
    audioRef: text('audio_ref'),
    reviewStatus: text('review_status').notNull().default('draft'),
    source: text('source').notNull().default('generated'),
    promptId: text('prompt_id'),
    promptVersion: integer('prompt_version'),
    contentPackId: text('content_pack_id').references(() => contentPacks.id),
    ownerUserId: uuid('owner_user_id').references(() => users.id),
    generatedForProfileId: uuid('generated_for_profile_id').references(() => learnerProfiles.id),
    generationReason: text('generation_reason'),
    autoValidated: boolean('auto_validated').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    retiredAt: timestamp('retired_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_items_skill_cefr').on(table.skillId, table.cefrLevel),
    index('idx_items_lang').on(table.targetLang, table.cefrLevel, table.difficultyB),
    index('idx_items_review').on(table.reviewStatus, table.targetLang),
    index('idx_items_owner').on(table.ownerUserId, table.expiresAt),
    check(
      'items_type_check',
      sql`${table.type} in ('cloze','transformation','word_order','dictation','listening_mcq','reading_mcq','free_writing','roleplay','shadowing','reuse_lexicon','error_spotting')`,
    ),
    check('items_cefr_level_check', sql`${table.cefrLevel} in ('A1','A2','B1','B2','C1','C2')`),
    check(
      'items_review_status_check',
      sql`${table.reviewStatus} in ('draft','pending','approved','rejected','retired')`,
    ),
    check(
      'items_register_check',
      sql`${table.register} is null or ${table.register} in ('casual','neutral','formal')`,
    ),
  ],
).enableRLS();

export const itemConcepts = pgTable(
  'item_concepts',
  {
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    weight: real('weight').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.itemId, table.conceptId] }),
    index('idx_item_concepts_concept').on(table.conceptId),
    check('item_concepts_weight_check', sql`${table.weight} between 0 and 1`),
  ],
).enableRLS();

export const assessments = pgTable(
  'assessments',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    kind: text('kind').notNull(),
    targetLang: text('target_lang').notNull(),
    overallLevel: text('overall_level'),
    confidence: real('confidence'),
    promptId: text('prompt_id'),
    promptVersion: integer('prompt_version'),
    rawJson: jsonb('raw_json').$type<Record<string, unknown>>().notNull(),
    status: text('status').notNull().default('in_progress'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_assessments_profile').on(table.profileId, table.createdAt),
    index('idx_assessments_user_status').on(table.userId, table.status),
    check('assessments_kind_check', sql`${table.kind} in ('placement','recheck','media_check')`),
    check(
      'assessments_status_check',
      sql`${table.status} in ('in_progress','completed','abandoned')`,
    ),
    check(
      'assessments_overall_level_check',
      sql`${table.overallLevel} is null or ${table.overallLevel} in ('A1','A2','B1','B2','C1','C2')`,
    ),
    check(
      'assessments_confidence_check',
      sql`${table.confidence} is null or ${table.confidence} between 0 and 1`,
    ),
  ],
).enableRLS();

export const assessmentScores = pgTable(
  'assessment_scores',
  {
    id: text('id').primaryKey(),
    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    dimension: text('dimension').notNull(),
    score: real('score').notNull(),
    confidence: real('confidence'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('assessment_scores_assessment_dimension_unique').on(table.assessmentId, table.dimension),
    check(
      'assessment_scores_dimension_check',
      sql`${table.dimension} in ('grammar','vocabulary','listening','speaking','reading','writing','pragmatics')`,
    ),
    check('assessment_scores_score_check', sql`${table.score} between 0 and 1`),
    check(
      'assessment_scores_confidence_check',
      sql`${table.confidence} is null or ${table.confidence} between 0 and 1`,
    ),
  ],
).enableRLS();

export const levelEvents = pgTable(
  'level_events',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').references(() => skills.id),
    fromLevel: text('from_level'),
    toLevel: text('to_level'),
    reason: text('reason').notNull(),
    detailJson: jsonb('detail_json').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_level_events_profile').on(table.profileId, table.createdAt),
    check(
      'level_events_reason_check',
      sql`${table.reason} in ('placement','test_out','promotion','remediation','challenge_pass','challenge_fail')`,
    ),
  ],
).enableRLS();

export const userSkillState = pgTable(
  'user_skill_state',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    theta: real('theta').notNull().default(0),
    se: real('se').notNull().default(1),
    nObs: integer('n_obs').notNull().default(0),
    mastery: real('mastery').notNull().default(0),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.skillId] }),
    check('user_skill_state_se_check', sql`${table.se} > 0`),
    check('user_skill_state_mastery_check', sql`${table.mastery} between 0 and 1`),
  ],
).enableRLS();

export const userConceptState = pgTable(
  'user_concept_state',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    mastery: real('mastery').notNull().default(0),
    evidenceCount: integer('evidence_count').notNull().default(0),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true, mode: 'date' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.conceptId] }),
    check('user_concept_state_mastery_check', sql`${table.mastery} between 0 and 1`),
  ],
).enableRLS();

export const M1_TABLES = [
  'users',
  'devices',
  'learner_profiles',
  'consents',
  'settings',
  'backup_meta',
] as const;

export type M1TableName = (typeof M1_TABLES)[number];

export const M2_TABLES = [
  'content_packs',
  'skills',
  'concepts',
  'concept_edges',
  'items',
  'item_concepts',
  'assessments',
  'assessment_scores',
  'level_events',
  'user_skill_state',
  'user_concept_state',
] as const;

export type M2TableName = (typeof M2_TABLES)[number];
