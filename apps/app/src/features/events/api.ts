import { request } from '../../lib/http';

export type EventProperties = Record<string, string | number | boolean | null>;

export async function trackEvent(name: string, properties: EventProperties = {}): Promise<void> {
  try {
    await request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        events: [{ name, occurredAt: new Date().toISOString(), properties }],
      }),
    });
  } catch {
    // Product analytics must never break the learning loop.
  }
}
