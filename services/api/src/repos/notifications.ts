import type {
  NotificationStore,
  ScheduledNotificationInput,
  ScheduledNotificationRecord,
  SentNotificationRecord,
} from '@loqua/db-postgres';

export type {
  NotificationStore,
  ScheduledNotificationInput,
  ScheduledNotificationRecord,
  SentNotificationRecord,
} from '@loqua/db-postgres';

export class InMemoryNotificationStore implements NotificationStore {
  private readonly records = new Map<string, ScheduledNotificationRecord>();

  async listScheduledNotifications(
    userId: string,
    since: string,
  ): Promise<readonly ScheduledNotificationRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.userId === userId && record.fireAt >= since)
      .sort((left, right) => left.fireAt.localeCompare(right.fireAt));
  }

  async replaceScheduledNotifications(
    userId: string,
    notifications: readonly ScheduledNotificationInput[],
    now: Date,
  ): Promise<void> {
    const timestamp = now.toISOString();
    for (const [id, record] of this.records) {
      if (record.userId === userId && record.status === 'scheduled') {
        this.records.set(id, { ...record, status: 'cancelled', updatedAt: timestamp });
      }
    }
    for (const notification of notifications) {
      const existing = this.records.get(notification.id);
      this.records.set(notification.id, {
        id: notification.id,
        userId,
        kind: notification.kind,
        fireAt: notification.fireAt,
        payload: notification.payload,
        status: existing?.status === 'sent' ? 'sent' : 'scheduled',
        sentAt: existing?.status === 'sent' ? existing.sentAt : null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      });
    }
  }

  async listSentNotifications(
    userId: string,
    since: string,
  ): Promise<readonly SentNotificationRecord[]> {
    return [...this.records.values()]
      .flatMap((record) =>
        record.userId === userId &&
        record.status === 'sent' &&
        record.sentAt !== null &&
        record.sentAt >= since
          ? [{ kind: record.kind, sentAt: record.sentAt }]
          : [],
      )
      .sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  }

  async markNotificationSent(userId: string, kind: string, now: Date): Promise<boolean> {
    const pending = [...this.records.values()]
      .filter(
        (record) =>
          record.userId === userId && record.kind === kind && record.status === 'scheduled',
      )
      .sort((left, right) => left.fireAt.localeCompare(right.fireAt))[0];
    if (!pending) return false;
    const timestamp = now.toISOString();
    this.records.set(pending.id, {
      ...pending,
      status: 'sent',
      sentAt: timestamp,
      updatedAt: timestamp,
    });
    return true;
  }
}
