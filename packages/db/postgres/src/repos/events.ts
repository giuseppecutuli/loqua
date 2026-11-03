import { generateUuidV7, type ProductEvent } from '@loqua/core';
import type { Pool, PoolClient } from 'pg';

export interface ProductEventStore {
  insertProductEvents(
    userId: string,
    events: readonly ProductEvent[],
    now: Date,
  ): Promise<void>;
}

export class PostgresProductEventStore implements ProductEventStore {
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

  async insertProductEvents(
    userId: string,
    events: readonly ProductEvent[],
    now: Date,
  ): Promise<void> {
    if (events.length === 0) return;
    const createdAt = now.toISOString();
    await this.withUser(userId, async (client) => {
      for (const event of events) {
        await client.query(
          `INSERT INTO public.product_events
             (id, user_id, name, schema_version, properties_json, occurred_at, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
          [
            generateUuidV7(),
            userId,
            event.name,
            event.schemaVersion,
            JSON.stringify(event.properties),
            event.occurredAt,
            createdAt,
          ],
        );
      }
    });
  }
}
