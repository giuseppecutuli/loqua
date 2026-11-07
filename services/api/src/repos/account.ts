import {
  revokeDevice,
  type ConsentRecord,
  type Device,
  type Feedback,
  type LearnerProfile,
  type SavedPhrase,
} from '@loqua/core';
import type {
  AccountSnapshot,
  AccountStore,
  DeleteRequest,
  SettingsUpdate,
} from '@loqua/db-postgres';

export type { AccountSnapshot, AccountStore, DeleteRequest, SettingsUpdate };

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
  private readonly phrases = new Map<string, SavedPhrase>();
  private readonly feedback = new Map<string, Feedback>();

  seed(userId: string, snapshot: AccountSnapshot): void {
    this.snapshots.set(userId, snapshot);
  }

  async getSnapshot(userId: string): Promise<AccountSnapshot> {
    const snapshot = this.snapshots.get(userId) ?? EMPTY_SNAPSHOT;
    return {
      ...snapshot,
      data: {
        ...snapshot.data,
        savedPhrases: [...this.phrases.values()].filter(
          (phrase) => phrase.userId === userId && phrase.deletedAt === null,
        ),
        userFeedback: [...this.feedback.values()].filter((entry) => entry.userId === userId),
      },
    };
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

  async upsertSettings(update: SettingsUpdate): Promise<void> {
    const snapshot = await this.getSnapshot(update.userId);
    const settings = snapshot.settings ?? {
      desiredRetention: 0.9,
      aiDailyBudgetUsd: 0.5,
      modelPrefs: {},
      notificationPrefs: {},
    };
    this.snapshots.set(update.userId, {
      ...snapshot,
      settings: { ...settings, notificationPrefs: update.notificationPrefs },
    });
  }

  async listSavedPhrases(userId: string, profileId: string): Promise<readonly SavedPhrase[]> {
    return [...this.phrases.values()]
      .filter(
        (phrase) =>
          phrase.userId === userId && phrase.profileId === profileId && phrase.deletedAt === null,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async upsertSavedPhrase(phrase: SavedPhrase): Promise<SavedPhrase> {
    const existing = [...this.phrases.values()].find(
      (entry) =>
        entry.profileId === phrase.profileId &&
        entry.normalizedText === phrase.normalizedText &&
        entry.deletedAt === null,
    );
    const saved = {
      ...phrase,
      id: existing?.id ?? phrase.id,
      createdAt: existing?.createdAt ?? phrase.createdAt,
    };
    this.phrases.set(saved.id, saved);
    return saved;
  }

  async deleteSavedPhrase(userId: string, phraseId: string, now: Date): Promise<boolean> {
    const phrase = this.phrases.get(phraseId);
    if (!phrase || phrase.userId !== userId || phrase.deletedAt !== null) return false;
    this.phrases.set(phraseId, { ...phrase, deletedAt: now.toISOString() });
    return true;
  }

  async listFeedback(userId: string, profileId: string): Promise<readonly Feedback[]> {
    return [...this.feedback.values()]
      .filter((entry) => entry.userId === userId && entry.profileId === profileId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async upsertFeedback(feedback: Feedback): Promise<void> {
    this.feedback.set(feedback.id, feedback);
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

  async isDeviceRevoked(userId: string, deviceId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(userId);
    if (!snapshot) return false;
    const device = snapshot.devices.find((entry) => entry.id === deviceId);
    return device ? device.revokedAt !== null : false;
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
