import type { Pool, PoolClient, QueryResultRow } from 'pg';

export type ScheduledNotificationStatus = 'scheduled' | 'sent' | 'cancelled';

export interface ScheduledNotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly kind: string;
  readonly fireAt: string;
  readonly payload: Record<string, unknown>;
  readonly status: ScheduledNotificationStatus;
  readonly sentAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface ScheduledNotificationInput {
  readonly id: string;
  readonly kind: string;
  readonly fireAt: string;
  readonly payload: Record<string, unknown>;
}

export interface SentNotificationRecord {
  readonly kind: string;
  readonly sentAt: string;
}

export interface NotificationStore {
  listScheduledNotifications(
    userId: string,
    since: string,
  ): Promise<readonly ScheduledNotificationRecord[]>;
  replaceScheduledNotifications(
    userId: string,
    notifications: readonly ScheduledNotificationInput[],
    now: Date,
  ): Promise<void>;
  listSentNotifications(userId: string, since: string): Promise<readonly SentNotificationRecord[]>;
  markNotificationSent(userId: string, kind: string, now: Date): Promise<boolean>;
}

interface NotificationRow extends QueryResultRow {
  id: string;
  user_id: string;
  kind: string;
  fire_at: Date | string;
  payload_json: unknown;
  status: string;
  sent_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapNotification(row: NotificationRow): ScheduledNotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    fireAt: requiredIso(row.fire_at),
    payload: record(row.payload_json),
    status:
      row.status === 'sent' || row.status === 'cancelled' ? row.status : 'scheduled',
    sentAt: iso(row.sent_at),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
    deletedAt: iso(row.deleted_at),
  };
}

export class PostgresNotificationStore implements NotificationStore {
  constructor(private readonly pool: Pool) {}

  private async withUser<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listScheduledNotifications(
    userId: string,
    since: string,
  ): Promise<readonly ScheduledNotificationRecord[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<NotificationRow>(
        `SELECT * FROM public.scheduled_notifications
         WHERE user_id = $1 AND deleted_at IS NULL AND fire_at >= $2
         ORDER BY fire_at`,
        [userId, since],
      );
      return result.rows.map(mapNotification);
    });
  }

  async replaceScheduledNotifications(
    userId: string,
    notifications: readonly ScheduledNotificationInput[],
    now: Date,
  ): Promise<void> {
    const timestamp = now.toISOString();
    await this.withUser(userId, async (client) => {
      await client.query(
        `UPDATE public.scheduled_notifications
         SET status = 'cancelled', updated_at = $2
         WHERE user_id = $1 AND status = 'scheduled'`,
        [userId, timestamp],
      );
      for (const notification of notifications) {
        await client.query(
          `INSERT INTO public.scheduled_notifications
             (id, user_id, kind, fire_at, payload_json, status, sent_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, 'scheduled', NULL, $6, $6)
           ON CONFLICT (id) DO UPDATE
           SET kind = EXCLUDED.kind,
               fire_at = EXCLUDED.fire_at,
               payload_json = EXCLUDED.payload_json,
               updated_at = EXCLUDED.updated_at,
               status = CASE
                 WHEN scheduled_notifications.status = 'sent' THEN 'sent'
                 ELSE 'scheduled'
               END`,
          [
            notification.id,
            userId,
            notification.kind,
            notification.fireAt,
            JSON.stringify(notification.payload),
            timestamp,
          ],
        );
      }
    });
  }

  async listSentNotifications(
    userId: string,
    since: string,
  ): Promise<readonly SentNotificationRecord[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<NotificationRow>(
        `SELECT * FROM public.scheduled_notifications
         WHERE user_id = $1 AND status = 'sent' AND sent_at >= $2
         ORDER BY sent_at`,
        [userId, since],
      );
      return result.rows.flatMap((row) => {
        const sentAt = iso(row.sent_at);
        return sentAt ? [{ kind: row.kind, sentAt }] : [];
      });
    });
  }

  async markNotificationSent(userId: string, kind: string, now: Date): Promise<boolean> {
    const timestamp = now.toISOString();
    return this.withUser(userId, async (client) => {
      const result = await client.query(
        `UPDATE public.scheduled_notifications
         SET status = 'sent', sent_at = $3, updated_at = $3
         WHERE id = (
           SELECT id FROM public.scheduled_notifications
           WHERE user_id = $1 AND kind = $2 AND status = 'scheduled' AND deleted_at IS NULL
           ORDER BY fire_at LIMIT 1
         )
         RETURNING id`,
        [userId, kind, timestamp],
      );
      return (result.rowCount ?? 0) > 0;
    });
  }
}
