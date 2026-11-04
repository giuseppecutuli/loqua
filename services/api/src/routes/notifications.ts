import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildGamificationSnapshot,
  dayKey,
  notificationKindSchema,
  notificationPermissionSchema,
  notificationPreferencesSchema,
  planNotifications,
  type NotificationKind,
  type NotificationPreferences,
} from '@loqua/core';
import { Hono } from 'hono';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';
import type { MediaStore } from '../repos/media.js';
import type { NotificationStore } from '../repos/notifications.js';
import type { SessionStore } from '../repos/session.js';

export interface NotificationRoutesDeps {
  readonly account: AccountRepository;
  readonly sessions: SessionStore;
  readonly notifications: NotificationStore;
  readonly media: MediaStore;
  readonly now: () => Date;
}

function readPrefs(value: unknown): NotificationPreferences {
  const parsed = notificationPreferencesSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_NOTIFICATION_PREFERENCES;
}

function daysBetween(left: string, right: string): number {
  const first = new Date(`${left}T00:00:00.000Z`).getTime();
  const second = new Date(`${right}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((second - first) / 86_400_000));
}

export function createNotificationRoutes(deps: NotificationRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const now = deps.now();
    const timeZone = snapshot.profile.timezone;
    const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
    const sinceToday = new Date(now.getTime() - 86_400_000).toISOString();
    const [attempts, xpEvents, conversationTurns, dueCards, sentNotifications] = await Promise.all([
      deps.sessions.listAttemptsSince(user.id, since),
      deps.sessions.listXpEvents(user.id, since),
      deps.sessions.countConversationTurnsSince(user.id, sinceToday),
      deps.sessions.listDueSrsCards(user.id, snapshot.profile.id, now, 100),
      deps.notifications.listSentNotifications(user.id, since),
    ]);

    const today = dayKey(now, timeZone);
    const attemptDays = attempts.map((attempt) =>
      dayKey(new Date(attempt.createdAt), timeZone),
    );
    const activeDays = [...new Set(attemptDays)];
    if (conversationTurns > 0 && !activeDays.includes(today)) activeDays.push(today);
    const attemptsToday = attempts
      .filter((attempt) => dayKey(new Date(attempt.createdAt), timeZone) === today)
      .map((attempt) => ({
        correct: attempt.correct,
        hintUsed: attempt.hintUsed,
        latencyMs: attempt.latencyMs,
      }));

    const gamification = buildGamificationSnapshot({
      now,
      timeZone,
      mode: snapshot.profile.streakMode,
      activeDays,
      repairDays: xpEvents
        .filter((event) => event.reason === 'streak_repair')
        .map((event) => event.sourceId),
      xpEvents: xpEvents.map((event) => ({
        amount: event.amount,
        createdAt: event.createdAt,
      })),
      attemptsToday,
      conversationsToday: conversationTurns,
    });

    const lastActive = activeDays.sort().at(-1) ?? null;
    const permission = notificationPermissionSchema.catch('unknown').parse(c.req.query('permission'));
    const prefs = readPrefs(snapshot.settings?.notificationPrefs);
    const mediaTaste = await deps.media.getTasteProfile(snapshot.profile.id);

    const plan = planNotifications({
      now,
      timeZone,
      prefs,
      permission,
      planStarted: attemptsToday.length > 0 || conversationTurns > 0,
      dueReviewCount: dueCards.length,
      hasProductionToday:
        conversationTurns > 0 || attemptsToday.length > 0 || gamification.streak.activeToday,
      currentStreak: gamification.streak.current,
      weeklyMissionIncomplete: !gamification.weeklyMission.completed,
      mediaPickAvailable: mediaTaste !== null,
      daysInactive: lastActive ? daysBetween(lastActive, today) : 0,
      sentNotifications: sentNotifications.map((entry) => ({
        kind: entry.kind as NotificationKind,
        sentAt: entry.sentAt,
      })),
    });

    await deps.notifications.replaceScheduledNotifications(
      user.id,
      plan.notifications.map((notification) => ({
        id: `${user.id}:${notification.id}`,
        kind: notification.kind,
        fireAt: notification.fireAt,
        payload: {
          deepLink: notification.deepLink,
          titleKey: notification.titleKey,
          bodyKey: notification.bodyKey,
          params: notification.params,
        },
      })),
      now,
    );

    return c.json({ prefs, plan });
  });

  app.put('/preferences', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = notificationPreferencesSchema.safeParse(
      body && typeof body === 'object' ? (body as { prefs?: unknown }).prefs : null,
    );
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid notification preferences'), 400);
    }
    await deps.account.upsertSettings({
      userId: user.id,
      notificationPrefs: parsed.data,
      now: deps.now(),
    });
    return c.json({ prefs: parsed.data });
  });

  app.post('/sent', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = notificationKindSchema.safeParse(
      body && typeof body === 'object' ? (body as { kind?: unknown }).kind : null,
    );
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid notification kind'), 400);
    }
    const marked = await deps.notifications.markNotificationSent(user.id, parsed.data, deps.now());
    return c.json({ status: marked ? 'sent' : 'not_scheduled' });
  });

  return app;
}
