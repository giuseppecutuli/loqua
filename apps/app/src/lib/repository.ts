import {
  consentRecordSchema,
  learnerProfileSchema,
  registerDevice,
  type ConsentRecord,
  type Device,
  type DevicePlatform,
  type LearnerProfile,
} from '@loqua/core';

import { supabase } from './supabase';

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function iso(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function requiredIso(value: unknown): string {
  return iso(value) ?? new Date(0).toISOString();
}

function requiredClient() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

function profileFromRow(row: unknown, uiLocale: string): LearnerProfile | null {
  const value = record(row);
  const parsed = learnerProfileSchema.safeParse({
    id: value.id,
    userId: value.user_id,
    targetLang: value.target_lang,
    nativeLang: value.native_lang,
    uiLocale,
    explanationMode: value.explanation_mode,
    proficiencyFramework: value.proficiency_framework,
    proficiencyEstimate: value.proficiency_estimate,
    goal: value.goal,
    dailyMinutes: value.daily_minutes,
    streakMode: value.streak_mode,
    timezone: value.timezone,
    interests: value.interests_json,
    selfAssessment: value.self_assessment_json,
    onboardingCompleted: value.onboarding_completed,
    createdAt: requiredIso(value.created_at),
    updatedAt: requiredIso(value.updated_at),
    deletedAt: iso(value.deleted_at),
  });
  return parsed.success ? parsed.data : null;
}

function consentFromRow(row: unknown): ConsentRecord | null {
  const value = record(row);
  const parsed = consentRecordSchema.safeParse({
    id: value.id,
    userId: value.user_id,
    kind: value.kind,
    version: value.version,
    grantedAt: iso(value.granted_at),
    revokedAt: iso(value.revoked_at),
    createdAt: requiredIso(value.created_at),
  });
  return parsed.success ? parsed.data : null;
}

function profileRow(profile: LearnerProfile): Record<string, unknown> {
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
    interests_json: profile.interests,
    self_assessment_json: profile.selfAssessment,
    onboarding_completed: profile.onboardingCompleted,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    deleted_at: profile.deletedAt,
  };
}

function consentRow(consent: ConsentRecord): Record<string, unknown> {
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

function deviceRow(device: Device): Record<string, unknown> {
  return {
    id: device.id,
    user_id: device.userId,
    platform: device.platform,
    name: device.name,
    last_seen_at: device.lastSeenAt,
    revoked_at: device.revokedAt,
    created_at: device.createdAt,
    updated_at: device.updatedAt,
    deleted_at: null,
  };
}

export async function fetchProfile(userId: string): Promise<LearnerProfile | null> {
  const client = requiredClient();
  const user = await client.from('users').select('ui_locale').eq('id', userId).maybeSingle();
  if (user.error) throw new Error(user.error.message);
  const profile = await client
    .from('learner_profiles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (profile.error) throw new Error(profile.error.message);
  if (!profile.data) return null;
  const locale = record(user.data).ui_locale;
  return profileFromRow(profile.data, typeof locale === 'string' ? locale : 'it');
}

export async function fetchConsents(userId: string): Promise<readonly ConsentRecord[]> {
  const client = requiredClient();
  const result = await client
    .from('consents')
    .select('*')
    .eq('user_id', userId)
    .order('kind');
  if (result.error) throw new Error(result.error.message);
  if (!Array.isArray(result.data)) return [];
  return result.data.flatMap((entry) => {
    const consent = consentFromRow(entry);
    return consent ? [consent] : [];
  });
}

export async function upsertProfile(profile: LearnerProfile): Promise<void> {
  const client = requiredClient();
  const user = await client.from('users').upsert({
    id: profile.userId,
    ui_locale: profile.uiLocale,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    deleted_at: null,
  });
  if (user.error) throw new Error(user.error.message);

  const result = await client.from('learner_profiles').upsert(profileRow(profile));
  if (result.error) throw new Error(result.error.message);
}

export async function upsertConsent(consent: ConsentRecord): Promise<void> {
  const client = requiredClient();
  const result = await client.from('consents').upsert(consentRow(consent));
  if (result.error) throw new Error(result.error.message);
}

export interface EnsureDeviceInput {
  readonly userId: string;
  readonly deviceId: string;
  readonly platform: DevicePlatform;
  readonly name: string;
  readonly now: Date;
}

export async function ensureDevice(input: EnsureDeviceInput): Promise<Device> {
  const registration = registerDevice([], {
    id: input.deviceId,
    userId: input.userId,
    platform: input.platform,
    name: input.name,
    now: input.now,
  });
  if (!registration.ok) throw new Error(registration.error);
  const device = registration.value[0];
  if (!device) throw new Error('device_registration_failed');

  const client = requiredClient();
  const result = await client.from('devices').upsert(deviceRow(device));
  if (result.error) throw new Error(result.error.message);
  return device;
}


