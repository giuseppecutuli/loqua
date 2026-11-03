import {
  consentRecordSchema,
  deviceSchema,
  learnerProfileSchema,
  type ConsentRecord,
  feedbackSchema,
  savedPhraseSchema,
  type Device,
  type ExportSettings,
  type LearnerProfile,
  type Feedback,
  type SavedPhrase,
} from '@loqua/core';
import type { Pool, PoolClient, QueryResultRow } from 'pg';

export interface AccountSnapshot {
  readonly profile: LearnerProfile | null;
  readonly consents: readonly ConsentRecord[];
  readonly devices: readonly Device[];
  readonly settings: ExportSettings | null;
  readonly data: Record<string, unknown>;
}

export interface DeleteRequest {
  readonly scheduledHardDeleteAt: string;
}

export interface SettingsUpdate {
  readonly userId: string;
  readonly notificationPrefs: Record<string, unknown>;
  readonly now: Date;
}

export interface AccountStore {
  getSnapshot(userId: string): Promise<AccountSnapshot>;
  upsertProfile(profile: LearnerProfile): Promise<void>;
  upsertConsents(consents: readonly ConsentRecord[]): Promise<void>;
  upsertDevice(device: Device): Promise<void>;
  upsertSettings(update: SettingsUpdate): Promise<void>;
  requestDelete(userId: string, now: Date): Promise<DeleteRequest>;
  listDevices(userId: string): Promise<readonly Device[]>;
  revokeDevice(userId: string, deviceId: string, now: Date): Promise<'revoked' | 'not_found'>;
  listSavedPhrases(userId: string, profileId: string): Promise<readonly SavedPhrase[]>;
  upsertSavedPhrase(phrase: SavedPhrase): Promise<SavedPhrase>;
  deleteSavedPhrase(userId: string, phraseId: string, now: Date): Promise<boolean>;
  listFeedback(userId: string, profileId: string): Promise<readonly Feedback[]>;
  upsertFeedback(feedback: Feedback): Promise<void>;
}

