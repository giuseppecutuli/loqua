import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  planNotifications,
  zonedInstant,
  type NotificationPlanningInput,
  type NotificationPreferences,
} from '../src/notifications.js';

function input(overrides: Partial<NotificationPlanningInput> = {}): NotificationPlanningInput {
  return {
    now: new Date('2026-11-02T06:00:00.000Z'),
    timeZone: 'Europe/Rome',
    prefs: DEFAULT_NOTIFICATION_PREFERENCES,
    permission: 'granted',
    planStarted: false,
    dueReviewCount: 12,
    hasProductionToday: false,
    currentStreak: 4,
    weeklyMissionIncomplete: true,
    mediaPickAvailable: true,
    daysInactive: 0,
    sentNotifications: [],
    ...overrides,
  };
}

function only(kind: keyof NotificationPreferences): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    planReady: kind === 'planReady',
    dueReview: kind === 'dueReview',
    streakRisk: kind === 'streakRisk',
    weeklyMission: kind === 'weeklyMission',
    mediaRecommendation: kind === 'mediaRecommendation',
    reengagement: kind === 'reengagement',
  };
}

describe('notification planner', () => {
  it('returns nothing when notifications are disabled', () => {
    const plan = planNotifications(
      input({ prefs: { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: false } }),
    );
    expect(plan.notifications).toHaveLength(0);
    expect(plan.permissionPrompt).toBe(false);
    expect(plan.banner).toBeNull();
  });

  it('asks for permission once and falls back to in-app banners', () => {
    const plan = planNotifications(
      input({
        now: new Date('2026-11-02T07:00:00.000Z'),
        permission: 'unknown',
        prefs: only('planReady'),
      }),
    );
    expect(plan.permissionPrompt).toBe(true);
    expect(plan.notifications.every((entry) => entry.channel === 'in_app')).toBe(true);
    expect(plan.banner?.kind).toBe('plan_ready');
  });

  it('does not re-prompt after a denial and keeps in-app banners', () => {
    const plan = planNotifications(
      input({
        now: new Date('2026-11-02T07:00:00.000Z'),
        permission: 'denied',
        prefs: only('planReady'),
      }),
    );
    expect(plan.permissionPrompt).toBe(false);
    expect(plan.notifications.every((entry) => entry.channel === 'in_app')).toBe(true);
    expect(plan.banner).not.toBeNull();
  });

  it('never schedules more than the two earliest notifications per local day', () => {
    const plan = planNotifications(input({ prefs: { ...DEFAULT_NOTIFICATION_PREFERENCES, maxPerDay: 2 } }));
    const firstDay = plan.notifications.filter((entry) => entry.localDay === '2026-11-02');
    expect(firstDay.length).toBeLessThanOrEqual(2);
    expect(firstDay.map((entry) => entry.kind)).toEqual(['plan_ready', 'due_review']);
  });

  it('moves notifications out of quiet hours', () => {
    const plan = planNotifications(
      input({
        now: new Date('2026-11-02T00:00:00.000Z'),
        prefs: { ...only('planReady'), quietHours: ['07:00', '08:00'] },
      }),
    );
    const first = plan.notifications[0];
    expect(first).toBeDefined();
    expect(first?.fireAt).toBe('2026-11-02T07:00:00.000Z');
  });

  it('schedules the weekly mission on Sunday', () => {
    const plan = planNotifications(
      input({ now: new Date('2026-11-02T08:00:00.000Z'), prefs: only('weeklyMission') }),
    );
    const mission = plan.notifications.find((entry) => entry.kind === 'weekly_mission');
    expect(mission?.localDay).toBe('2026-11-08');
  });

  it('keeps the local wall-clock time across a DST change', () => {
    const before = planNotifications(
      input({
        now: new Date('2026-03-28T00:00:00.000Z'),
        prefs: only('planReady'),
      }),
    ).notifications[0];
    const after = planNotifications(
      input({
        now: new Date('2026-03-30T00:00:00.000Z'),
        prefs: only('planReady'),
      }),
    ).notifications[0];
    expect(before?.fireAt).toBe('2026-03-28T06:30:00.000Z');
    expect(after?.fireAt).toBe('2026-03-30T05:30:00.000Z');
    expect(zonedInstant('2026-03-30', '07:30', 'Europe/Rome').toISOString()).toBe(
      '2026-03-30T05:30:00.000Z',
    );
  });

  it('re-plans when the learner changes timezone', () => {
    const rome = planNotifications(
      input({ now: new Date('2026-11-02T10:00:00.000Z'), prefs: only('planReady') }),
    ).notifications[0];
    const newYork = planNotifications(
      input({
        now: new Date('2026-11-02T10:00:00.000Z'),
        timeZone: 'America/New_York',
        prefs: only('planReady'),
      }),
    ).notifications[0];
    expect(rome?.fireAt).not.toBe(newYork?.fireAt);
    expect(rome?.localDay).not.toBe(newYork?.localDay);
  });

  it('does not repeat a notification already sent the same day', () => {
    const plan = planNotifications(
      input({
        now: new Date('2026-11-02T07:00:00.000Z'),
        prefs: only('planReady'),
        sentNotifications: [{ kind: 'plan_ready', sentAt: '2026-11-02T06:40:00.000Z' }],
      }),
    );
    expect(plan.notifications.some((entry) => entry.kind === 'plan_ready')).toBe(false);
  });

  it('uses native delivery when permission is granted', () => {
    const plan = planNotifications(
      input({ now: new Date('2026-11-02T07:00:00.000Z'), prefs: only('planReady') }),
    );
    expect(plan.notifications[0]?.channel).toBe('native');
    expect(plan.banner).toBeNull();
  });
});
