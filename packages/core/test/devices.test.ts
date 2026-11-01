import { describe, expect, it } from 'vitest';

import {
  activeDevices,
  isDeviceActive,
  registerDevice,
  revokeDevice,
  touchDevice,
  type Device,
} from '../src/devices.js';

const now = new Date('2026-11-01T10:00:00.000Z');

function register(devices: readonly Device[], id: string, platform: 'android' | 'web'): readonly Device[] {
  const result = registerDevice(devices, { id, userId: 'user-1', platform, now });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('devices', () => {
  it('registers and lists active devices', () => {
    let devices: readonly Device[] = [];
    devices = register(devices, 'device-1', 'android');
    devices = register(devices, 'device-2', 'web');
    expect(activeDevices(devices, 'user-1')).toHaveLength(2);
  });

  it('revokes a device idempotently', () => {
    const devices = register([], 'device-1', 'android');
    const revoked = revokeDevice(devices, 'device-1', now);
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(isDeviceActive(revoked.value[0]!)).toBe(false);
    const again = revokeDevice(revoked.value, 'device-1', now);
    expect(again.ok).toBe(true);
  });

  it('cannot touch a revoked device', () => {
    const devices = register([], 'device-1', 'android');
    const revoked = revokeDevice(devices, 'device-1', now);
    if (!revoked.ok) throw new Error(revoked.error);
    const touched = touchDevice(revoked.value, 'device-1', now);
    expect(touched).toEqual({ ok: false, error: 'device_revoked' });
  });

  it('rejects unknown platforms at runtime', () => {
    const result = registerDevice([], {
      id: 'device-1',
      userId: 'user-1',
      // @ts-expect-error runtime guard must reject unsupported platforms
      platform: 'toaster',
      now,
    });
    expect(result.ok).toBe(false);
  });
});
