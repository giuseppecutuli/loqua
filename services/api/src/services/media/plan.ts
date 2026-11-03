import { getMediaTitle } from '@loqua/content';
import type { MediaCandidate } from '@loqua/core';

import {
  loadCandidates,
  requireProfile,
  type MediaServiceDeps,
} from './context.js';

export interface MediaPlan {
  readonly weeklyMinutes: number;
  readonly focus: MediaCandidate | null;
  readonly nextStep: string;
}

export async function getMediaPlan(
  deps: MediaServiceDeps,
  userId: string,
): Promise<MediaPlan> {
  const { profile } = await requireProfile(deps, userId);
  const taste = await deps.media.getTasteProfile(profile.id);
  const weeklyMinutes = taste?.weeklyMinutes ?? clamp(profile.dailyMinutes * 7, 30, 900);
  const region = taste?.region ?? 'IT';
  const now = deps.now();

  const candidates = await loadCandidates(deps, profile.targetLang, region, now);
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  const progress = await deps.media.listMediaProgress(profile.id);
  const active = progress
    .filter((record) => record.status === 'watching' || record.status === 'reading')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (active) {
    const focus = byId.get(active.mediaId) ?? null;
    const title = getMediaTitle(active.mediaId)?.title ?? active.mediaId;
    return {
      weeklyMinutes,
      focus,
      nextStep: `Continue "${title}" and note one phrase you want to reuse.`,
    };
  }

  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const records = await deps.media.listRecommendations(profile.id, since);
  const top = records.find(
    (record) =>
      record.status === 'shown' &&
      (record.expiresAt === null || Date.parse(record.expiresAt) > now.getTime()),
  );
  const focus = top ? (byId.get(top.mediaId) ?? null) : null;
  const title = top ? (getMediaTitle(top.mediaId)?.title ?? top.mediaId) : null;
  return {
    weeklyMinutes,
    focus,
    nextStep:
      title === null
        ? 'Save a media taste profile to get your next recommendation.'
        : `Start "${title}" with a session that fits your weekly time.`,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
