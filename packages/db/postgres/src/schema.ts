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

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: 'cascade' }),
    targetLang: text('target_lang').notNull(),
    scenarioId: text('scenario_id'),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('planned'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
    turns: integer('turns').notNull().default(0),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costUsd: real('cost_usd').notNull().default(0),
    ...auditColumns(),
  },
  (table) => [
    index('idx_sessions_user_time').on(table.userId, table.startedAt),
    index('idx_sessions_profile_status').on(table.profileId, table.status),
    check(
      'sessions_kind_check',
      sql`${table.kind} in ('lesson','review','conversation','assessment','micro','immersive')`,
    ),
    check(
      'sessions_status_check',
      sql`${table.status} in ('planned','in_progress','completed','abandoned')`,
    ),
    check('sessions_turns_check', sql`${table.turns} >= 0`),
    check('sessions_tokens_in_check', sql`${table.tokensIn} >= 0`),
    check('sessions_tokens_out_check', sql`${table.tokensOut} >= 0`),
    check('sessions_cost_check', sql`${table.costUsd} >= 0`),
  ],
).enableRLS();

export const sessionItems = pgTable(
  'session_items',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    block: text('block').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    rationaleCode: text('rationale_code').notNull(),
    rationaleJson: jsonb('rationale_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text('status').notNull().default('pending'),
    servedAt: timestamp('served_at', { withTimezone: true, mode: 'date' }),
    answeredAt: timestamp('answered_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('session_items_session_item_unique').on(table.sessionId, table.itemId),
    index('idx_session_items_session').on(table.sessionId, table.sortOrder),
    index('idx_session_items_item').on(table.itemId),
    check(
      'session_items_block_check',
      sql`${table.block} in ('review','input','production','assessment','immersive')`,
    ),
    check('session_items_status_check', sql`${table.status} in ('pending','answered','skipped')`),
  ],
).enableRLS();

export const sessionTurns = pgTable(
  'session_turns',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    audioRef: text('audio_ref'),
    transcriptMetaJson: jsonb('transcript_meta_json').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_turns_session').on(table.sessionId, table.createdAt),
    check('session_turns_role_check', sql`${table.role} in ('user','tutor','system')`),
    check('session_turns_content_check', sql`length(${table.content}) > 0`),
  ],
).enableRLS();

export const attempts = pgTable(
  'attempts',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    sessionItemId: text('session_item_id').references(() => sessionItems.id, {
      onDelete: 'set null',
    }),
    correct: boolean('correct').notNull(),
    score: real('score'),
    latencyMs: integer('latency_ms').notNull().default(0),
    hintUsed: boolean('hint_used').notNull().default(false),
    responseJson: jsonb('response_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_attempts_user_time').on(table.userId, table.createdAt),
    index('idx_attempts_item').on(table.itemId),
    index('idx_attempts_session').on(table.sessionId),
    check('attempts_score_check', sql`${table.score} is null or ${table.score} between 0 and 1`),
    check('attempts_latency_check', sql`${table.latencyMs} >= 0`),
  ],
).enableRLS();

export const errorEvents = pgTable(
  'error_events',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    source: text('source').notNull(),
    span: text('span').notNull(),
    errorType: text('error_type').notNull(),
    ruleId: text('rule_id'),
    severity: text('severity').notNull(),
    confidence: real('confidence').notNull(),
    shownToUser: boolean('shown_to_user').notNull().default(false),
    status: text('status').notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_errors_user_time').on(table.userId, table.createdAt),
    index('idx_errors_rule').on(table.userId, table.ruleId, table.createdAt),
    index('idx_errors_open')
      .on(table.userId, table.status)
      .where(sql`${table.status} = 'open'`),
    check(
      'error_events_source_check',
      sql`${table.source} in ('exercise','conversation','assessment','media','self_report')`,
    ),
    check('error_events_severity_check', sql`${table.severity} in ('low','medium','high')`),
    check('error_events_confidence_check', sql`${table.confidence} between 0 and 1`),
    check('error_events_status_check', sql`${table.status} in ('open','resolved','ignored')`),
  ],
).enableRLS();

