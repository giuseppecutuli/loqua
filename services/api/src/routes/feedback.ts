import {
  FEEDBACK_KINDS,
  FEEDBACK_TARGET_TYPES,
  createFeedback,
  feedbackSchema,
  generateUuidV7,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';

export interface FeedbackRoutesDeps {
  readonly account: AccountRepository;
  readonly now: () => Date;
}

const createSchema = z.object({
  targetType: z.enum(FEEDBACK_TARGET_TYPES),
  targetId: z.string().min(1).max(120).nullable().optional(),
  kind: z.enum(FEEDBACK_KINDS),
  comment: z.string().max(1000).nullable().optional(),
});

export function createFeedbackRoutes(deps: FeedbackRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    return c.json({
      feedback: await deps.account.listFeedback(user.id, snapshot.profile.id),
    });
  });

  app.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid feedback payload'), 400);
    }
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const feedback = createFeedback({
      id: generateUuidV7(),
      userId: user.id,
      profileId: snapshot.profile.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId ?? null,
      kind: parsed.data.kind,
      comment: parsed.data.comment ?? null,
      now: deps.now(),
    });
    const validated = feedbackSchema.safeParse(feedback);
    if (!validated.success) {
      return c.json(errorResponse('invalid_request', 'Invalid feedback payload'), 400);
    }
    await deps.account.upsertFeedback(validated.data);
    return c.json({ feedback: validated.data }, 201);
  });

  return app;
}
