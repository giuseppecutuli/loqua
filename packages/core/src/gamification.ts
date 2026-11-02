import { z } from 'zod';

type StreakMode = 'daily' | 'flexible' | 'weekend_off';

export const gamificationQuestSchema = z.object({
  id: z.string().min(1),
  titleKey: z.string().min(1),
  progress: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  completed: z.boolean(),
  xp: z.number().int().nonnegative(),
});

export const gamificationBadgeSchema = z.object({
  id: z.string().min(1),
  titleKey: z.string().min(1),
  earned: z.boolean(),
});

export const gamificationSnapshotSchema = z.object({
  totalXp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  xpToday: z.number().int().nonnegative(),
  streak: z.object({
    current: z.number().int().nonnegative(),
    best: z.number().int().nonnegative(),
    graceDays: z.number().int().nonnegative(),
    activeToday: z.boolean(),
  }),
  quests: z.array(gamificationQuestSchema),
  weeklyMission: gamificationQuestSchema,
  badges: z.array(gamificationBadgeSchema),
});

export type GamificationQuest = z.infer<typeof gamificationQuestSchema>;
export type GamificationBadge = z.infer<typeof gamificationBadgeSchema>;
export type GamificationSnapshot = z.infer<typeof gamificationSnapshotSchema>;

export function xpForAttempt(input: {
  readonly correct: boolean;
  readonly difficultyB: number;
  readonly hintUsed: boolean;
}): number {
  if (!input.correct) return 0;
  const base = 10 + Math.max(0, Math.round((input.difficultyB + 2) * 2));
  return input.hintUsed ? Math.max(2, Math.round(base * 0.6)) : base;
}

export function levelFromXp(totalXp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, totalXp) / 50)) + 1);
}

export function dayKey(date: Date, timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function previousDay(key: string): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function isWeekend(key: string): boolean {
  const day = new Date(`${key}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function computeStreak(input: {
  readonly activeDays: readonly string[];
  readonly today: string;
  readonly mode: StreakMode;
  readonly graceDays?: number;
}): { current: number; best: number; graceDays: number; activeToday: boolean } {
  const days = [...new Set(input.activeDays)].sort();
  const active = new Set(days);
  const grace = input.graceDays ?? 1;
  const activeToday = active.has(input.today);

  let cursor = activeToday ? input.today : previousDay(input.today);
  let current = 0;
  let usedGrace = 0;
  while (true) {
    if (input.mode === 'weekend_off' && isWeekend(cursor)) {
      cursor = previousDay(cursor);
      continue;
    }
    if (active.has(cursor)) {
      current += 1;
      cursor = previousDay(cursor);
      continue;
    }
    if (usedGrace < grace) {
      usedGrace += 1;
      cursor = previousDay(cursor);
      continue;
    }
    break;
  }

  let best = 0;
  let run = 0;
  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    if (!day) continue;
    if (index === 0 || day === previousDay(days[index - 1] ?? day)) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }
  return { current, best, graceDays: grace, activeToday };
}

export interface GamificationInput {
  readonly now: Date;
  readonly timeZone: string;
  readonly mode: StreakMode;
  readonly activeDays: readonly string[];
  readonly xpEvents: readonly { readonly amount: number; readonly createdAt: string }[];
  readonly attemptsToday: {
    readonly correct: boolean;
    readonly hintUsed: boolean;
    readonly latencyMs: number;
  }[];
  readonly conversationsToday: number;
}

export function buildGamificationSnapshot(input: GamificationInput): GamificationSnapshot {
  const today = dayKey(input.now, input.timeZone);
  const xpToday = input.xpEvents
    .filter((event) => dayKey(new Date(event.createdAt), input.timeZone) === today)
    .reduce((sum, event) => sum + event.amount, 0);
  const totalXp = input.xpEvents.reduce((sum, event) => sum + event.amount, 0);
  const streak = computeStreak({
    activeDays: input.activeDays,
    today,
    mode: input.mode,
  });
  const correct = input.attemptsToday.filter((attempt) => attempt.correct).length;
  const fast = input.attemptsToday.filter(
    (attempt) => attempt.correct && !attempt.hintUsed && attempt.latencyMs <= 4_000,
  ).length;
  const quests: GamificationQuest[] = [
    {
      id: 'daily.streak',
      titleKey: 'gamification.quest.streak',
      progress: streak.activeToday ? 1 : 0,
      target: 1,
      completed: streak.activeToday,
      xp: 10,
    },
    {
      id: 'daily.correct',
      titleKey: 'gamification.quest.correct',
      progress: correct,
      target: 8,
      completed: correct >= 8,
      xp: 20,
    },
    {
      id: 'daily.fast',
      titleKey: 'gamification.quest.fast',
      progress: fast,
      target: 3,
      completed: fast >= 3,
      xp: 15,
    },
  ];
  const weeklyMission: GamificationQuest = {
    id: 'weekly.consistency',
    titleKey: 'gamification.mission.consistency',
    progress: Math.min(5, input.activeDays.length),
    target: 5,
    completed: input.activeDays.length >= 5,
    xp: 60,
  };
  const badges: GamificationBadge[] = [
    { id: 'first-step', titleKey: 'gamification.badge.firstStep', earned: input.activeDays.length >= 1 },
    { id: 'streak-3', titleKey: 'gamification.badge.streak3', earned: streak.best >= 3 },
    { id: 'streak-7', titleKey: 'gamification.badge.streak7', earned: streak.best >= 7 },
    { id: 'xp-500', titleKey: 'gamification.badge.xp500', earned: totalXp >= 500 },
    { id: 'conversation-1', titleKey: 'gamification.badge.conversation1', earned: input.conversationsToday >= 1 },
  ];
  return {
    totalXp,
    level: levelFromXp(totalXp),
    xpToday,
    streak,
    quests,
    weeklyMission,
    badges,
  };
}
