import { revokeDevice, type ConsentRecord, type Device, type LearnerProfile } from '@loqua/core';
import type { AccountSnapshot, AccountStore, DeleteRequest } from '@loqua/db-postgres';

export type { AccountSnapshot, AccountStore, DeleteRequest };

export type AccountRepository = AccountStore;

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

  async upsertProfile(profile: LearnerProfile): Promise<void> {
    const snapshot = await this.getSnapshot(profile.userId);
    this.snapshots.set(profile.userId, { ...snapshot, profile });
  }

  async upsertConsents(consents: readonly ConsentRecord[]): Promise<void> {
    if (consents.length === 0) return;
    const userId = consents[0]?.userId;
    if (!userId) return;
    const snapshot = await this.getSnapshot(userId);
    const merged = new Map(
      snapshot.consents.map((consent) => [`${consent.kind}@${consent.version}`, consent]),
    );
    for (const consent of consents) {
      merged.set(`${consent.kind}@${consent.version}`, consent);
    }
    this.snapshots.set(userId, { ...snapshot, consents: [...merged.values()] });
  }

  async upsertDevice(device: Device): Promise<void> {
    const snapshot = await this.getSnapshot(device.userId);
    const devices = snapshot.devices.filter((entry) => entry.id !== device.id);
    this.snapshots.set(device.userId, { ...snapshot, devices: [...devices, device] });
  }

  async requestDelete(userId: string, now: Date): Promise<DeleteRequest> {
    const scheduled = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const scheduledHardDeleteAt = scheduled.toISOString();
    this.deleteRequests.set(userId, scheduledHardDeleteAt);
    return { scheduledHardDeleteAt };
  }

  async listDevices(userId: string): Promise<readonly Device[]> {
    return (await this.getSnapshot(userId)).devices.filter((device) => device.revokedAt === null);
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
