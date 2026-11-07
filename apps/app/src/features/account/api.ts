import {
  consentRecordSchema,
  deviceSchema,
  learnerProfileSchema,
  type ConsentRecord,
  type Device,
  type DevicePlatform,
  type LearnerProfile,
} from '@loqua/core';

import {
  hasAuthSession,
  parseCollection,
  parseEnvelope,
  parseNullableEnvelope,
  request,
  requestText,
} from '../../lib/http';

export async function hasRemoteSession(): Promise<boolean> {
  return hasAuthSession();
}

export async function fetchProfile(): Promise<LearnerProfile | null> {
  const body: unknown = await (await request('/v1/profile')).json();
  return parseNullableEnvelope(body, 'profile', learnerProfileSchema, 'invalid_profile');
}

export async function saveProfile(profile: LearnerProfile): Promise<LearnerProfile> {
  const body: unknown = await (
    await request('/v1/profile', { method: 'PUT', body: JSON.stringify(profile) })
  ).json();
  return parseEnvelope(body, 'profile', learnerProfileSchema, 'invalid_profile');
}

export async function fetchConsents(): Promise<readonly ConsentRecord[]> {
  const body: unknown = await (await request('/v1/consents')).json();
  return parseCollection(body, 'consents', consentRecordSchema, 'invalid_consents');
}

export async function saveConsents(
  consents: readonly ConsentRecord[],
): Promise<readonly ConsentRecord[]> {
  const body: unknown = await (
    await request('/v1/consents', { method: 'PUT', body: JSON.stringify({ consents }) })
  ).json();
  return parseCollection(body, 'consents', consentRecordSchema, 'invalid_consents');
}

export async function fetchDevices(): Promise<readonly Device[]> {
  const body: unknown = await (await request('/v1/devices')).json();
  return parseCollection(body, 'devices', deviceSchema, 'invalid_devices');
}

export async function registerDevice(input: {
  readonly id: string;
  readonly platform: DevicePlatform;
  readonly name: string;
}): Promise<Device> {
  const body: unknown = await (
    await request('/v1/devices', { method: 'POST', body: JSON.stringify(input) })
  ).json();
  return parseEnvelope(body, 'device', deviceSchema, 'invalid_device');
}

export async function revokeDevice(deviceId: string): Promise<boolean> {
  try {
    await request(`/v1/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

export async function fetchServerExport(): Promise<string | null> {
  try {
    return await requestText('/v1/account/export');
  } catch {
    return null;
  }
}

export async function requestServerDelete(): Promise<boolean> {
  try {
    await request('/v1/account', { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}
