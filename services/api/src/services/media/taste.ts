import type { TasteProfile } from '@loqua/core';

import type { TasteProfileRecord } from '../../repos/media.js';
import {
  requireProfile,
  type MediaServiceDeps,
} from './context.js';

export async function getTaste(
  deps: MediaServiceDeps,
  userId: string,
): Promise<{ taste: TasteProfileRecord | null }> {
  const { profile } = await requireProfile(deps, userId);
  return { taste: await deps.media.getTasteProfile(profile.id) };
}

export async function saveTaste(
  deps: MediaServiceDeps,
  userId: string,
  input: TasteProfile,
): Promise<{ taste: TasteProfileRecord }> {
  const { profile } = await requireProfile(deps, userId);
  const existing = await deps.media.getTasteProfile(profile.id);
  const now = deps.now().toISOString();

  const record: TasteProfileRecord = {
    profileId: profile.id,
    formats: [...input.formats],
    genres: [...input.genres],
    themes: [...input.themes],
    disliked: [...input.disliked],
    genreWeights: existing
      ? { ...existing.genreWeights }
      : weightsFor(input.genres),
    themeWeights: existing
      ? { ...existing.themeWeights }
      : weightsFor(input.themes),
    difficultyTolerance: input.difficultyTolerance,
    subtitlePref: input.subtitlePref,
    accents: [...input.accents],
    region: input.region,
    weeklyMinutes: input.weeklyMinutes,
    maxAgeRating: input.maxAgeRating ?? null,
    coverageOffset: input.coverageOffset ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await deps.media.upsertTasteProfile(record);
  return { taste: record };
}

export async function deleteTaste(
  deps: MediaServiceDeps,
  userId: string,
): Promise<{ deleted: boolean }> {
  const { profile } = await requireProfile(deps, userId);
  return { deleted: await deps.media.deleteTasteProfile(profile.id) };
}

function weightsFor(tags: readonly string[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const tag of tags) {
    const key = tag.trim().toLowerCase();
    if (key.length > 0) weights[key] = 1;
  }
  return weights;
}
