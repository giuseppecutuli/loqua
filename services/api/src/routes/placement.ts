import {
  PLACEMENT_TOTAL_TARGET,
  aggregateConceptEvidence,
  buildPlacementResult,
  createPlacementState,
  evaluatePlacementDecisions,
  generateUuidV7,
  isPlacementComplete,
  recordPlacementAnswer,
  selectNextPlacementItem,
  type AssessmentItem,
  type CefrLevel,
  type LearnerProfile,
  type PlacementAnswer,
  type PlacementItem,
  type PlacementResult,
  type PlacementStart,
  type PlacementState,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';
import type {
  AssessmentScoreRecord,
  AssessmentStore,
  ConceptStateRecord,
  LevelEventRecord,
  PlacementRecord,
  SkillStateRecord,
} from '../repos/assessment.js';

export interface PlacementRoutesDeps {
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly now: () => Date;
}

const answerSchema = z.object({
  itemId: z.string().min(1).max(120),
  optionId: z.string().min(1).max(40),
});

function toPlacementItem(item: AssessmentItem): PlacementItem {
  return {
    id: item.id,
    targetLang: item.targetLang,
    type: item.type,
    skill: item.skill,
    skillId: item.skillId,
    cefrLevel: item.cefrLevel,
    conceptId: item.conceptId,
    difficultyB: item.difficultyB,
    prompt: item.prompt,
    options: item.options,
  };
}

function sessionResponse(record: PlacementRecord, item: AssessmentItem): PlacementStart {
  return {
    assessmentId: record.id,
    status: record.status,
    item: toPlacementItem(item),
    progress: {
      answered: record.raw.state.responses.length,
      target: PLACEMENT_TOTAL_TARGET,
    },
  };
}

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
): SkillStateRecord[] {
  const skillIds = new Map<string, string>();
  for (const item of Object.values(record.raw.items)) {
    skillIds.set(item.skill, item.skillId);
  }

  return result.measured
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

async function finalizePlacement(
  deps: PlacementRoutesDeps,
  record: PlacementRecord,
  state: PlacementState,
  item: AssessmentItem,
  correct: boolean,
  timestamp: string,
  profile: LearnerProfile,
): Promise<PlacementAnswer> {
  const baseResult = buildPlacementResult(state);
  const { result, events } = buildDecisions(record, state, baseResult, timestamp);
  const completed: PlacementRecord = {
    ...record,
    status: 'completed',
    overallLevel: result.overallLevel,
    confidence: result.confidence,
    raw: { ...record.raw, state, currentItemId: null, result },
    completedAt: timestamp,
  };

  const scores: AssessmentScoreRecord[] = result.measured
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

  await deps.assessments.completeAssessment({
    assessment: completed,
    scores,
    levelEvents: events,
    skills: buildSkillStates(record, result, timestamp),
    concepts: buildConceptStates(record, state, timestamp),
  });
  await deps.account.upsertProfile({
    ...profile,
    proficiencyEstimate: result.overallLevel,
    updatedAt: timestamp,
  });

  return {
    assessmentId: record.id,
    completed: true,
    feedback: {
      correct,
      correctOptionId: item.correctOptionId,
      explanation: item.explanation,
    },
    item: null,
    result,
    progress: {
      answered: state.responses.length,
      target: PLACEMENT_TOTAL_TARGET,
    },
  };
}

export function createPlacementRoutes(deps: PlacementRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post('/placement/start', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    const profile = snapshot.profile;
    if (!profile || !profile.onboardingCompleted) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }

    const active = await deps.assessments.findActivePlacement(user.id, profile.id);
    if (active) {
      const currentId = active.raw.currentItemId;
      const item = currentId ? active.raw.items[currentId] : undefined;
      if (!item) {
        return c.json(
          errorResponse('assessment_incomplete', 'Assessment has no current item'),
          409,
        );
      }
      return c.json(sessionResponse(active, item));
    }

    const candidates = await deps.assessments.listApprovedItems(user.id, profile.targetLang);
    if (candidates.length === 0) {
      return c.json(errorResponse('content_unavailable', 'No approved placement items'), 503);
    }

    const state = createPlacementState({
      targetLang: profile.targetLang,
      selfAssessment: profile.selfAssessment,
      now: deps.now(),
    });
    const first = selectNextPlacementItem(state, candidates);
    if (!first) {
      return c.json(errorResponse('content_unavailable', 'No approved placement items'), 503);
    }

    const timestamp = deps.now().toISOString();
    const record: PlacementRecord = {
      id: generateUuidV7(),
      userId: user.id,
      profileId: profile.id,
      targetLang: profile.targetLang,
      status: 'in_progress',
      overallLevel: null,
      confidence: null,
      raw: {
        state,
        items: { [first.id]: first },
        currentItemId: first.id,
      },
      createdAt: timestamp,
      completedAt: null,
    };
    await deps.assessments.createAssessment(record);
    return c.json(sessionResponse(record, first), 201);
  });

  app.post('/:id/answer', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid answer payload'), 400);
    }

    const record = await deps.assessments.getAssessment(user.id, c.req.param('id'));
    if (!record) {
      return c.json(errorResponse('not_found', 'Assessment not found'), 404);
    }
    if (record.status !== 'in_progress') {
      return c.json(errorResponse('assessment_finished', 'Assessment is already finished'), 409);
    }

    const currentId = record.raw.currentItemId;
    if (!currentId || currentId !== parsed.data.itemId) {
      return c.json(errorResponse('stale_item', 'This is not the current item'), 409);
    }
    const item = record.raw.items[currentId];
    if (!item) {
      return c.json(errorResponse('assessment_incomplete', 'Assessment item is missing'), 409);
    }
    if (!item.options.some((option) => option.id === parsed.data.optionId)) {
      return c.json(errorResponse('invalid_request', 'Unknown option'), 400);
    }

    const answeredAt = deps.now();
    const outcome = recordPlacementAnswer(record.raw.state, item, parsed.data.optionId, answeredAt);

    let next: AssessmentItem | null = null;
    if (!isPlacementComplete(outcome.state)) {
      const candidates = await deps.assessments.listApprovedItems(user.id, record.targetLang);
      next = selectNextPlacementItem(outcome.state, candidates);
    }

    if (isPlacementComplete(outcome.state) || next === null) {
      const snapshot = await deps.account.getSnapshot(user.id);
      if (!snapshot.profile) {
        return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
      }
      return c.json(
        await finalizePlacement(
          deps,
          record,
          outcome.state,
          item,
          outcome.correct,
          answeredAt.toISOString(),
          snapshot.profile,
        ),
      );
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

    return c.json({
      assessmentId: record.id,
      completed: false,
      feedback: {
        correct: outcome.correct,
        correctOptionId: item.correctOptionId,
        explanation: item.explanation,
      },
      item: toPlacementItem(next),
      result: null,
      progress: {
        answered: outcome.state.responses.length,
        target: PLACEMENT_TOTAL_TARGET,
      },
    } satisfies PlacementAnswer);
  });

  return app;
}
