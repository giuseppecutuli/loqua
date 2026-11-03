import { z } from 'zod';

import { cefrTrendPointSchema, skillRadarEntrySchema } from './progress-views.js';
import { cefrLevelSchema, skillDomainSchema } from './schemas.js';

export const LEVEL_EVENT_REASONS = [
  'placement',
  'test_out',
  'promotion',
  'remediation',
  'challenge_pass',
  'challenge_fail',
] as const;

export const skillProgressSchema = z.object({
  skill: skillDomainSchema,
  level: cefrLevelSchema,
  range: z.string().min(1),
  confidence: z.number().min(0).max(1),
  theta: z.number().finite(),
  se: z.number().positive(),
  mastery: z.number().min(0).max(1),
  nObs: z.number().int().nonnegative(),
  lastSeenAt: z.iso.datetime({ offset: false }).nullable(),
});

export const levelEventSummarySchema = z.object({
  id: z.string().min(1),
  reason: z.enum(LEVEL_EVENT_REASONS),
  fromLevel: cefrLevelSchema.nullable(),
  toLevel: cefrLevelSchema.nullable(),
  skill: skillDomainSchema.nullable(),
  createdAt: z.iso.datetime({ offset: false }),
});

export const progressPrioritySchema = z.object({
  skill: skillDomainSchema,
  level: cefrLevelSchema,
  theta: z.number().finite(),
});

export const progressSummarySchema = z.object({
  overallLevel: cefrLevelSchema.nullable(),
  overallRange: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  latestAssessmentAt: z.iso.datetime({ offset: false }).nullable(),
  skills: z.array(skillProgressSchema),
  skillRadar: z.array(skillRadarEntrySchema),
  cefrTrend: z.array(cefrTrendPointSchema),
  events: z.array(levelEventSummarySchema),
  priorities: z.array(progressPrioritySchema),
});

export type SkillProgress = z.infer<typeof skillProgressSchema>;
export type LevelEventSummary = z.infer<typeof levelEventSummarySchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
