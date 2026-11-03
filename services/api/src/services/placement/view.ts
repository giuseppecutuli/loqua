import {
  PLACEMENT_TOTAL_TARGET,
  type AssessmentItem,
  type PlacementStart,
  type SpeakingTask,
  type WritingTask,
} from '@loqua/core';

import { toPublicItem } from '../../items.js';
import type { PlacementRecord } from '../../repos/assessment.js';

export function progress(record: PlacementRecord): PlacementStart['progress'] {
  return {
    answered: record.raw.state.responses.length,
    target: PLACEMENT_TOTAL_TARGET,
  };
}

export function objectiveSession(record: PlacementRecord, item: AssessmentItem): PlacementStart {
  return {
    assessmentId: record.id,
    status: record.status,
    stage: 'objective',
    item: toPublicItem(item),
    writingTask: null,
    speakingTask: null,
    progress: progress(record),
  };
}

export function writingSession(record: PlacementRecord, task: WritingTask): PlacementStart {
  return {
    assessmentId: record.id,
    status: record.status,
    stage: 'writing',
    item: null,
    writingTask: task,
    speakingTask: null,
    progress: progress(record),
  };
}

export function speakingSession(record: PlacementRecord, task: SpeakingTask): PlacementStart {
  return {
    assessmentId: record.id,
    status: record.status,
    stage: 'speaking',
    item: null,
    writingTask: null,
    speakingTask: task,
    progress: progress(record),
  };
}
