import {
  revokeDevice,
  type ConsentRecord,
  type Device,
  type ExportSettings,
  type LearnerProfile,
} from '@loqua/core';

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

export interface AccountRepository {
  getSnapshot(userId: string): Promise<AccountSnapshot>;
  requestDelete(userId: string, now: Date): Promise<DeleteRequest>;
  listDevices(userId: string): Promise<readonly Device[]>;
  revokeDevice(userId: string, deviceId: string, now: Date): Promise<'revoked' | 'not_found'>;
}

const EMPTY_SNAPSHOT: AccountSnapshot = {
  profile: null,
  consents: [],
  devices: [],
  settings: null,
  data: {},
};

export class InMemoryAccountRepository implements AccountRepository {
  private readonly snapshots = new Map<string, AccountSnapshot>();
  private readonly deleteRequests = new Map<string, string>();

  seed(userId: string, snapshot: AccountSnapshot): void {
    this.snapshots.set(userId, snapshot);
  }

  async getSnapshot(userId: string): Promise<AccountSnapshot> {
    return this.snapshots.get(userId) ?? EMPTY_SNAPSHOT;
  }

  async requestDelete(userId: string, now: Date): Promise<DeleteRequest> {
    const scheduled = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const scheduledHardDeleteAt = scheduled.toISOString();
    this.deleteRequests.set(userId, scheduledHardDeleteAt);
    return { scheduledHardDeleteAt };
  }

  async listDevices(userId: string): Promise<readonly Device[]> {
    return (await this.getSnapshot(userId)).devices;
  }

  async revokeDevice(
    userId: string,
    deviceId: string,
    now: Date,
  ): Promise<'revoked' | 'not_found'> {
    const snapshot = this.snapshots.get(userId);
    if (!snapshot) return 'not_found';
    const result = revokeDevice(snapshot.devices, deviceId, now);
    if (!result.ok) return 'not_found';
    this.snapshots.set(userId, { ...snapshot, devices: result.value });
    return 'revoked';
  }
}
