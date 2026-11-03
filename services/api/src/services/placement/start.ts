import { getPlacementSpeakingTask } from '@loqua/content';
import {
  createPlacementState,
  generateUuidV7,
  isPlacementItem,
  selectNextPlacementItem,
  type PlacementStart,
} from '@loqua/core';

import type { PlacementRecord } from '../../repos/assessment.js';
import type { PlacementRoutesDeps } from './deps.js';
import { failure, success, type PlacementOutcome } from './result.js';
import { objectiveSession, speakingSession, writingSession } from './view.js';

export async function startPlacement(
  deps: PlacementRoutesDeps,
  userId: string,
): Promise<PlacementOutcome<PlacementStart>> {
  const snapshot = await deps.account.getSnapshot(userId);
  const profile = snapshot.profile;
  if (!profile || !profile.onboardingCompleted) {
    return failure(409, 'profile_required', 'Complete onboarding first');
  }

  const active = await deps.assessments.findActivePlacement(userId, profile.id);
  if (active) {
    if (active.raw.stage === 'writing' && active.raw.writingTask) {
      return success(writingSession(active, active.raw.writingTask));
    }
    if (active.raw.stage === 'speaking') {
      const task = getPlacementSpeakingTask(active.targetLang, active.raw.speakingIndex ?? 0);
      if (!task) {
        return failure(409, 'assessment_incomplete', 'Speaking task is missing');
      }
      return success(speakingSession(active, task));
    }
    const currentId = active.raw.currentItemId;
    const item = currentId ? active.raw.items[currentId] : undefined;
    if (!item || !isPlacementItem(item)) {
      const candidates = await deps.assessments.listApprovedItems(userId, profile.targetLang);
      const next = selectNextPlacementItem(active.raw.state, candidates);
      if (!next) {
        return failure(503, 'content_unavailable', 'No approved placement items');
      }
      const repaired: PlacementRecord = {
        ...active,
        raw: {
          ...active.raw,
          items: { ...active.raw.items, [next.id]: next },
          currentItemId: next.id,
        },
      };
      await deps.assessments.updateAssessment(repaired);
      return success(objectiveSession(repaired, next));
    }
    return success(objectiveSession(active, item));
  }

  const candidates = await deps.assessments.listApprovedItems(userId, profile.targetLang);
  if (candidates.length === 0) {
    return failure(503, 'content_unavailable', 'No approved placement items');
  }

  const state = createPlacementState({
    targetLang: profile.targetLang,
    selfAssessment: profile.selfAssessment,
    now: deps.now(),
  });
  const first = selectNextPlacementItem(state, candidates);
  if (!first) {
    return failure(503, 'content_unavailable', 'No approved placement items');
  }

  const timestamp = deps.now().toISOString();
  const record: PlacementRecord = {
    id: generateUuidV7(),
    userId,
    profileId: profile.id,
    targetLang: profile.targetLang,
    status: 'in_progress',
    overallLevel: null,
    confidence: null,
    raw: {
      state,
      items: { [first.id]: first },
      currentItemId: first.id,
      stage: 'objective',
    },
    createdAt: timestamp,
    completedAt: null,
  };
  await deps.assessments.createAssessment(record);
  return success(objectiveSession(record, first), 201);
}