export const userFeedback = pgTable(
  'user_feedback',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    kind: text('kind').notNull(),
    comment: text('comment'),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('idx_user_feedback_user_time').on(table.userId, table.createdAt),
    check(
      'user_feedback_target_type_check',
      sql`${table.targetType} in ('exercise','correction','session','media','app')`,
    ),
    check(
      'user_feedback_kind_check',
      sql`${table.kind} in ('helpful','not_helpful','wrong','too_easy','too_hard','report')`,
    ),
    check(
      'user_feedback_status_check',
      sql`${table.status} in ('open','reviewed','resolved')`,
    ),
  ],
).enableRLS();

export const savedPhrases = pgTable(
  'saved_phrases',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: 'cascade' }),
    targetLang: text('target_lang').notNull(),
    text: text('text').notNull(),
    normalizedText: text('normalized_text').notNull(),
    source: text('source').notNull(),
    sourceRef: text('source_ref'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    unique('saved_phrases_profile_normalized_unique').on(table.profileId, table.normalizedText),
    index('idx_saved_phrases_profile')
      .on(table.profileId, table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    check(
      'saved_phrases_source_check',
      sql`${table.source} in ('exercise','conversation','media','manual')`,
    ),
  ],
).enableRLS();

export const srsCards = pgTable(
  'srs_cards',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: 'cascade' }),
    cardType: text('card_type').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    fsrsJson: jsonb('fsrs_json').$type<Record<string, unknown>>().notNull(),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }).notNull(),
    state: text('state').notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    suspended: boolean('suspended').notNull().default(false),
    leech: boolean('leech').notNull().default(false),
    lastReviewAt: timestamp('last_review_at', { withTimezone: true, mode: 'date' }),
    ...auditColumns(),
  },
  (table) => [
    unique('srs_cards_source_unique').on(
      table.userId,
      table.sourceType,
      table.sourceId,
      table.cardType,
    ),
    index('idx_srs_due')
      .on(table.userId, table.dueAt)
      .where(sql`${table.deletedAt} is null and ${table.suspended} = false`),
    index('idx_srs_source').on(table.userId, table.sourceType, table.sourceId),
    check('srs_cards_card_type_check', sql`${table.cardType} in ('recognition','production')`),
    check(
      'srs_cards_source_type_check',
      sql`${table.sourceType} in ('item','saved_phrase','media_phrase')`,
    ),
    check('srs_cards_state_check', sql`${table.state} in ('new','learning','review','relearning')`),
    check('srs_cards_stability_check', sql`${table.stability} >= 0`),
    check('srs_cards_difficulty_check', sql`${table.difficulty} >= 0`),
    check('srs_cards_reps_check', sql`${table.reps} >= 0`),
    check('srs_cards_lapses_check', sql`${table.lapses} >= 0`),
  ],
).enableRLS();

export const srsReviews = pgTable(
  'srs_reviews',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => srsCards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }).notNull(),
    elapsedDays: real('elapsed_days').notNull().default(0),
    scheduledDays: real('scheduled_days').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('idx_srs_reviews_card').on(table.cardId, table.reviewedAt),
    check('srs_reviews_rating_check', sql`${table.rating} between 1 and 4`),
    check('srs_reviews_elapsed_check', sql`${table.elapsedDays} >= 0`),
    check('srs_reviews_scheduled_check', sql`${table.scheduledDays} >= 0`),
    check('srs_reviews_duration_check', sql`${table.durationMs} >= 0`),
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

export const M3_TABLES = [
  'sessions',
  'session_items',
  'attempts',
  'error_events',
  'saved_phrases',
  'srs_cards',
  'srs_reviews',
] as const;

export type M3TableName = (typeof M3_TABLES)[number];

export const M4_TABLES = ['session_turns'] as const;

export type M4TableName = (typeof M4_TABLES)[number];
