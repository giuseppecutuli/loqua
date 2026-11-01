import {
  consentRecordSchema,
  deviceSchema,
  learnerProfileSchema,
  type ConsentRecord,
  type Device,
  type ExportSettings,
  type LearnerProfile,
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

export interface AccountStore {
  getSnapshot(userId: string): Promise<AccountSnapshot>;
  requestDelete(userId: string, now: Date): Promise<DeleteRequest>;
  listDevices(userId: string): Promise<readonly Device[]>;
  revokeDevice(userId: string, deviceId: string, now: Date): Promise<'revoked' | 'not_found'>;
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
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mapProfile(
  row: ProfileRow | undefined,
  uiLocale: string,
): LearnerProfile | null {
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

function mapSettings(row: SettingsRow | undefined): ExportSettings | null {
  if (!row) return null;
  return {
    desiredRetention: row.desired_retention,
    aiDailyBudgetUsd: row.ai_daily_budget_usd,
    modelPrefs: jsonRecord(row.model_prefs_json),
    notificationPrefs: jsonRecord(row.notification_json),
  };
}

export class PostgresAccountStore implements AccountStore {
  constructor(private readonly pool: Pool) {}

  private async withUser<T>(
    userId: string,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
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

  async requestDelete(userId: string, now: Date): Promise<DeleteRequest> {
    const timestamp = now.toISOString();
    const scheduled = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.withUser(userId, async (client) => {
      await client.query(
        'UPDATE public.users SET deleted_at = $1, updated_at = $1 WHERE id = $2',
        [timestamp, userId],
      );
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


