import { z } from 'zod';

import { isIanaTimezone } from './dates.js';
import { dayKey } from './gamification.js';

export const NOTIFICATION_KINDS = [
  'plan_ready',
  'due_review',
  'streak_risk',
  'weekly_mission',
  'media_pick',
  'reengagement',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);

export const notificationPermissionSchema = z.enum([
  'unknown',
  'granted',
  'denied',
  'unsupported',
]);

export type NotificationPermission = z.infer<typeof notificationPermissionSchema>;

export const notificationChannelSchema = z.enum(['native', 'in_app']);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const notificationPreferencesSchema = z.object({
  enabled: z.boolean(),
  quietHours: z.tuple([timeOfDaySchema, timeOfDaySchema]),
  maxPerDay: z.union([z.literal(1), z.literal(2)]),
  planReady: z.boolean(),
  dueReview: z.boolean(),
  streakRisk: z.boolean(),
  weeklyMission: z.boolean(),
  mediaRecommendation: z.boolean(),
  reengagement: z.boolean(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  quietHours: ['22:00', '07:00'],
  maxPerDay: 2,
  planReady: true,
  dueReview: true,
  streakRisk: true,
  weeklyMission: true,
  mediaRecommendation: true,
  reengagement: true,
};

export const scheduledNotificationSchema = z.object({
  id: z.string().min(1),
  kind: notificationKindSchema,
  fireAt: z.iso.datetime({ offset: false }),
  localDay: z.string().min(1),
  channel: notificationChannelSchema,
  titleKey: z.string().min(1),
  bodyKey: z.string().min(1),
  deepLink: z.string().min(1),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
});

export type ScheduledNotification = z.infer<typeof scheduledNotificationSchema>;

export const notificationPlanSchema = z.object({
  notifications: z.array(scheduledNotificationSchema),
  permissionPrompt: z.boolean(),
  banner: scheduledNotificationSchema.nullable(),
});

export type NotificationPlan = z.infer<typeof notificationPlanSchema>;

export interface SentNotification {
  readonly kind: NotificationKind;
  readonly sentAt: string;
}

export interface NotificationPlanningInput {
  readonly now: Date;
  readonly timeZone: string;
  readonly prefs: NotificationPreferences;
  readonly permission: NotificationPermission;
  readonly planStarted: boolean;
  readonly dueReviewCount: number;
  readonly hasProductionToday: boolean;
  readonly currentStreak: number;
  readonly weeklyMissionIncomplete: boolean;
  readonly mediaPickAvailable: boolean;
  readonly daysInactive: number;
  readonly sentNotifications?: readonly SentNotification[];
}

interface WindowSpec {
  readonly start: string;
  readonly end: string;
  readonly weekday: number | null;
  readonly daily: boolean;
}

const WINDOWS: Record<NotificationKind, WindowSpec> = {
  plan_ready: { start: '07:30', end: '09:00', weekday: null, daily: true },
  due_review: { start: '12:00', end: '14:00', weekday: null, daily: true },
  streak_risk: { start: '19:30', end: '21:00', weekday: null, daily: true },
  weekly_mission: { start: '10:00', end: '12:00', weekday: 0, daily: false },
  media_pick: { start: '10:00', end: '12:00', weekday: 6, daily: false },
  reengagement: { start: '18:00', end: '20:00', weekday: null, daily: true },
};

const PRIORITY: Record<NotificationKind, number> = {
  streak_risk: 0,
  due_review: 1,
  plan_ready: 2,
  weekly_mission: 3,
  media_pick: 4,
  reengagement: 5,
};

const COPY: Record<NotificationKind, { titleKey: string; bodyKey: string; deepLink: string }> = {
  plan_ready: {
    titleKey: 'notifications.planReady.title',
    bodyKey: 'notifications.planReady.body',
    deepLink: '/',
  },
  due_review: {
    titleKey: 'notifications.dueReview.title',
    bodyKey: 'notifications.dueReview.body',
    deepLink: '/practice',
  },
  streak_risk: {
    titleKey: 'notifications.streakRisk.title',
    bodyKey: 'notifications.streakRisk.body',
    deepLink: '/talk',
  },
  weekly_mission: {
    titleKey: 'notifications.weeklyMission.title',
    bodyKey: 'notifications.weeklyMission.body',
    deepLink: '/',
  },
  media_pick: {
    titleKey: 'notifications.mediaPick.title',
    bodyKey: 'notifications.mediaPick.body',
    deepLink: '/practice',
  },
  reengagement: {
    titleKey: 'notifications.reengagement.title',
    bodyKey: 'notifications.reengagement.body',
    deepLink: '/',
  },
};

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? '0';
    return Number.parseInt(value, 10);
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

export function zonedInstant(day: string, time: string, timeZone: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (
    year === undefined ||
    month === undefined ||
    date === undefined ||
    hour === undefined ||
    minute === undefined ||
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(date) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new Error('invalid_zoned_instant');
  }
  const targetWall = Date.UTC(year, month - 1, date, hour, minute, 0, 0);
  let candidate = targetWall;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = localParts(new Date(candidate), timeZone);
    const wall = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0,
    );
    const next = targetWall - (wall - candidate);
    if (next === candidate) break;
    candidate = next;
  }
  return new Date(candidate);
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay();
}

