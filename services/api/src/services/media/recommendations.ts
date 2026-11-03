import {
  deterministicExplanation,
  generateUuidV7,
  rankMedia,
  type MediaCandidate,
  type RankMediaRequest,
  type ScoredRecommendation,
} from '@loqua/core';

import type {
  RecommendationRecord,
  RecommendationStatus,
  TasteProfileRecord,
} from '../../repos/media.js';
import {
  loadCandidates,
  loadHistory,
  loadWeakConcepts,
  requireProfile,
  resolveLevel,
  seedFor,
  toTaste,
  type DeterministicExplanation,
  type MediaServiceDeps,
} from './context.js';

export interface RecommendationView {
  readonly recommendationId: string;
  readonly status: RecommendationStatus;
  readonly media: MediaCandidate;
  readonly score: number;
  readonly components: ScoredRecommendation['components'];
  readonly reason: DeterministicExplanation;
}

export interface RecommendationList {
  readonly taste: TasteProfileRecord | null;
  readonly recommendations: RecommendationView[];
}

export async function listRecommendations(
  deps: MediaServiceDeps,
  userId: string,
  limit: number,
): Promise<RecommendationList> {
  const { profile } = await requireProfile(deps, userId);
  const tasteRecord = await deps.media.getTasteProfile(profile.id);
  if (!tasteRecord) {
    return { taste: null, recommendations: [] };
  }

  const taste = toTaste(tasteRecord);
  const now = deps.now();
  const level = await resolveLevel(deps, userId, profile);
  const { weakConcepts, recentErrorTypes } = await loadWeakConcepts(deps, userId);
  const { history } = await loadHistory(deps, profile.id, profile.timezone);
  const candidates = await loadCandidates(deps, profile.targetLang, taste.region, now);

  const request: RankMediaRequest = {
    targetLang: profile.targetLang,
    level,
    tastes: taste,
    weakConcepts,
    recentErrorTypes,
    region: taste.region,
    weeklyMinutes: taste.weeklyMinutes,
    history,
    limit,
    seed: seedFor(profile.id, now, profile.timezone),
  };

  const scored = rankMedia(candidates, request);
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const persisted: RecommendationRecord[] = [];
  const views: RecommendationView[] = [];
  for (const item of scored) {
    const reason = deterministicExplanation(item.media, request);
    const record: RecommendationRecord = {
      id: generateUuidV7(),
      userId,
      profileId: profile.id,
      mediaId: item.media.id,
      score: item.score,
      scoreJson: { components: item.components, reason },
      reasonText: reason.whyItFits,
      source: 'rule',
      status: 'shown',
      createdAt,
      expiresAt,
    };
    persisted.push(record);
    views.push({
      recommendationId: record.id,
      status: record.status,
      media: item.media,
      score: item.score,
      components: item.components,
      reason,
    });
  }

  await deps.media.insertRecommendations(persisted);
  return { taste: tasteRecord, recommendations: views };
}
