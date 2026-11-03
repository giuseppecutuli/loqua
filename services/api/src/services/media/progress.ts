import { generateUuidV7 } from '@loqua/core';

import type {
  MediaProgressRecord,
  MediaProgressStatus,
} from '../../repos/media.js';
import {
  findApprovedTitle,
  requireProfile,
  type MediaServiceDeps,
} from './context.js';

export type ProgressStatus = Extract<
  MediaProgressStatus,
  'watching' | 'reading' | 'finished' | 'abandoned'
>;

export interface ProgressInput {
  readonly status: ProgressStatus;
  readonly progressPct: number;
}

export async function saveProgress(
  deps: MediaServiceDeps,
  userId: string,
  mediaId: string,
  input: ProgressInput,
): Promise<{ progress: MediaProgressRecord }> {
  const { profile } = await requireProfile(deps, userId);
  await findApprovedTitle(deps, profile.targetLang, mediaId);

  const now = deps.now();
  const timestamp = now.toISOString();
  const existing = await deps.media.getMediaProgress(profile.id, mediaId);
  const transitioningToFinished =
    input.status === 'finished' && existing?.status !== 'finished';

  const progress: MediaProgressRecord = {
    id: existing?.id ?? generateUuidV7(),
    userId,
    profileId: profile.id,
    mediaId,
    status: input.status,
    progressPct: input.progressPct,
    startedAt:
      existing?.startedAt ??
      (input.status === 'watching' || input.status === 'reading' || input.status === 'finished'
        ? timestamp
        : null),
    finishedAt: input.status === 'finished' ? (existing?.finishedAt ?? timestamp) : null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await deps.media.upsertMediaProgress(progress);

  if (transitioningToFinished) {
    await deps.sessions.addXpEvent({
      id: generateUuidV7(),
      userId,
      profileId: profile.id,
      amount: 40,
      reason: 'media_finished',
      sourceType: 'media',
      sourceId: mediaId,
      createdAt: timestamp,
    });
  }

  return { progress };
}

export async function listProgress(
  deps: MediaServiceDeps,
  userId: string,
): Promise<{ progress: readonly MediaProgressRecord[] }> {
  const { profile } = await requireProfile(deps, userId);
  return { progress: await deps.media.listMediaProgress(profile.id) };
}
