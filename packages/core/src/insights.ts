import { z } from 'zod';

import { dayKey } from './gamification.js';
import { buildErrorHeatmap, errorHeatmapEntrySchema } from './progress-views.js';

export const insightDaySchema = z.object({
  date: z.string().min(1),
  attempts: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
});

export const weekInsightsSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  activeDays: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  correctRate: z.number().min(0).max(1),
  xp: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  days: z.array(insightDaySchema).length(7),
  heatmap: z.array(insightDaySchema).length(28),
  errorHeatmap: z.array(errorHeatmapEntrySchema),
});

export type WeekInsights = z.infer<typeof weekInsightsSchema>;

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildWeekInsights(input: {
  readonly now: Date;
  readonly timeZone: string;
  readonly attempts: readonly { readonly correct: boolean; readonly createdAt: string }[];
  readonly xpEvents: readonly { readonly amount: number; readonly createdAt: string }[];
  readonly errors: readonly {
    readonly createdAt: string;
    readonly ruleId?: string | null;
    readonly errorType?: string;
  }[];
}): WeekInsights {
  const today = dayKey(input.now, input.timeZone);
  const heatmapDates = Array.from({ length: 28 }, (_, index) => addDays(today, index - 27));
  const byDate = new Map(
    heatmapDates.map((date) => [date, { date, attempts: 0, correct: 0, xp: 0, errors: 0 }]),
  );
  for (const attempt of input.attempts) {
    const entry = byDate.get(dayKey(new Date(attempt.createdAt), input.timeZone));
    if (!entry) continue;
    entry.attempts += 1;
    if (attempt.correct) entry.correct += 1;
  }
  for (const event of input.xpEvents) {
    const entry = byDate.get(dayKey(new Date(event.createdAt), input.timeZone));
    if (entry) entry.xp += event.amount;
  }
  for (const error of input.errors) {
    const entry = byDate.get(dayKey(new Date(error.createdAt), input.timeZone));
    if (entry) entry.errors += 1;
  }
  const heatmap = [...byDate.values()];
  const days = heatmap.slice(-7);
  const attempts = days.reduce((sum, day) => sum + day.attempts, 0);
  const correct = days.reduce((sum, day) => sum + day.correct, 0);
  return {
    startDate: days[0]?.date ?? today,
    endDate: days[6]?.date ?? today,
    activeDays: days.filter((day) => day.attempts > 0 || day.xp > 0).length,
    attempts,
    correctRate: attempts === 0 ? 0 : correct / attempts,
    xp: days.reduce((sum, day) => sum + day.xp, 0),
    errors: days.reduce((sum, day) => sum + day.errors, 0),
    days,
    heatmap,
    errorHeatmap: buildErrorHeatmap(
      input.errors.flatMap((error) =>
        error.errorType
          ? [
              {
                ruleId: error.ruleId ?? null,
                errorType: error.errorType,
                createdAt: error.createdAt,
              },
            ]
          : [],
      ),
    ),
  };
}
