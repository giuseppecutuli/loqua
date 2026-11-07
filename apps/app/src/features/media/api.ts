import {
  mediaCandidateSchema,
  tasteProfileSchema,
  type MediaCandidate,
  type TasteProfile,
} from '@loqua/core';

import { booleanField, field, numberField, request, stringField, stringList } from '../../lib/http';
import type {
  MediaFeedbackInput,
  MediaGuideView,
  MediaPlanView,
  MediaProgressStatus,
  MediaProgressView,
  MediaReason,
  MediaRecommendationComponents,
  MediaRecommendationView,
  MediaReflectionInput,
  MediaReflectionView,
  MediaSavedPhrase,
  MediaTaste,
} from './types';

function parseMediaTaste(value: unknown): MediaTaste | null {
  if (value === null || value === undefined) return null;
  const parsed = tasteProfileSchema.safeParse(value);
  const profileId = stringField(value, 'profileId');
  const createdAt = stringField(value, 'createdAt');
  const updatedAt = stringField(value, 'updatedAt');
  if (!parsed.success || profileId === null || createdAt === null || updatedAt === null) {
    throw new Error('invalid_media_taste');
  }
  return { ...parsed.data, profileId, createdAt, updatedAt };
}

function parseMediaCandidate(value: unknown): MediaCandidate {
  const parsed = mediaCandidateSchema.safeParse(value);
  if (!parsed.success) throw new Error('invalid_media');
  return parsed.data;
}

function parseMediaReason(value: unknown): MediaReason {
  return {
    whyItFits: stringField(value, 'whyItFits') ?? '',
    levelNote: stringField(value, 'levelNote') ?? '',
    approach: stringField(value, 'approach') ?? '',
    phrasesToNotice: stringList(field(value, 'phrasesToNotice')),
  };
}

function parseMediaComponents(value: unknown): MediaRecommendationComponents {
  return {
    levelFit: numberField(value, 'levelFit') ?? 0,
    tasteMatch: numberField(value, 'tasteMatch') ?? 0,
    gapFit: numberField(value, 'gapFit') ?? 0,
    quality: numberField(value, 'quality') ?? 0,
    diversity: numberField(value, 'diversity') ?? 0,
    freshness: numberField(value, 'freshness') ?? 0,
  };
}

function parseMediaRecommendation(value: unknown): MediaRecommendationView {
  const recommendationId = stringField(value, 'recommendationId');
  if (recommendationId === null) throw new Error('invalid_media_recommendation');
  return {
    recommendationId,
    status: stringField(value, 'status') ?? 'shown',
    media: parseMediaCandidate(field(value, 'media')),
    score: numberField(value, 'score') ?? 0,
    components: parseMediaComponents(field(value, 'components')),
    reason: parseMediaReason(field(value, 'reason')),
  };
}

function isMediaProgressStatus(value: string): value is MediaProgressStatus {
  return (
    value === 'watching' || value === 'reading' || value === 'finished' || value === 'abandoned'
  );
}

function parseMediaProgress(value: unknown): MediaProgressView | null {
  if (value === null || value === undefined) return null;
  const id = stringField(value, 'id');
  const mediaId = stringField(value, 'mediaId');
  const rawStatus = stringField(value, 'status');
  const progressPct = numberField(value, 'progressPct');
  const createdAt = stringField(value, 'createdAt');
  const updatedAt = stringField(value, 'updatedAt');
  if (
    id === null ||
    mediaId === null ||
    rawStatus === null ||
    !isMediaProgressStatus(rawStatus) ||
    progressPct === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    throw new Error('invalid_media_progress');
  }
  return {
    id,
    mediaId,
    status: rawStatus,
    progressPct,
    startedAt: stringField(value, 'startedAt'),
    finishedAt: stringField(value, 'finishedAt'),
    createdAt,
    updatedAt,
  };
}

function parseMediaGuide(value: unknown): MediaGuideView {
  const mediaId = stringField(value, 'mediaId');
  const reflectionTask = stringField(value, 'reflectionTask');
  if (mediaId === null || reflectionTask === null) throw new Error('invalid_media_guide');
  return {
    mediaId,
    before: stringList(field(value, 'before')),
    during: stringList(field(value, 'during')),
    after: stringList(field(value, 'after')),
    targetConcepts: stringList(field(value, 'targetConcepts')),
    functionalPhrases: stringList(field(value, 'functionalPhrases')),
    comprehensionPrompts: stringList(field(value, 'comprehensionPrompts')),
    reflectionTask,
    spoilerFree: booleanField(value, 'spoilerFree') ?? true,
  };
}

function parseMediaPlan(value: unknown): MediaPlanView {
  const weeklyMinutes = numberField(value, 'weeklyMinutes');
  if (weeklyMinutes === null) throw new Error('invalid_media_plan');
  const focusValue = field(value, 'focus');
  return {
    weeklyMinutes,
    focus: focusValue === null || focusValue === undefined ? null : parseMediaCandidate(focusValue),
    nextStep: stringField(value, 'nextStep') ?? '',
  };
}

