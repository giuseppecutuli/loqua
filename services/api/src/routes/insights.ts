import { buildWeekInsights } from '@loqua/core';
import { Hono } from 'hono';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';
import type { SessionStore } from '../repos/session.js';

export interface InsightsRoutesDeps {
  readonly account: AccountRepository;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

export function createInsightsRoutes(deps: InsightsRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const now = deps.now();
    const since = new Date(now.getTime() - 28 * 86_400_000).toISOString();
    const [attempts, xpEvents, errors] = await Promise.all([
      deps.sessions.listAttemptsSince(user.id, since),
      deps.sessions.listXpEvents(user.id, since),
      deps.sessions.listErrorEventsSince(user.id, since),
    ]);
    const insights = buildWeekInsights({
      now,
      timeZone: snapshot.profile.timezone,
      attempts: attempts.map((attempt) => ({
        correct: attempt.correct,
        createdAt: attempt.createdAt,
      })),
      xpEvents: xpEvents.map((event) => ({
        amount: event.amount,
        createdAt: event.createdAt,
      })),
      errors: errors.map((error) => ({
        createdAt: error.createdAt,
        ruleId: error.ruleId,
        errorType: error.errorType,
      })),
    });
    return c.json({ insights });
  });

  return app;
}
