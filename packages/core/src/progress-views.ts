import { z } from 'zod';

import { cefrLevelSchema, skillDomainSchema } from './schemas.js';
import { cefrRank, type CefrLevel } from './skills.js';

export const skillRadarEntrySchema = z.object({
  skill: skillDomainSchema,
  level: cefrLevelSchema,
  value: z.number().min(0).max(1),
  mastery: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export type SkillRadarEntry = z.infer<typeof skillRadarEntrySchema>;

export interface SkillRadarInput {
  readonly skill: z.infer<typeof skillDomainSchema>;
  readonly level: CefrLevel;
  readonly mastery: number;
  readonly confidence: number;
}

export function buildSkillRadar(skills: readonly SkillRadarInput[]): SkillRadarEntry[] {
  return skills.map((skill) => {
    const mastery = clamp(skill.mastery, 0, 1);
    return {
      skill: skill.skill,
      level: skill.level,
      value: mastery,
      mastery,
      confidence: clamp(skill.confidence, 0, 1),
    };
  });
}

export const cefrTrendPointSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  level: cefrLevelSchema,
  value: z.number().min(1).max(5),
  lower: z.number().min(1).max(5),
  upper: z.number().min(1).max(5),
  confidence: z.number().min(0).max(1),
});

export type CefrTrendPoint = z.infer<typeof cefrTrendPointSchema>;

export interface CefrHistoryEntry {
  readonly overallLevel: CefrLevel | null;
  readonly confidence: number;
  readonly completedAt: string;
}

export function buildCefrTrend(
  history: readonly CefrHistoryEntry[],
  options: { readonly months?: number } = {},
): CefrTrendPoint[] {
  const byMonth = new Map<string, CefrHistoryEntry>();
  for (const entry of history) {
    if (!entry.overallLevel) continue;
    const month = entry.completedAt.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const current = byMonth.get(month);
    if (!current || current.completedAt < entry.completedAt) {
      byMonth.set(month, entry);
    }
  }
  const limit = Math.max(1, options.months ?? 6);
  return [...byMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-limit)
    .flatMap(([month, entry]) => {
      if (!entry.overallLevel) return [];
      const value = cefrRank(entry.overallLevel);
      const confidence = clamp(entry.confidence, 0, 1);
      const spread = 1 - confidence;
      return [
        {
          month,
          level: entry.overallLevel,
          value,
          lower: clamp(value - spread, 1, 5),
          upper: clamp(value + spread, 1, 5),
          confidence,
        },
      ];
    });
}

export const errorHeatmapEntrySchema = z.object({
  key: z.string().min(1),
  ruleId: z.string().nullable(),
  errorType: z.string().min(1),
  count: z.number().int().positive(),
  lastSeenAt: z.iso.datetime({ offset: false }),
});

export type ErrorHeatmapEntry = z.infer<typeof errorHeatmapEntrySchema>;

export interface ErrorHeatmapInput {
  readonly ruleId: string | null;
  readonly errorType: string;
  readonly createdAt: string;
}

export function buildErrorHeatmap(
  errors: readonly ErrorHeatmapInput[],
  options: { readonly limit?: number } = {},
): ErrorHeatmapEntry[] {
  const groups = new Map<string, ErrorHeatmapEntry>();
  for (const error of errors) {
    const key = error.ruleId ?? `type:${error.errorType}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        key,
        ruleId: error.ruleId,
        errorType: error.errorType,
        count: 1,
        lastSeenAt: error.createdAt,
      });
      continue;
    }
    groups.set(key, {
      ...current,
      count: current.count + 1,
      lastSeenAt: current.lastSeenAt < error.createdAt ? error.createdAt : current.lastSeenAt,
    });
  }
  const limit = Math.max(1, options.limit ?? 10);
  return [...groups.values()]
    .sort(
      (left, right) =>
        right.count - left.count || right.lastSeenAt.localeCompare(left.lastSeenAt),
    )
    .slice(0, limit);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
