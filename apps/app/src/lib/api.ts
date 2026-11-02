import {
  consentRecordSchema,
  deviceSchema,
  learnerProfileSchema,
  placementAnswerSchema,
  placementStartSchema,
  progressSummarySchema,
  type ConsentRecord,
  type Device,
  type DevicePlatform,
  type LearnerProfile,
  type PlacementAnswer,
  type PlacementStart,
  type ProgressSummary,
} from '@loqua/core';

import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!apiUrl || !supabase) return null;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders();
  if (!headers) throw new Error('unauthorized');
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`api_${response.status}`);
  return response;
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

export async function hasRemoteSession(): Promise<boolean> {
  return (await authHeaders()) !== null;
}

export async function fetchProfile(): Promise<LearnerProfile | null> {
  const response = await request('/v1/profile');
  const body: unknown = await response.json();
  const value = field(body, 'profile');
  if (value === null) return null;
  const parsed = learnerProfileSchema.safeParse(value);
  if (!parsed.success) throw new Error('invalid_profile');
  return parsed.data;
}

export async function saveProfile(profile: LearnerProfile): Promise<LearnerProfile> {
  const response = await request('/v1/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
  const body: unknown = await response.json();
  const parsed = learnerProfileSchema.safeParse(field(body, 'profile'));
  if (!parsed.success) throw new Error('invalid_profile');
  return parsed.data;
}

export async function fetchConsents(): Promise<readonly ConsentRecord[]> {
  const response = await request('/v1/consents');
  const body: unknown = await response.json();
  const value = field(body, 'consents');
  if (!Array.isArray(value)) throw new Error('invalid_consents');
  return value.flatMap((entry) => {
    const parsed = consentRecordSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function saveConsents(
  consents: readonly ConsentRecord[],
): Promise<readonly ConsentRecord[]> {
  const response = await request('/v1/consents', {
    method: 'PUT',
    body: JSON.stringify({ consents }),
  });
  const body: unknown = await response.json();
  const value = field(body, 'consents');
  if (!Array.isArray(value)) throw new Error('invalid_consents');
  return value.flatMap((entry) => {
    const parsed = consentRecordSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function fetchDevices(): Promise<readonly Device[]> {
  const response = await request('/v1/devices');
  const body: unknown = await response.json();
  const value = field(body, 'devices');
  if (!Array.isArray(value)) throw new Error('invalid_devices');
  return value.flatMap((entry) => {
    const parsed = deviceSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function registerDevice(input: {
  readonly id: string;
  readonly platform: DevicePlatform;
  readonly name: string;
}): Promise<Device> {
  const response = await request('/v1/devices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  const parsed = deviceSchema.safeParse(field(body, 'device'));
  if (!parsed.success) throw new Error('invalid_device');
  return parsed.data;
}

export async function revokeDevice(deviceId: string): Promise<boolean> {
  try {
    const response = await request(`/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchServerExport(): Promise<string | null> {
  try {
    const response = await request('/v1/account/export');
    return await response.text();
  } catch {
    return null;
  }
}

export async function requestServerDelete(): Promise<boolean> {
  try {
    const response = await request('/v1/account', { method: 'DELETE' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function startPlacement(): Promise<PlacementStart> {
  const response = await request('/v1/assessments/placement/start', { method: 'POST' });
  const parsed = placementStartSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function answerPlacement(
  assessmentId: string,
  itemId: string,
  optionId: string,
): Promise<PlacementAnswer> {
  const response = await request(`/v1/assessments/${encodeURIComponent(assessmentId)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ itemId, optionId }),
  });
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function submitWriting(assessmentId: string, text: string): Promise<PlacementAnswer> {
  const response = await request(`/v1/assessments/${encodeURIComponent(assessmentId)}/writing`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function skipWriting(assessmentId: string): Promise<PlacementAnswer> {
  const response = await request(
    `/v1/assessments/${encodeURIComponent(assessmentId)}/writing/skip`,
    { method: 'POST' },
  );
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function fetchProgress(): Promise<ProgressSummary> {
  const response = await request('/v1/progress');
  const body: unknown = await response.json();
  const parsed = progressSummarySchema.safeParse(field(body, 'progress'));
  if (!parsed.success) throw new Error('invalid_progress');
  return parsed.data;
}
