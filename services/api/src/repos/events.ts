import type { ProductEvent } from '@loqua/core';
import type { ProductEventStore } from '@loqua/db-postgres';

export type { ProductEventStore } from '@loqua/db-postgres';

export interface StoredProductEvent extends ProductEvent {
  readonly userId: string;
  readonly createdAt: string;
}

export class InMemoryProductEventStore implements ProductEventStore {
  readonly events: StoredProductEvent[] = [];

  async insertProductEvents(
    userId: string,
    events: readonly ProductEvent[],
    now: Date,
  ): Promise<void> {
    const createdAt = now.toISOString();
    for (const event of events) {
      this.events.push({ ...event, userId, createdAt });
    }
  }
}
