import { isUtcIso, toUtcIso } from './dates.js';
import type { Result } from './result.js';

export const DEVICE_PLATFORMS = ['android', 'ios', 'web', 'desktop'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export interface Device {
  readonly id: string;
  readonly userId: string;
  readonly platform: DevicePlatform;
  readonly name: string | null;
  readonly lastSeenAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type DeviceErrorCode = 'platform_invalid' | 'device_not_found' | 'device_revoked';

export function isDevicePlatform(value: unknown): value is DevicePlatform {
  return typeof value === 'string' && (DEVICE_PLATFORMS as readonly string[]).includes(value);
}

export function isDeviceActive(device: Device): boolean {
  return device.revokedAt === null;
}

export function activeDevices(devices: readonly Device[], userId: string): readonly Device[] {
  return devices.filter((device) => device.userId === userId && isDeviceActive(device));
}

export interface RegisterDeviceInput {
  readonly id: string;
  readonly userId: string;
  readonly platform: DevicePlatform;
  readonly name?: string | null;
  readonly now: Date;
}

export function registerDevice(
  devices: readonly Device[],
  input: RegisterDeviceInput,
): Result<readonly Device[], DeviceErrorCode> {
  if (!isDevicePlatform(input.platform)) return { ok: false, error: 'platform_invalid' };

  const timestamp = toUtcIso(input.now);
  const existing = devices.find((device) => device.id === input.id);
  if (existing) {
    return {
      ok: true,
      value: devices.map((device) =>
        device.id === input.id
          ? {
              ...device,
              platform: input.platform,
              name: input.name ?? device.name,
              lastSeenAt: timestamp,
              revokedAt: null,
              updatedAt: timestamp,
            }
          : device,
      ),
    };
  }

  return {
    ok: true,
    value: [
      ...devices,
      {
        id: input.id,
        userId: input.userId,
        platform: input.platform,
        name: input.name ?? null,
        lastSeenAt: timestamp,
        revokedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}

export function revokeDevice(
  devices: readonly Device[],
  deviceId: string,
  now: Date,
): Result<readonly Device[], DeviceErrorCode> {
  const device = devices.find((candidate) => candidate.id === deviceId);
  if (!device) return { ok: false, error: 'device_not_found' };
  if (device.revokedAt !== null) return { ok: true, value: devices };

  const timestamp = toUtcIso(now);
  return {
    ok: true,
    value: devices.map((candidate) =>
      candidate.id === deviceId
        ? { ...candidate, revokedAt: timestamp, updatedAt: timestamp }
        : candidate,
    ),
  };
}

export function touchDevice(
  devices: readonly Device[],
  deviceId: string,
  now: Date,
): Result<readonly Device[], DeviceErrorCode> {
  const device = devices.find((candidate) => candidate.id === deviceId);
  if (!device) return { ok: false, error: 'device_not_found' };
  if (device.revokedAt !== null) return { ok: false, error: 'device_revoked' };

  const timestamp = toUtcIso(now);
  return {
    ok: true,
    value: devices.map((candidate) =>
      candidate.id === deviceId
        ? { ...candidate, lastSeenAt: timestamp, updatedAt: timestamp }
        : candidate,
    ),
  };
}

export function validateDevice(device: Device): readonly string[] {
  const errors: string[] = [];
  if (!isDevicePlatform(device.platform)) errors.push('platform_invalid');
  if (!isUtcIso(device.createdAt)) errors.push('created_at_invalid');
  if (!isUtcIso(device.updatedAt)) errors.push('updated_at_invalid');
  if (device.lastSeenAt !== null && !isUtcIso(device.lastSeenAt)) errors.push('last_seen_at_invalid');
  if (device.revokedAt !== null && !isUtcIso(device.revokedAt)) errors.push('revoked_at_invalid');
  return errors;
}
