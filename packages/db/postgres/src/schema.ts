import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
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

export const M1_TABLES = [
  'users',
  'devices',
  'learner_profiles',
  'consents',
  'settings',
  'backup_meta',
] as const;

export type M1TableName = (typeof M1_TABLES)[number];