function minutesOf(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function isQuiet(instant: Date, timeZone: string, quiet: readonly [string, string]): boolean {
  const start = minutesOf(quiet[0]);
  const end = minutesOf(quiet[1]);
  if (start === end) return false;
  const parts = localParts(instant, timeZone);
  const current = parts.hour * 60 + parts.minute;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function moveOutOfQuietHours(
  instant: Date,
  timeZone: string,
  quiet: readonly [string, string],
): Date {
  if (!isQuiet(instant, timeZone, quiet)) return instant;
  const today = dayKey(instant, timeZone);
  for (const offset of [0, 1]) {
    const candidate = zonedInstant(addDays(today, offset), quiet[1], timeZone);
    if (candidate.getTime() > instant.getTime()) return candidate;
  }
  return instant;
}

function occurrenceDay(
  now: Date,
  timeZone: string,
  spec: WindowSpec,
): string {
  const today = dayKey(now, timeZone);
  if (!spec.daily) {
    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = addDays(today, offset);
      if (weekdayOf(candidate) !== spec.weekday) continue;
      if (offset === 0) {
        const end = zonedInstant(candidate, spec.end, timeZone);
        if (now.getTime() < end.getTime()) return candidate;
        continue;
      }
      return candidate;
    }
    return addDays(today, 7);
  }
  const end = zonedInstant(today, spec.end, timeZone);
  return now.getTime() < end.getTime() ? today : addDays(today, 1);
}

interface Candidate {
  readonly kind: NotificationKind;
  readonly start: Date;
  readonly end: Date;
  readonly fireAt: Date;
  readonly params: Record<string, string | number>;
}

function buildCandidate(
  kind: NotificationKind,
  now: Date,
  timeZone: string,
  prefs: NotificationPreferences,
  params: Record<string, string | number>,
): Candidate {
  const spec = WINDOWS[kind];
  const day = occurrenceDay(now, timeZone, spec);
  const start = zonedInstant(day, spec.start, timeZone);
  const end = zonedInstant(day, spec.end, timeZone);
  let fireAt = start;
  if (now.getTime() > start.getTime()) {
    fireAt = now.getTime() < end.getTime() ? new Date(now.getTime() + 60_000) : start;
  }
  if (fireAt.getTime() > end.getTime()) fireAt = end;
  return {
    kind,
    start,
    end,
    fireAt: moveOutOfQuietHours(fireAt, timeZone, prefs.quietHours),
    params,
  };
}

function candidatesFor(
  input: NotificationPlanningInput,
): Candidate[] {
  const { now, timeZone, prefs } = input;
  const candidates: Candidate[] = [];
  if (prefs.planReady && !input.planStarted) {
    candidates.push(buildCandidate('plan_ready', now, timeZone, prefs, {}));
  }
  if (prefs.dueReview && input.dueReviewCount >= 10) {
    candidates.push(
      buildCandidate('due_review', now, timeZone, prefs, { count: input.dueReviewCount }),
    );
  }
  if (prefs.streakRisk && input.currentStreak > 0 && !input.hasProductionToday) {
    candidates.push(
      buildCandidate('streak_risk', now, timeZone, prefs, { streak: input.currentStreak }),
    );
  }
  if (prefs.weeklyMission && input.weeklyMissionIncomplete) {
    candidates.push(buildCandidate('weekly_mission', now, timeZone, prefs, {}));
  }
  if (prefs.mediaRecommendation && input.mediaPickAvailable) {
    candidates.push(buildCandidate('media_pick', now, timeZone, prefs, {}));
  }
  if (prefs.reengagement && input.daysInactive >= 3) {
    const recent = (input.sentNotifications ?? []).some(
      (entry) =>
        entry.kind === 'reengagement' &&
        now.getTime() - new Date(entry.sentAt).getTime() < 7 * 86_400_000,
    );
    if (!recent) {
      candidates.push(
        buildCandidate('reengagement', now, timeZone, prefs, { days: input.daysInactive }),
      );
    }
  }
  return candidates;
}

function sameDaySent(
  sent: readonly SentNotification[],
  kind: NotificationKind,
  day: string,
  timeZone: string,
): boolean {
  return sent.some(
    (entry) =>
      entry.kind === kind && dayKey(new Date(entry.sentAt), timeZone) === day,
  );
}

export function planNotifications(input: NotificationPlanningInput): NotificationPlan {
  if (!isIanaTimezone(input.timeZone)) throw new Error('invalid_timezone');
  if (!input.prefs.enabled) {
    return { notifications: [], permissionPrompt: false, banner: null };
  }

  const sent = input.sentNotifications ?? [];
  const denied = input.permission === 'denied' || input.permission === 'unsupported';
  const channel: NotificationChannel = input.permission === 'granted' ? 'native' : 'in_app';
  const permissionPrompt = input.permission === 'unknown';

  const candidates = candidatesFor(input)
    .filter((candidate) => {
      const localDay = dayKey(candidate.fireAt, input.timeZone);
      return !sameDaySent(sent, candidate.kind, localDay, input.timeZone);
    })
    .sort(
      (left, right) =>
        left.fireAt.getTime() - right.fireAt.getTime() ||
        PRIORITY[left.kind] - PRIORITY[right.kind],
    );

  const byDay = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const localDay = dayKey(candidate.fireAt, input.timeZone);
    const list = byDay.get(localDay) ?? [];
    list.push(candidate);
    byDay.set(localDay, list);
  }

  const selected: Candidate[] = [];
  for (const [localDay, list] of byDay) {
    const sentCount = sent.filter(
      (entry) => dayKey(new Date(entry.sentAt), input.timeZone) === localDay,
    ).length;
    const remaining = Math.max(0, input.prefs.maxPerDay - sentCount);
    const seenKinds = new Set<NotificationKind>();
    for (const candidate of list) {
      if (selected.length >= 10) break;
      if (seenKinds.has(candidate.kind)) continue;
      if (selected.filter((entry) => dayKey(entry.fireAt, input.timeZone) === localDay).length >= remaining) {
        break;
      }
      seenKinds.add(candidate.kind);
      selected.push(candidate);
    }
  }

  selected.sort((left, right) => left.fireAt.getTime() - right.fireAt.getTime());

  const notifications: ScheduledNotification[] = selected.map((candidate) => {
    const localDay = dayKey(candidate.fireAt, input.timeZone);
    const copy = COPY[candidate.kind];
    return {
      id: `${candidate.kind}:${localDay}`,
      kind: candidate.kind,
      fireAt: candidate.fireAt.toISOString(),
      localDay,
      channel,
      titleKey: copy.titleKey,
      bodyKey: copy.bodyKey,
      deepLink: copy.deepLink,
      params: candidate.params,
    };
  });

  const active = candidates
    .filter(
      (candidate) =>
        input.now.getTime() >= candidate.start.getTime() &&
        input.now.getTime() < candidate.end.getTime() &&
        !isQuiet(input.now, input.timeZone, input.prefs.quietHours),
    )
    .sort((left, right) => PRIORITY[left.kind] - PRIORITY[right.kind]);

  const activeCandidate = active[0];
  const banner: ScheduledNotification | null =
    activeCandidate && channel === 'in_app'
      ? {
          id: `${activeCandidate.kind}:${dayKey(activeCandidate.fireAt, input.timeZone)}`,
          kind: activeCandidate.kind,
          fireAt: activeCandidate.fireAt.toISOString(),
          localDay: dayKey(activeCandidate.fireAt, input.timeZone),
          channel: 'in_app',
          titleKey: COPY[activeCandidate.kind].titleKey,
          bodyKey: COPY[activeCandidate.kind].bodyKey,
          deepLink: COPY[activeCandidate.kind].deepLink,
          params: activeCandidate.params,
        }
      : null;

  return {
    notifications,
    permissionPrompt: permissionPrompt && !denied,
    banner,
  };
}
