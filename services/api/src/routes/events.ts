import { sanitizeProductEvent, type ProductEvent } from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { ProductEventStore } from '../repos/events.js';

export interface EventRoutesDeps {
  readonly events: ProductEventStore;
  readonly now: () => Date;
}

const batchSchema = z.object({
  events: z.array(z.unknown()).min(1).max(50),
});

export function createEventRoutes(deps: EventRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid events batch'), 400);
    }

    const accepted: ProductEvent[] = [];
    let rejected = 0;
    for (const entry of parsed.data.events) {
      const sanitized = sanitizeProductEvent(entry);
      if (sanitized.ok) accepted.push(sanitized.value);
      else rejected += 1;
    }

    await deps.events.insertProductEvents(user.id, accepted, deps.now());
    return c.json({ accepted: accepted.length, rejected });
  });

  return app;
}
