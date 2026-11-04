import { buildGamificationSnapshot, dayKey } from '@loqua/core';
import { Hono } from 'hono';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';
import type { SessionStore } from '../repos/session.js';

export interface GamificationRoutesDeps {
  readonly account: AccountRepository;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

export function createGamificationRoutes(deps: GamificationRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const now = deps.now();
    const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
    const sinceToday = new Date(now.getTime() - 86_400_000).toISOString();
    const [xpEvents, attempts, conversationTurns] = await Promise.all([
      deps.sessions.listXpEvents(user.id, since),
      deps.sessions.listAttemptsSince(user.id, since),
      deps.sessions.countConversationTurnsSince(user.id, sinceToday),
    ]);
    const timeZone = snapshot.profile.timezone;
    const today = dayKey(now, timeZone);
    const snapshotGamification = buildGamificationSnapshot({
      now,
      timeZone,
      mode: snapshot.profile.streakMode,
      activeDays: [
        ...new Set(attempts.map((attempt) => dayKey(new Date(attempt.createdAt), timeZone))),
        ...(conversationTurns > 0 ? [today] : []),
      ],
      repairDays: xpEvents
        .filter((event) => event.reason === 'streak_repair')
        .map((event) => event.sourceId),
      xpEvents: xpEvents.map((event) => ({ amount: event.amount, createdAt: event.createdAt })),
      attemptsToday: attempts
        .filter((attempt) => dayKey(new Date(attempt.createdAt), timeZone) === today)
        .map((attempt) => ({
          correct: attempt.correct,
          hintUsed: attempt.hintUsed,
          latencyMs: attempt.latencyMs,
        })),
      conversationsToday: conversationTurns,
    });
    return c.json({ gamification: snapshotGamification });
  });

  return app;
}
