import type { ConsentRecord, Device, LearnerProfile } from '@loqua/core';

import { readJson, writeJson } from './local-db';
import { supabase } from './supabase';

export type PendingWriteKind = 'profile' | 'consent' | 'device';

export interface PendingWrite {
  readonly id: string;
  readonly kind: PendingWriteKind;
  readonly payload: unknown;
  readonly createdAt: string;
}

const PENDING_KEY = 'pending_writes';

export function getPendingWrites(): readonly PendingWrite[] {
  const value = readJson(PENDING_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(isPendingWrite);
}

function isPendingWrite(value: unknown): value is PendingWrite {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.kind === 'string';
}

export function pendingWritesCount(): number {
  return getPendingWrites().length;
}

function queueWrite(kind: PendingWriteKind, id: string, payload: unknown): void {
  const existing = getPendingWrites().filter((write) => write.id !== id);
  const next: PendingWrite[] = [
    ...existing,
    { id, kind, payload, createdAt: new Date().toISOString() },
  ];
  writeJson(PENDING_KEY, next);
}

export function clearPendingWrites(): void {
  writeJson(PENDING_KEY, []);
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

async function writeRow(
  kind: PendingWriteKind,
  id: string,
  table: string,
  row: Record<string, unknown>,
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from(table).upsert(row);
    if (error) {
      queueWrite(kind, id, row);
      return false;
    }
    return true;
  } catch {
    queueWrite(kind, id, row);
    return false;
  }
}

export async function pushProfile(profile: LearnerProfile): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('users').upsert({
      id: profile.userId,
      ui_locale: profile.uiLocale,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
      deleted_at: null,
    });
    if (error) {
      queueWrite('profile', profile.id, profileRow(profile));
      return false;
    }
  } catch {
    queueWrite('profile', profile.id, profileRow(profile));
    return false;
  }
  return writeRow('profile', profile.id, 'learner_profiles', profileRow(profile));
}

export function pushConsent(consent: ConsentRecord): Promise<boolean> {
  return writeRow('consent', consent.id, 'consents', consentRow(consent));
}

export function pushDevice(device: Device): Promise<boolean> {
  return writeRow('device', device.id, 'devices', deviceRow(device));
}