interface UserRow extends QueryResultRow {
  id: string;
  email: string | null;
  ui_locale: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface ProfileRow extends QueryResultRow {
  id: string;
  user_id: string;
  target_lang: string;
  native_lang: string;
  explanation_mode: string;
  proficiency_framework: string;
  proficiency_estimate: string | null;
  goal: string | null;
  daily_minutes: number;
  streak_mode: string;
  timezone: string;
  interests_json: unknown;
  self_assessment_json: unknown;
  onboarding_completed: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface ConsentRow extends QueryResultRow {
  id: string;
  user_id: string;
  kind: string;
  version: string;
  granted_at: Date | string | null;
  revoked_at: Date | string | null;
  created_at: Date | string;
}

interface DeviceRow extends QueryResultRow {
  id: string;
  user_id: string;
  platform: string;
  name: string | null;
  last_seen_at: Date | string | null;
  revoked_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface FeedbackRow extends QueryResultRow {
  id: string;
  user_id: string;
  profile_id: string;
  target_type: string;
  target_id: string | null;
  kind: string;
  comment: string | null;
  status: string;
  created_at: Date | string;
  resolved_at: Date | string | null;
}

interface SavedPhraseRow extends QueryResultRow {
  id: string;
  user_id: string;
  profile_id: string;
  target_lang: string;
  text: string;
  normalized_text: string;
  source: string;
  source_ref: string | null;
  note: string | null;
  created_at: Date | string;
  deleted_at: Date | string | null;
}

interface SettingsRow extends QueryResultRow {
  desired_retention: number;
  ai_daily_budget_usd: number;
  model_prefs_json: unknown;
  notification_json: unknown;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function jsonStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function mapProfile(row: ProfileRow | undefined, uiLocale: string): LearnerProfile | null {
  if (!row) return null;
  const parsed = learnerProfileSchema.safeParse({
    id: row.id,
    userId: row.user_id,
    targetLang: row.target_lang,
    nativeLang: row.native_lang,
    uiLocale,
    explanationMode: row.explanation_mode,
    proficiencyFramework: row.proficiency_framework,
    proficiencyEstimate: row.proficiency_estimate,
    goal: row.goal,
    dailyMinutes: row.daily_minutes,
    streakMode: row.streak_mode,
    timezone: row.timezone,
    interests: jsonStrings(row.interests_json),
    selfAssessment: jsonRecord(row.self_assessment_json),
    onboardingCompleted: row.onboarding_completed,
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
    deletedAt: iso(row.deleted_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapConsent(row: ConsentRow): ConsentRecord | null {
  const parsed = consentRecordSchema.safeParse({
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    version: row.version,
    grantedAt: iso(row.granted_at),
    revokedAt: iso(row.revoked_at),
    createdAt: requiredIso(row.created_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapDevice(row: DeviceRow): Device | null {
  const parsed = deviceSchema.safeParse({
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    name: row.name,
    lastSeenAt: iso(row.last_seen_at),
    revokedAt: iso(row.revoked_at),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapFeedback(row: FeedbackRow): Feedback | null {
  const parsed = feedbackSchema.safeParse({
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    targetType: row.target_type,
    targetId: row.target_id,
    kind: row.kind,
    comment: row.comment,
    status: row.status,
    createdAt: requiredIso(row.created_at),
    resolvedAt: iso(row.resolved_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapSavedPhrase(row: SavedPhraseRow): SavedPhrase | null {
  const parsed = savedPhraseSchema.safeParse({
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    targetLang: row.target_lang,
    text: row.text,
    normalizedText: row.normalized_text,
    source: row.source,
    sourceRef: row.source_ref,
    note: row.note,
    createdAt: requiredIso(row.created_at),
    deletedAt: iso(row.deleted_at),
  });
  return parsed.success ? parsed.data : null;
}

function mapSettings(row: SettingsRow | undefined): ExportSettings | null {
  if (!row) return null;
  return {
    desiredRetention: row.desired_retention,
    aiDailyBudgetUsd: row.ai_daily_budget_usd,
    modelPrefs: jsonRecord(row.model_prefs_json),
    notificationPrefs: jsonRecord(row.notification_json),
  };
}

function profileToRow(profile: LearnerProfile): Record<string, unknown> {
  return {
    id: profile.id,
    user_id: profile.userId,
    target_lang: profile.targetLang,
    native_lang: profile.nativeLang,
    explanation_mode: profile.explanationMode,
    proficiency_framework: profile.proficiencyFramework,
    proficiency_estimate: profile.proficiencyEstimate,
    goal: profile.goal,
    daily_minutes: profile.dailyMinutes,
    streak_mode: profile.streakMode,
    timezone: profile.timezone,
    interests_json: JSON.stringify(profile.interests),
    self_assessment_json: JSON.stringify(profile.selfAssessment),
    onboarding_completed: profile.onboardingCompleted,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    deleted_at: profile.deletedAt,
  };
}

function consentToRow(consent: ConsentRecord): Record<string, unknown> {
  return {
    id: consent.id,
    user_id: consent.userId,
    kind: consent.kind,
    version: consent.version,
    granted_at: consent.grantedAt,
    revoked_at: consent.revokedAt,
    created_at: consent.createdAt,
  };
}

function deviceToRow(device: Device): Record<string, unknown> {
  return {
    id: device.id,
    user_id: device.userId,
    platform: device.platform,
    name: device.name,
    last_seen_at: device.lastSeenAt,
    revoked_at: device.revokedAt,
    created_at: device.createdAt,
    updated_at: device.updatedAt,
  };
}
export class PostgresAccountStore implements AccountStore {
  constructor(private readonly pool: Pool) {}

  private async withUser<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSnapshot(userId: string): Promise<AccountSnapshot> {
    return this.withUser(userId, async (client) => {
      const users = await client.query<UserRow>('SELECT * FROM public.users WHERE id = $1', [
        userId,
      ]);
      const profiles = await client.query<ProfileRow>(
        'SELECT * FROM public.learner_profiles WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1',
        [userId],
      );
      const consents = await client.query<ConsentRow>(
        'SELECT * FROM public.consents WHERE user_id = $1 ORDER BY kind',
        [userId],
      );
      const devices = await client.query<DeviceRow>(
        'SELECT * FROM public.devices WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const settings = await client.query<SettingsRow>(
        'SELECT * FROM public.settings WHERE user_id = $1 AND deleted_at IS NULL',
        [userId],
      );
      const assessments = await client.query(
        `SELECT id, kind, target_lang, overall_level, confidence, status, raw_json,
                created_at, completed_at
         FROM public.assessments WHERE user_id = $1 ORDER BY created_at`,
        [userId],
      );
      const assessmentScores = await client.query(
        `SELECT s.id, s.assessment_id, s.dimension, s.score, s.confidence, s.notes, s.created_at
         FROM public.assessment_scores s
         JOIN public.assessments a ON a.id = s.assessment_id
         WHERE a.user_id = $1 ORDER BY s.created_at`,
        [userId],
      );
      const levelEvents = await client.query(
        `SELECT id, profile_id, skill_id, from_level, to_level, reason, detail_json, created_at
         FROM public.level_events WHERE user_id = $1 ORDER BY created_at`,
        [userId],
      );
      const userSkillState = await client.query(
        'SELECT * FROM public.user_skill_state WHERE user_id = $1 ORDER BY skill_id',
        [userId],
      );
      const userConceptState = await client.query(
        'SELECT * FROM public.user_concept_state WHERE user_id = $1 ORDER BY concept_id',
        [userId],
      );
      const savedPhrases = await client.query<SavedPhraseRow>(
        'SELECT * FROM public.saved_phrases WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at',
        [userId],
      );
      const userFeedback = await client.query<FeedbackRow>(
        'SELECT * FROM public.user_feedback WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const sessions = await client.query(
        'SELECT * FROM public.sessions WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const sessionItems = await client.query(
        `SELECT si.* FROM public.session_items si
         JOIN public.sessions s ON s.id = si.session_id
         WHERE s.user_id = $1 ORDER BY si.created_at`,
        [userId],
      );
      const sessionTurns = await client.query(
        `SELECT t.* FROM public.session_turns t
         JOIN public.sessions s ON s.id = t.session_id
         WHERE s.user_id = $1 ORDER BY t.created_at`,
        [userId],
      );
      const attempts = await client.query(
        'SELECT * FROM public.attempts WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const errorEvents = await client.query(
        'SELECT * FROM public.error_events WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const srsCards = await client.query(
        'SELECT * FROM public.srs_cards WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const srsReviews = await client.query(
        'SELECT * FROM public.srs_reviews WHERE user_id = $1 ORDER BY reviewed_at',
        [userId],
      );
      const xpEvents = await client.query(
        'SELECT * FROM public.xp_events WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const generatedItems = await client.query(
        'SELECT * FROM public.items WHERE owner_user_id = $1 ORDER BY created_at',
        [userId],
      );
      const tasteProfiles = await client.query(
        `SELECT * FROM public.user_taste_profile
         WHERE profile_id IN (
           SELECT id FROM public.learner_profiles WHERE user_id = $1
         )
         ORDER BY created_at`,
        [userId],
      );
      const recommendations = await client.query(
        'SELECT * FROM public.recommendations WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const recommendationFeedback = await client.query(
        'SELECT * FROM public.recommendation_feedback WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const mediaProgress = await client.query(
        'SELECT * FROM public.media_progress WHERE user_id = $1 ORDER BY created_at',
        [userId],
      );
      const mediaGuides = await client.query(
        `SELECT g.* FROM public.media_guides g
         JOIN public.learner_profiles p ON p.id = g.profile_id
         WHERE p.user_id = $1
         ORDER BY g.created_at`,
        [userId],
      );

      const user = users.rows[0];

      return {
        profile: mapProfile(profiles.rows[0], user?.ui_locale ?? 'it'),
        consents: consents.rows.flatMap((row) => {
          const consent = mapConsent(row);
          return consent ? [consent] : [];
        }),
        devices: devices.rows.flatMap((row) => {
          const device = mapDevice(row);
          return device ? [device] : [];
        }),
        settings: mapSettings(settings.rows[0]),
        data: {
          assessments: assessments.rows,
          assessmentScores: assessmentScores.rows,
          levelEvents: levelEvents.rows,
          userSkillState: userSkillState.rows,
          userConceptState: userConceptState.rows,
          savedPhrases: savedPhrases.rows,
          userFeedback: userFeedback.rows,
          sessions: sessions.rows,
          sessionItems: sessionItems.rows,
          sessionTurns: sessionTurns.rows,
          attempts: attempts.rows,
          errorEvents: errorEvents.rows,
          srsCards: srsCards.rows,
          srsReviews: srsReviews.rows,
          xpEvents: xpEvents.rows,
          generatedItems: generatedItems.rows,
          tasteProfiles: tasteProfiles.rows,
          recommendations: recommendations.rows,
          recommendationFeedback: recommendationFeedback.rows,
          mediaProgress: mediaProgress.rows,
          mediaGuides: mediaGuides.rows,
          user: user
            ? {
                id: user.id,
                email: user.email,
                uiLocale: user.ui_locale,
                createdAt: requiredIso(user.created_at),
                updatedAt: requiredIso(user.updated_at),
                deletedAt: iso(user.deleted_at),
              }
            : null,
        },
      };
    });
  }

  async listSavedPhrases(userId: string, profileId: string): Promise<readonly SavedPhrase[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<SavedPhraseRow>(
        `SELECT * FROM public.saved_phrases
         WHERE user_id = $1 AND profile_id = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [userId, profileId],
      );
      return result.rows.flatMap((row) => {
        const phrase = mapSavedPhrase(row);
        return phrase ? [phrase] : [];
      });
    });
  }

  async upsertSavedPhrase(phrase: SavedPhrase): Promise<SavedPhrase> {
    return this.withUser(phrase.userId, async (client) => {
      const result = await client.query<SavedPhraseRow>(
        `INSERT INTO public.saved_phrases
           (id, user_id, profile_id, target_lang, text, normalized_text, source, source_ref, note,
            created_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (profile_id, normalized_text) DO UPDATE
         SET text = EXCLUDED.text,
             source = EXCLUDED.source,
             source_ref = EXCLUDED.source_ref,
             note = EXCLUDED.note,
             deleted_at = NULL
         RETURNING *`,
        [
          phrase.id,
          phrase.userId,
          phrase.profileId,
          phrase.targetLang,
          phrase.text,
          phrase.normalizedText,
          phrase.source,
          phrase.sourceRef,
          phrase.note,
          phrase.createdAt,
          phrase.deletedAt,
        ],
      );
      const saved = result.rows[0] ? mapSavedPhrase(result.rows[0]) : null;
      return saved ?? phrase;
    });
  }

  async deleteSavedPhrase(userId: string, phraseId: string, now: Date): Promise<boolean> {
    return this.withUser(userId, async (client) => {
      const result = await client.query(
        `UPDATE public.saved_phrases SET deleted_at = $1
         WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
        [now.toISOString(), phraseId, userId],
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async listFeedback(userId: string, profileId: string): Promise<readonly Feedback[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<FeedbackRow>(
        `SELECT * FROM public.user_feedback
         WHERE user_id = $1 AND profile_id = $2
         ORDER BY created_at DESC`,
        [userId, profileId],
      );
      return result.rows.flatMap((row) => {
        const feedback = mapFeedback(row);
        return feedback ? [feedback] : [];
      });
    });
  }

  async upsertFeedback(feedback: Feedback): Promise<void> {
    await this.withUser(feedback.userId, async (client) => {
      await client.query(
        `INSERT INTO public.user_feedback
           (id, user_id, profile_id, target_type, target_id, kind, comment, status, created_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          feedback.id,
          feedback.userId,
          feedback.profileId,
          feedback.targetType,
          feedback.targetId,
          feedback.kind,
          feedback.comment,
          feedback.status,
          feedback.createdAt,
          feedback.resolvedAt,
        ],
      );
    });
  }

  async upsertProfile(profile: LearnerProfile): Promise<void> {
    await this.withUser(profile.userId, async (client) => {
      await client.query(
        `INSERT INTO public.users (id, ui_locale, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
         SET ui_locale = EXCLUDED.ui_locale,
             updated_at = EXCLUDED.updated_at,
             deleted_at = EXCLUDED.deleted_at`,
        [profile.userId, profile.uiLocale, profile.createdAt, profile.updatedAt, profile.deletedAt],
      );

      const row = profileToRow(profile);
      await client.query(
        `INSERT INTO public.learner_profiles
           (id, user_id, target_lang, native_lang, explanation_mode, proficiency_framework,
            proficiency_estimate, goal, daily_minutes, streak_mode, timezone, interests_json,
            self_assessment_json, onboarding_completed, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE
         SET target_lang = EXCLUDED.target_lang,
             native_lang = EXCLUDED.native_lang,
             explanation_mode = EXCLUDED.explanation_mode,
             proficiency_framework = EXCLUDED.proficiency_framework,
             proficiency_estimate = EXCLUDED.proficiency_estimate,
             goal = EXCLUDED.goal,
             daily_minutes = EXCLUDED.daily_minutes,
             streak_mode = EXCLUDED.streak_mode,
             timezone = EXCLUDED.timezone,
             interests_json = EXCLUDED.interests_json,
             self_assessment_json = EXCLUDED.self_assessment_json,
             onboarding_completed = EXCLUDED.onboarding_completed,
             updated_at = EXCLUDED.updated_at,
             deleted_at = EXCLUDED.deleted_at`,
        [
          row.id,
          row.user_id,
          row.target_lang,
          row.native_lang,
          row.explanation_mode,
          row.proficiency_framework,
          row.proficiency_estimate,
          row.goal,
          row.daily_minutes,
          row.streak_mode,
          row.timezone,
          row.interests_json,
          row.self_assessment_json,
          row.onboarding_completed,
          row.created_at,
          row.updated_at,
          row.deleted_at,
        ],
      );
    });
  }

  async upsertConsents(consents: readonly ConsentRecord[]): Promise<void> {
    if (consents.length === 0) return;
    const userId = consents[0]?.userId;
    if (!userId) return;

    await this.withUser(userId, async (client) => {
      for (const consent of consents) {
        const row = consentToRow(consent);
        await client.query(
          `INSERT INTO public.consents
             (id, user_id, kind, version, granted_at, revoked_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE
           SET granted_at = EXCLUDED.granted_at,
               revoked_at = EXCLUDED.revoked_at`,
          [
            row.id,
            row.user_id,
            row.kind,
            row.version,
            row.granted_at,
            row.revoked_at,
            row.created_at,
          ],
        );
      }
    });
  }

  async upsertDevice(device: Device): Promise<void> {
    const row = deviceToRow(device);
    await this.withUser(device.userId, async (client) => {
      await client.query(
        `INSERT INTO public.devices
           (id, user_id, platform, name, last_seen_at, revoked_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE
         SET platform = EXCLUDED.platform,
             name = EXCLUDED.name,
             last_seen_at = EXCLUDED.last_seen_at,
             revoked_at = EXCLUDED.revoked_at,
             updated_at = EXCLUDED.updated_at`,
        [
          row.id,
          row.user_id,
          row.platform,
          row.name,
          row.last_seen_at,
          row.revoked_at,
          row.created_at,
          row.updated_at,
        ],
      );
    });
  }

  async upsertSettings(update: SettingsUpdate): Promise<void> {
    const timestamp = update.now.toISOString();
    await this.withUser(update.userId, async (client) => {
      await client.query(
        `INSERT INTO public.settings
           (user_id, desired_retention, ai_daily_budget_usd, model_prefs_json, notification_json,
            created_at, updated_at)
         VALUES ($1, 0.90, 0.50, '{}'::jsonb, $2::jsonb, $3, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET notification_json = EXCLUDED.notification_json,
             updated_at = EXCLUDED.updated_at`,
        [update.userId, JSON.stringify(update.notificationPrefs), timestamp],
      );
    });
  }

  async requestDelete(userId: string, now: Date): Promise<DeleteRequest> {
    const timestamp = now.toISOString();
    const scheduled = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.withUser(userId, async (client) => {
      await client.query('UPDATE public.users SET deleted_at = $1, updated_at = $1 WHERE id = $2', [
        timestamp,
        userId,
      ]);
      await client.query(
        'UPDATE public.learner_profiles SET deleted_at = $1, updated_at = $1 WHERE user_id = $2 AND deleted_at IS NULL',
        [timestamp, userId],
      );
      await client.query(
        'UPDATE public.devices SET revoked_at = COALESCE(revoked_at, $1), updated_at = $1 WHERE user_id = $2',
        [timestamp, userId],
      );
    });
    return { scheduledHardDeleteAt: scheduled };
  }

  async listDevices(userId: string): Promise<readonly Device[]> {
    return this.withUser(userId, async (client) => {
      const devices = await client.query<DeviceRow>(
        'SELECT * FROM public.devices WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at',
        [userId],
      );
      return devices.rows.flatMap((row) => {
        const device = mapDevice(row);
        return device ? [device] : [];
      });
    });
  }

  async revokeDevice(
    userId: string,
    deviceId: string,
    now: Date,
  ): Promise<'revoked' | 'not_found'> {
    return this.withUser(userId, async (client) => {
      const timestamp = now.toISOString();
      const result = await client.query(
        'UPDATE public.devices SET revoked_at = $1, updated_at = $1 WHERE id = $2 AND user_id = $3',
        [timestamp, deviceId, userId],
      );
      return (result.rowCount ?? 0) === 0 ? 'not_found' : 'revoked';
    });
  }
}
