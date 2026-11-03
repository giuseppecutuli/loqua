import {
  generateUuidV7,
  updateTaste,
  type MediaFeedback,
} from '@loqua/core';

import type {
  MediaProgressRecord,
  MediaProgressStatus,
  RecommendationFeedbackRecord,
  RecommendationStatus,
  TasteProfileRecord,
} from '../../repos/media.js';
import {
  buildCandidate,
  findApprovedTitle,
  MediaError,
  requireProfile,
  toTaste,
  type MediaServiceDeps,
} from './context.js';

export type FeedbackInput = MediaFeedback & {
  readonly recommendationId?: string;
};

export interface FeedbackResult {
  readonly taste: TasteProfileRecord;
  readonly progress: MediaProgressRecord | null;
  readonly status: RecommendationStatus;
}

export async function recordFeedback(
  deps: MediaServiceDeps,
  userId: string,
  mediaId: string,
  input: FeedbackInput,
): Promise<FeedbackResult> {
  const { profile } = await requireProfile(deps, userId);
  const tasteRecord = await deps.media.getTasteProfile(profile.id);
  if (!tasteRecord) {
    throw new MediaError(409, 'taste_required', 'Save a taste profile first');
  }

  const title = await findApprovedTitle(deps, profile.targetLang, mediaId);
  const rows = await deps.media.listAvailability([mediaId], tasteRecord.region);
  const now = deps.now();
  const candidate = buildCandidate(title, rows, tasteRecord.region, now);
  if (!candidate) {
    throw new MediaError(500, 'media_candidate_unavailable', 'Media candidate unavailable');
  }

  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const recommendations = await deps.media.listRecommendations(profile.id, since);
  const latest = input.recommendationId
    ? (recommendations.find((record) => record.id === input.recommendationId) ??
      recommendations.find((record) => record.mediaId === mediaId))
    : recommendations.find((record) => record.mediaId === mediaId);
  const recommendationId = input.recommendationId ?? latest?.id ?? null;
  const status: RecommendationStatus = input.kind;

  if (recommendationId) {
    await deps.media.updateRecommendationStatus(userId, recommendationId, status);
    const feedback: RecommendationFeedbackRecord = {
      id: generateUuidV7(),
      recommendationId,
      userId,
      rating: input.rating ?? null,
      reasonCode: input.reasonCode ?? null,
      difficultyFeedback: input.difficulty ?? null,
      createdAt: now.toISOString(),
    };
    await deps.media.upsertRecommendationFeedback(feedback);
  }

  const updatedTaste = updateTaste(toTaste(tasteRecord), input, candidate);
  const taste: TasteProfileRecord = {
    profileId: profile.id,
    ...updatedTaste,
    maxAgeRating: updatedTaste.maxAgeRating ?? null,
    createdAt: tasteRecord.createdAt,
    updatedAt: now.toISOString(),
  };
  await deps.media.upsertTasteProfile(taste);

  const existing = await deps.media.getMediaProgress(profile.id, mediaId);
  let progress: MediaProgressRecord | null = existing;
  if (input.kind === 'started') {
    progress = makeProgress(
      userId,
      profile.id,
      mediaId,
      candidate.kind === 'book' ? 'reading' : 'watching',
      existing?.progressPct ?? 0,
      existing?.startedAt ?? now.toISOString(),
      existing?.finishedAt ?? null,
      existing,
      now,
    );
    await deps.media.upsertMediaProgress(progress);
  } else if (input.kind === 'finished') {
    progress = makeProgress(
      userId,
      profile.id,
      mediaId,
      'finished',
      100,
      existing?.startedAt ?? now.toISOString(),
      existing?.finishedAt ?? now.toISOString(),
      existing,
      now,
    );
    await deps.media.upsertMediaProgress(progress);
    await deps.sessions.addXpEvent({
      id: generateUuidV7(),
      userId,
      profileId: profile.id,
      amount: 40,
      reason: 'media_finished',
      sourceType: 'media',
      sourceId: mediaId,
      createdAt: now.toISOString(),
    });
  } else if (input.kind === 'abandoned') {
    progress = makeProgress(
      userId,
      profile.id,
      mediaId,
      'abandoned',
      existing?.progressPct ?? 0,
      existing?.startedAt ?? null,
      existing?.finishedAt ?? null,
      existing,
      now,
    );
    await deps.media.upsertMediaProgress(progress);
  }

  return { taste, progress, status };
}

function makeProgress(
  userId: string,
  profileId: string,
  mediaId: string,
  status: MediaProgressStatus,
  progressPct: number,
  startedAt: string | null,
  finishedAt: string | null,
  existing: MediaProgressRecord | null,
  now: Date,
): MediaProgressRecord {
  return {
    id: existing?.id ?? generateUuidV7(),
    userId,
    profileId,
    mediaId,
    status,
    progressPct,
    startedAt,
    finishedAt,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
