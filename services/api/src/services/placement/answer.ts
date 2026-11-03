import {
  isPlacementComplete,
  recordPlacementAnswer,
  selectNextPlacementItem,
  type AssessmentItem,
  type PlacementAnswer,
} from '@loqua/core';

import { toPublicItem } from '../../items.js';
import type { PlacementRecord } from '../../repos/assessment.js';
import { beginWriting, completePlacement } from './completion.js';
import type { PlacementRoutesDeps } from './deps.js';
import { failure, success, type PlacementOutcome } from './result.js';
import { progress } from './view.js';

export async function answerPlacement(
  deps: PlacementRoutesDeps,
  userId: string,
  assessmentId: string,
  itemId: string,
  optionId: string,
): Promise<PlacementOutcome<PlacementAnswer>> {
  const record = await deps.assessments.getAssessment(userId, assessmentId);
  if (!record) {
    return failure(404, 'not_found', 'Assessment not found');
  }
  if (record.status !== 'in_progress') {
    return failure(409, 'assessment_finished', 'Assessment is already finished');
  }
  if (record.raw.stage === 'writing') {
    return failure(409, 'writing_required', 'Submit the writing task first');
  }
  if (record.raw.stage === 'speaking') {
    return failure(409, 'speaking_required', 'Submit the speaking task first');
  }

  const currentId = record.raw.currentItemId;
  if (!currentId || currentId !== itemId) {
    return failure(409, 'stale_item', 'This is not the current item');
  }
  const item = record.raw.items[currentId];
  if (!item) {
    return failure(409, 'assessment_incomplete', 'Assessment item is missing');
  }
  if (!item.options.some((option) => option.id === optionId)) {
    return failure(400, 'invalid_request', 'Unknown option');
  }

  const answeredAt = deps.now();
  const outcome = recordPlacementAnswer(record.raw.state, item, optionId, answeredAt);

  let next: AssessmentItem | null = null;
  if (!isPlacementComplete(outcome.state)) {
    const candidates = await deps.assessments.listApprovedItems(userId, record.targetLang);
    next = selectNextPlacementItem(outcome.state, candidates);
  }

  if (isPlacementComplete(outcome.state)) {
    const snapshot = await deps.account.getSnapshot(userId);
    if (!snapshot.profile) {
      return failure(409, 'profile_required', 'Complete onboarding first');
    }
    const updated: PlacementRecord = {
      ...record,
      raw: { ...record.raw, state: outcome.state, currentItemId: null },
    };
    const writing = await beginWriting(deps, updated, {
      correct: outcome.correct,
      correctOptionId: item.correctOptionId,
      explanation: item.explanation,
    });
    if (writing) return success(writing);
    return success(
      await completePlacement(
        deps,
        updated,
        {
          correct: outcome.correct,
          correctOptionId: item.correctOptionId,
          explanation: item.explanation,
        },
        answeredAt.toISOString(),
        snapshot.profile,
      ),
    );
  }

  if (next === null) {
    return failure(503, 'content_unavailable', 'No approved placement items');
  }

  const updated: PlacementRecord = {
    ...record,
    raw: {
      ...record.raw,
      state: outcome.state,
      items: { ...record.raw.items, [next.id]: next },
      currentItemId: next.id,
    },
  };
  await deps.assessments.updateAssessment(updated);

  return success({
    assessmentId: record.id,
    completed: false,
    stage: 'objective',
    feedback: {
      correct: outcome.correct,
      correctOptionId: item.correctOptionId,
      explanation: item.explanation,
    },
    item: toPublicItem(next),
    writingTask: null,
    speakingTask: null,
    result: null,
    progress: progress(updated),
  } satisfies PlacementAnswer);
}
