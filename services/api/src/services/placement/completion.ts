import { getPlacementSpeakingTasks, getPlacementWritingTask } from '@loqua/content';
import {
  aggregateConceptEvidence,
  applyWritingToResult,
  buildPlacementResult,
  evaluatePlacementDecisions,
  generateUuidV7,
  type CefrLevel,
  type LearnerProfile,
  type PlacementAnswer,
  type PlacementResult,
  type PlacementState,
  type SpeakingTask,
  type WritingEvaluation,
  type WritingTask,
} from '@loqua/core';

import type {
  AssessmentScoreRecord,
  ConceptStateRecord,
  LevelEventRecord,
  PlacementRecord,
  SkillStateRecord,
} from '../../repos/assessment.js';
import type { PlacementRoutesDeps } from './deps.js';
import { progress } from './view.js';

function levelEvent(
  record: PlacementRecord,
  reason: LevelEventRecord['reason'],
  fromLevel: LevelEventRecord['fromLevel'],
  toLevel: LevelEventRecord['toLevel'],
  detail: Record<string, unknown>,
  timestamp: string,
  skillId: string | null = null,
): LevelEventRecord {
  return {
    id: generateUuidV7(),
    userId: record.userId,
    profileId: record.profileId,
    skillId,
    fromLevel,
    toLevel,
    reason,
    detail,
    createdAt: timestamp,
  };
}

