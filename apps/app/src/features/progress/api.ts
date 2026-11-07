import {
  curriculumPlanSchema,
  gamificationSnapshotSchema,
  progressSummarySchema,
  weekInsightsSchema,
  type CurriculumPlan,
  type GamificationSnapshot,
  type ProgressSummary,
  type WeekInsights,
} from '@loqua/core';

import { parseEnvelope, request } from '../../lib/http';

export async function fetchGamification(): Promise<GamificationSnapshot> {
  const body: unknown = await (await request('/v1/gamification')).json();
  return parseEnvelope(body, 'gamification', gamificationSnapshotSchema, 'invalid_gamification');
}

export async function fetchCurriculumPlan(): Promise<CurriculumPlan> {
  const body: unknown = await (await request('/v1/curriculum')).json();
  return parseEnvelope(body, 'plan', curriculumPlanSchema, 'invalid_curriculum');
}

export async function fetchInsights(): Promise<WeekInsights> {
  const body: unknown = await (await request('/v1/insights')).json();
  return parseEnvelope(body, 'insights', weekInsightsSchema, 'invalid_insights');
}

export async function fetchProgress(): Promise<ProgressSummary> {
  const body: unknown = await (await request('/v1/progress')).json();
  return parseEnvelope(body, 'progress', progressSummarySchema, 'invalid_progress');
}