function parseMediaReflection(value: unknown): MediaReflectionView {
  const reflectionValue = field(value, 'reflection');
  const saved = field(value, 'savedPhrases');
  const savedPhrases: MediaSavedPhrase[] = Array.isArray(saved)
    ? saved.flatMap((entry) => {
        const id = stringField(entry, 'id');
        const text = stringField(entry, 'text');
        return id === null || text === null ? [] : [{ id, text }];
      })
    : [];
  return {
    reflection: {
      countsAsProduction: booleanField(reflectionValue, 'countsAsProduction') ?? false,
      praise: stringField(reflectionValue, 'praise') ?? undefined,
      nextFocus: stringList(field(reflectionValue, 'nextFocus')),
    },
    savedPhrases,
    xpAwarded: numberField(value, 'xpAwarded') ?? 0,
  };
}

function parseMediaSource(value: unknown): 'llm' | 'rule' {
  return stringField(value, 'source') === 'llm' ? 'llm' : 'rule';
}

export async function fetchMediaTaste(): Promise<MediaTaste | null> {
  const body: unknown = await (await request('/v1/media/taste')).json();
  return parseMediaTaste(field(body, 'taste'));
}

export async function saveMediaTaste(taste: TasteProfile): Promise<MediaTaste> {
  const body: unknown = await (
    await request('/v1/media/taste', { method: 'PUT', body: JSON.stringify({ taste }) })
  ).json();
  const parsed = parseMediaTaste(field(body, 'taste'));
  if (parsed === null) throw new Error('invalid_media_taste');
  return parsed;
}

export async function deleteMediaTaste(): Promise<boolean> {
  const body: unknown = await (await request('/v1/media/taste', { method: 'DELETE' })).json();
  return booleanField(body, 'deleted') ?? false;
}

export async function fetchMediaRecommendations(limit = 5): Promise<{
  readonly taste: MediaTaste | null;
  readonly recommendations: readonly MediaRecommendationView[];
}> {
  const body: unknown = await (
    await request(`/v1/media/recommendations?limit=${encodeURIComponent(limit)}`)
  ).json();
  const value = field(body, 'recommendations');
  if (!Array.isArray(value)) throw new Error('invalid_media_recommendations');
  return {
    taste: parseMediaTaste(field(body, 'taste')),
    recommendations: value.map(parseMediaRecommendation),
  };
}

export async function fetchMediaGuide(mediaId: string): Promise<{
  readonly guide: MediaGuideView;
  readonly source: 'llm' | 'rule';
  readonly progress: MediaProgressView | null;
}> {
  const body: unknown = await (
    await request(`/v1/media/${encodeURIComponent(mediaId)}/guide`, { method: 'POST' })
  ).json();
  return {
    guide: parseMediaGuide(field(body, 'guide')),
    source: parseMediaSource(body),
    progress: parseMediaProgress(field(body, 'progress')),
  };
}

export async function sendMediaFeedback(
  mediaId: string,
  input: MediaFeedbackInput,
): Promise<{
  readonly taste: MediaTaste;
  readonly progress: MediaProgressView | null;
  readonly status: string;
}> {
  const body: unknown = await (
    await request(`/v1/media/${encodeURIComponent(mediaId)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).json();
  const taste = parseMediaTaste(field(body, 'taste'));
  if (taste === null) throw new Error('invalid_media_taste');
  return {
    taste,
    progress: parseMediaProgress(field(body, 'progress')),
    status: stringField(body, 'status') ?? input.kind,
  };
}

export async function saveMediaProgress(
  mediaId: string,
  status: MediaProgressStatus,
  progressPct: number,
): Promise<MediaProgressView> {
  const body: unknown = await (
    await request(`/v1/media/${encodeURIComponent(mediaId)}/progress`, {
      method: 'POST',
      body: JSON.stringify({ status, progressPct }),
    })
  ).json();
  const parsed = parseMediaProgress(field(body, 'progress'));
  if (parsed === null) throw new Error('invalid_media_progress');
  return parsed;
}

export async function fetchMediaProgress(): Promise<readonly MediaProgressView[]> {
  const body: unknown = await (await request('/v1/media/progress')).json();
  const value = field(body, 'progress');
  if (!Array.isArray(value)) throw new Error('invalid_media_progress');
  return value.flatMap((entry) => {
    const parsed = parseMediaProgress(entry);
    return parsed === null ? [] : [parsed];
  });
}

export async function fetchMediaPlan(): Promise<MediaPlanView> {
  const body: unknown = await (await request('/v1/media/plan')).json();
  return parseMediaPlan(body);
}

export async function submitMediaReflection(
  mediaId: string,
  input: MediaReflectionInput,
): Promise<MediaReflectionView> {
  const body: unknown = await (
    await request(`/v1/media/${encodeURIComponent(mediaId)}/reflection`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).json();
  return parseMediaReflection(body);
}