function buildSkillStates(
  record: PlacementRecord,
  result: PlacementResult,
  timestamp: string,
  writingTask?: WritingTask,
  speakingTask?: SpeakingTask,
): SkillStateRecord[] {
  const skillIds = new Map<string, string>();
  for (const item of Object.values(record.raw.items)) {
    skillIds.set(item.skill, item.skillId);
  }

  const states: SkillStateRecord[] = result.measured
    .filter((entry) => entry.measured)
    .flatMap((entry) => {
      const skillId = skillIds.get(entry.skill);
      if (!skillId) return [];
      return [
        {
          userId: record.userId,
          skillId,
          theta: entry.theta,
          se: entry.se,
          nObs: entry.nObs,
          mastery: entry.score,
          lastSeenAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ];
    });

  if (result.speaking && speakingTask) {
    states.push({
      userId: record.userId,
      skillId: speakingTask.skillId,
      theta: result.speaking.theta,
      se: result.speaking.se,
      nObs: result.speaking.nObs,
      mastery: result.speaking.score,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  if (result.writing && writingTask) {
    states.push({
      userId: record.userId,
      skillId: writingTask.skillId,
      theta: result.writing.theta,
      se: result.writing.se,
      nObs: result.writing.nObs,
      mastery: result.writing.score,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return states;
}

function buildDecisions(
  record: PlacementRecord,
  state: PlacementState,
  result: PlacementResult,
  timestamp: string,
): { readonly result: PlacementResult; readonly events: readonly LevelEventRecord[] } {
  const decisions = evaluatePlacementDecisions(state, result);
  const withDecisions: PlacementResult = {
    ...result,
    decisions: {
      testOutConcepts: [...decisions.testOutConcepts],
      remediationSkills: decisions.remediationSkills.map((entry) => ({
        ...entry,
        concepts: [...entry.concepts],
      })),
      challengeLevel: decisions.challengeLevel,
    },
  };
  const events: LevelEventRecord[] = [
    levelEvent(
      record,
      'placement',
      null,
      result.overallLevel,
      {
        overallTheta: result.overallTheta,
        overallRange: result.overallRange,
        confidence: result.confidence,
        priorities: result.priorities,
        ...(result.writing ? { writing: result.writing } : {}),
        ...(result.speaking ? { speaking: result.speaking } : {}),
      },
      timestamp,
    ),
  ];

  const measuredLevels = new Map<string, CefrLevel>();
  for (const entry of result.measured) {
    if (entry.measured && entry.level) measuredLevels.set(entry.skill, entry.level);
  }
  const skillIds = new Map<string, string>();
  for (const item of Object.values(record.raw.items)) {
    skillIds.set(item.skill, item.skillId);
  }

  for (const remediation of decisions.remediationSkills) {
    const skillId = skillIds.get(remediation.skill);
    if (!skillId) continue;
    events.push(
      levelEvent(
        record,
        'remediation',
        result.overallLevel,
        remediation.level,
        {
          gap: remediation.gap,
          concepts: remediation.concepts.map((concept) => concept.conceptId),
        },
        timestamp,
        skillId,
      ),
    );
  }

  const testOutBySkill = new Map<string, string[]>();
  for (const concept of decisions.testOutConcepts) {
    const concepts = testOutBySkill.get(concept.skill) ?? [];
    concepts.push(concept.conceptId);
    testOutBySkill.set(concept.skill, concepts);
  }
  for (const [skill, concepts] of testOutBySkill) {
    const skillId = skillIds.get(skill);
    if (!skillId) continue;
    events.push(
      levelEvent(
        record,
        'test_out',
        result.overallLevel,
        measuredLevels.get(skill) ?? result.overallLevel,
        { concepts, count: concepts.length },
        timestamp,
        skillId,
      ),
    );
  }

  return { result: withDecisions, events };
}

function buildConceptStates(
  record: PlacementRecord,
  state: PlacementState,
  timestamp: string,
): ConceptStateRecord[] {
  return aggregateConceptEvidence(state).map((concept) => ({
    userId: record.userId,
    conceptId: concept.conceptId,
    mastery: concept.mastery,
    evidenceCount: concept.nObs,
    lastSeenAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

export interface WritingSubmission {
  readonly evaluation: WritingEvaluation;
  readonly text: string;
  readonly passes: number;
}

export async function completePlacement(
  deps: PlacementRoutesDeps,
  record: PlacementRecord,
  feedback: PlacementAnswer['feedback'],
  timestamp: string,
  profile: LearnerProfile,
  writing?: WritingSubmission,
  resultOverride?: PlacementResult,
): Promise<PlacementAnswer> {
  const state = record.raw.state;
  const baseResult = buildPlacementResult(state);
  const result =
    resultOverride ??
    (writing ? applyWritingToResult(baseResult, writing.evaluation, writing.passes) : baseResult);
  const { result: finalResult, events } = buildDecisions(record, state, result, timestamp);
  const completed: PlacementRecord = {
    ...record,
    status: 'completed',
    overallLevel: finalResult.overallLevel,
    confidence: finalResult.confidence,
    raw: {
      ...record.raw,
      stage: 'completed',
      currentItemId: null,
      result: finalResult,
      ...(writing ? { writingText: writing.text, writingEvaluation: writing.evaluation } : {}),
    },
    completedAt: timestamp,
  };

  const scores: AssessmentScoreRecord[] = finalResult.measured
    .filter((entry) => entry.measured)
    .map((entry) => ({
      id: generateUuidV7(),
      assessmentId: record.id,
      dimension: entry.skill,
      score: entry.score,
      confidence: entry.confidence,
      notes: entry.range,
      createdAt: timestamp,
    }));
  if (finalResult.writing) {
    scores.push({
      id: generateUuidV7(),
      assessmentId: record.id,
      dimension: 'writing',
      score: finalResult.writing.score,
      confidence: finalResult.writing.confidence,
      notes: finalResult.writing.range,
      createdAt: timestamp,
    });
  }
  if (finalResult.speaking) {
    scores.push({
      id: generateUuidV7(),
      assessmentId: record.id,
      dimension: 'speaking',
      score: finalResult.speaking.score,
      confidence: finalResult.speaking.confidence,
      notes: finalResult.speaking.range,
      createdAt: timestamp,
    });
  }

  await deps.assessments.completeAssessment({
    assessment: completed,
    scores,
    levelEvents: events,
    skills: buildSkillStates(
      record,
      finalResult,
      timestamp,
      record.raw.writingTask,
      record.raw.speakingTask,
    ),
    concepts: buildConceptStates(record, state, timestamp),
  });
  await deps.account.upsertProfile({
    ...profile,
    proficiencyEstimate: finalResult.overallLevel,
    updatedAt: timestamp,
  });

  return {
    assessmentId: record.id,
    completed: true,
    stage: 'completed',
    feedback,
    item: null,
    writingTask: null,
    speakingTask: null,
    result: finalResult,
    progress: progress(record),
  };
}

export async function beginWriting(
  deps: PlacementRoutesDeps,
  record: PlacementRecord,
  feedback: PlacementAnswer['feedback'],
): Promise<PlacementAnswer | null> {
  const task = record.raw.writingTask ?? getPlacementWritingTask(record.targetLang);
  if (!task) return null;

  const updated: PlacementRecord = {
    ...record,
    raw: {
      ...record.raw,
      stage: 'writing',
      currentItemId: null,
      writingTask: task,
    },
  };
  await deps.assessments.updateAssessment(updated);
  return {
    assessmentId: record.id,
    completed: false,
    stage: 'writing',
    feedback,
    item: null,
    writingTask: task,
    speakingTask: null,
    result: null,
    progress: progress(record),
  };
}

export async function beginSpeaking(
  deps: PlacementRoutesDeps,
  record: PlacementRecord,
  interimResult: PlacementResult,
  feedback: PlacementAnswer['feedback'],
): Promise<PlacementAnswer | null> {
  const tasks = getPlacementSpeakingTasks(record.targetLang);
  const index = record.raw.speakingIndex ?? 0;
  const task = tasks[index];
  if (!task) return null;

  const updated: PlacementRecord = {
    ...record,
    raw: {
      ...record.raw,
      stage: 'speaking',
      currentItemId: null,
      result: interimResult,
      speakingTask: task,
      speakingIndex: index,
      speakingEvaluations: record.raw.speakingEvaluations ?? [],
      speakingTranscripts: record.raw.speakingTranscripts ?? [],
    },
  };
  await deps.assessments.updateAssessment(updated);
  return {
    assessmentId: record.id,
    completed: false,
    stage: 'speaking',
    feedback,
    item: null,
    writingTask: null,
    speakingTask: task,
    result: null,
    progress: progress(record),
  };
}
