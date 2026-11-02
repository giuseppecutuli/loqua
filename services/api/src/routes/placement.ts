import {
  AiGatewayError,
  assessmentEvaluationSchema,
  type AiGateway,
  type AssessmentEvaluation,
} from '@loqua/ai';
import {
  RULES,
  getPlacementSpeakingTask,
  getPlacementSpeakingTasks,
  getPlacementWritingTask,
} from '@loqua/content';
import {
  PLACEMENT_TOTAL_TARGET,
  aggregateConceptEvidence,
  applySpeakingToResult,
  applyWritingToResult,
  buildPlacementResult,
  canProcessAi,
  canUseVoice,
  createPlacementState,
  evaluatePlacementDecisions,
  generateUuidV7,
  isPlacementComplete,
  isPlacementItem,
  mergeWritingEvaluations,
  recordPlacementAnswer,
  selectNextPlacementItem,
  validateWritingResponse,
  type AssessmentItem,
  type CefrLevel,
  type LearnerProfile,
  type PlacementAnswer,
  type PlacementResult,
  type PlacementStart,
  type PlacementState,
  type SpeakingTask,
  type WritingEvaluation,
  type WritingTask,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import { aiErrorStatus } from '../http/ai-error.js';
import { toPublicItem } from '../items.js';
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
  readonly ai: AiGateway;
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly transcribe?: (
    audio: Uint8Array,
    languageCode?: string,
  ) => Promise<{ text: string; durationSec: number; languageCode: string | null }>;
  readonly now: () => Date;
}

const answerSchema = z.object({
  itemId: z.string().min(1).max(120),
  optionId: z.string().min(1).max(40),
});

const writingSchema = z.object({
  text: z.string().min(1).max(6000),
});

const speakingSchema = z.object({
  taskId: z.string().min(1).max(120),
  audioBase64: z.string().min(1).max(8_000_000),
  durationSec: z.number().positive().max(120),
});

function progress(record: PlacementRecord): PlacementStart['progress'] {
  return {
    answered: record.raw.state.responses.length,
    target: PLACEMENT_TOTAL_TARGET,
  };
}

function objectiveSession(record: PlacementRecord, item: AssessmentItem): PlacementStart {
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

function writingSession(record: PlacementRecord, task: WritingTask): PlacementStart {
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

function speakingSession(record: PlacementRecord, task: SpeakingTask): PlacementStart {
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

interface WritingSubmission {
  readonly evaluation: WritingEvaluation;
  readonly text: string;
  readonly passes: number;
}

async function completePlacement(
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

async function beginWriting(
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

async function beginSpeaking(
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

function sanitizeEvaluation(evaluation: AssessmentEvaluation, text: string): WritingEvaluation {
  return {
    ...evaluation,
    errors: evaluation.errors.filter(
      (error) =>
        text.includes(error.span) &&
        error.ruleId !== null &&
        RULES.some((rule) => rule.id === error.ruleId),
    ),
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
      if (active.raw.stage === 'writing' && active.raw.writingTask) {
        return c.json(writingSession(active, active.raw.writingTask));
      }
      if (active.raw.stage === 'speaking') {
        const task = getPlacementSpeakingTask(active.targetLang, active.raw.speakingIndex ?? 0);
        if (!task) {
          return c.json(errorResponse('assessment_incomplete', 'Speaking task is missing'), 409);
        }
        return c.json(speakingSession(active, task));
      }
      const currentId = active.raw.currentItemId;
      const item = currentId ? active.raw.items[currentId] : undefined;
      if (!item || !isPlacementItem(item)) {
        const candidates = await deps.assessments.listApprovedItems(user.id, profile.targetLang);
        const next = selectNextPlacementItem(active.raw.state, candidates);
        if (!next) {
          return c.json(errorResponse('content_unavailable', 'No approved placement items'), 503);
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
        return c.json(objectiveSession(repaired, next));
      }
      return c.json(objectiveSession(active, item));
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
        stage: 'objective',
      },
      createdAt: timestamp,
      completedAt: null,
    };
    await deps.assessments.createAssessment(record);
    return c.json(objectiveSession(record, first), 201);
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
    if (record.raw.stage === 'writing') {
      return c.json(errorResponse('writing_required', 'Submit the writing task first'), 409);
    }
    if (record.raw.stage === 'speaking') {
      return c.json(errorResponse('speaking_required', 'Submit the speaking task first'), 409);
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

    if (isPlacementComplete(outcome.state)) {
      const snapshot = await deps.account.getSnapshot(user.id);
      if (!snapshot.profile) {
        return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
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
      if (writing) return c.json(writing);
      return c.json(
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
      return c.json(errorResponse('content_unavailable', 'No approved placement items'), 503);
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
      progress: {
        answered: outcome.state.responses.length,
        target: PLACEMENT_TOTAL_TARGET,
      },
    } satisfies PlacementAnswer);
  });

  app.post('/:id/writing', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = writingSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid writing payload'), 400);
    }

    const record = await deps.assessments.getAssessment(user.id, c.req.param('id'));
    if (!record) {
      return c.json(errorResponse('not_found', 'Assessment not found'), 404);
    }
    if (record.status !== 'in_progress' || record.raw.stage !== 'writing') {
      return c.json(errorResponse('writing_not_expected', 'Writing is not expected now'), 409);
    }
    const task = record.raw.writingTask;
    if (!task) {
      return c.json(errorResponse('assessment_incomplete', 'Writing task is missing'), 409);
    }

    const validation = validateWritingResponse(parsed.data.text, task);
    if (!validation.ok) {
      return c.json(
        errorResponse(validation.error, 'Writing response length is outside the task range'),
        400,
      );
    }

    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    if (!canProcessAi(snapshot.consents)) {
      return c.json(errorResponse('consent_required', 'AI processing consent is required'), 403);
    }

    const input = {
      taskKind: 'writing' as const,
      taskPrompt: task.prompt,
      responseText: parsed.data.text,
      targetLang: record.targetLang,
      nativeLang: snapshot.profile.nativeLang,
      explanationMode: snapshot.profile.explanationMode,
      proficiencyFramework: snapshot.profile.proficiencyFramework,
      cefrTarget: task.cefrTarget,
      ruleIds: RULES.map((rule) => rule.id),
    };

    try {
      const [first, second] = await Promise.all([
        deps.ai.call({
          promptId: 'assessment.evaluate',
          promptVersion: 1,
          tier: 'reason',
          input,
          schema: assessmentEvaluationSchema,
          userId: user.id,
          maxRepairs: 1,
        }),
        deps.ai.call({
          promptId: 'assessment.evaluate',
          promptVersion: 1,
          tier: 'reason',
          input,
          schema: assessmentEvaluationSchema,
          userId: user.id,
          maxRepairs: 1,
        }),
      ]);
      const merged = mergeWritingEvaluations([
        sanitizeEvaluation(first.data, parsed.data.text),
        sanitizeEvaluation(second.data, parsed.data.text),
      ]);
      if (!merged) {
        return c.json(errorResponse('provider_error', 'Writing evaluation failed'), 502);
      }

      const timestamp = deps.now().toISOString();
      const interim = applyWritingToResult(
        buildPlacementResult(record.raw.state),
        merged,
        2,
      );
      const updatedRecord: PlacementRecord = {
        ...record,
        raw: {
          ...record.raw,
          writingTask: task,
          writingText: parsed.data.text,
          writingEvaluation: merged,
          result: interim,
        },
      };
      const speaking = await beginSpeaking(deps, updatedRecord, interim, null);
      if (speaking) return c.json(speaking);
      return c.json(
        await completePlacement(
          deps,
          updatedRecord,
          null,
          timestamp,
          snapshot.profile,
          undefined,
          interim,
        ),
      );
    } catch (error) {
      if (error instanceof AiGatewayError) {
        return c.json(errorResponse(error.code, error.message), aiErrorStatus(error.code));
      }
      return c.json(errorResponse('provider_error', 'Writing evaluation failed'), 502);
    }
  });

  app.post('/:id/writing/skip', async (c) => {
    const user = c.get('user');
    const record = await deps.assessments.getAssessment(user.id, c.req.param('id'));
    if (!record) {
      return c.json(errorResponse('not_found', 'Assessment not found'), 404);
    }
    if (record.status !== 'in_progress' || record.raw.stage !== 'writing') {
      return c.json(errorResponse('writing_not_expected', 'Writing is not expected now'), 409);
    }
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const interim = buildPlacementResult(record.raw.state);
    const speaking = await beginSpeaking(deps, record, interim, null);
    if (speaking) return c.json(speaking);
    return c.json(
      await completePlacement(
        deps,
        record,
        null,
        deps.now().toISOString(),
        snapshot.profile,
        undefined,
        interim,
      ),
    );
  });

  app.post('/:id/speaking', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = speakingSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid speaking payload'), 400);
    }

    const record = await deps.assessments.getAssessment(user.id, c.req.param('id'));
    if (!record) {
      return c.json(errorResponse('not_found', 'Assessment not found'), 404);
    }
    if (record.status !== 'in_progress' || record.raw.stage !== 'speaking') {
      return c.json(errorResponse('speaking_not_expected', 'Speaking is not expected now'), 409);
    }
    const index = record.raw.speakingIndex ?? 0;
    const task = getPlacementSpeakingTask(record.targetLang, index);
    if (!task || task.id !== parsed.data.taskId) {
      return c.json(errorResponse('stale_task', 'This is not the current speaking task'), 409);
    }
    if (!deps.transcribe) {
      return c.json(errorResponse('stt_unavailable', 'Speech-to-text is not configured'), 503);
    }

    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    if (!canProcessAi(snapshot.consents)) {
      return c.json(errorResponse('consent_required', 'AI processing consent is required'), 403);
    }
    if (!canUseVoice(snapshot.consents)) {
      return c.json(errorResponse('voice_consent_required', 'Voice consent is required'), 403);
    }

    const audio = Buffer.from(parsed.data.audioBase64, 'base64');
    if (audio.byteLength < 200) {
      return c.json(errorResponse('invalid_audio', 'Audio is empty or too short'), 400);
    }

    let transcription;
    try {
      transcription = await deps.transcribe(audio, record.targetLang);
    } catch {
      return c.json(errorResponse('transcription_failed', 'Could not transcribe audio'), 502);
    }
    if (transcription.text.trim().length === 0) {
      return c.json(errorResponse('empty_transcript', 'No speech detected'), 422);
    }

    const input = {
      taskKind: 'speaking' as const,
      taskPrompt: task.prompt,
      responseText: transcription.text,
      targetLang: record.targetLang,
      nativeLang: snapshot.profile.nativeLang,
      explanationMode: snapshot.profile.explanationMode,
      proficiencyFramework: snapshot.profile.proficiencyFramework,
      cefrTarget: task.cefrTarget,
      ruleIds: RULES.map((rule) => rule.id),
      durationSec: Math.max(1, Math.round(transcription.durationSec || parsed.data.durationSec)),
    };

    try {
      const [first, second] = await Promise.all([
        deps.ai.call({
          promptId: 'assessment.evaluate',
          promptVersion: 1,
          tier: 'reason',
          input,
          schema: assessmentEvaluationSchema,
          userId: user.id,
          maxRepairs: 1,
        }),
        deps.ai.call({
          promptId: 'assessment.evaluate',
          promptVersion: 1,
          tier: 'reason',
          input,
          schema: assessmentEvaluationSchema,
          userId: user.id,
          maxRepairs: 1,
        }),
      ]);
      const merged = mergeWritingEvaluations([
        sanitizeEvaluation(first.data, transcription.text),
        sanitizeEvaluation(second.data, transcription.text),
      ]);
      if (!merged) {
        return c.json(errorResponse('provider_error', 'Speaking evaluation failed'), 502);
      }

      const timestamp = deps.now().toISOString();
      const nextTask = getPlacementSpeakingTask(record.targetLang, index + 1);
      if (nextTask) {
        const updated: PlacementRecord = {
          ...record,
          raw: {
            ...record.raw,
            stage: 'speaking',
            currentItemId: null,
            speakingTask: nextTask,
            speakingIndex: index + 1,
            speakingEvaluations: [...(record.raw.speakingEvaluations ?? []), merged],
            speakingTranscripts: [...(record.raw.speakingTranscripts ?? []), transcription.text],
          },
        };
        await deps.assessments.updateAssessment(updated);
        return c.json({
          assessmentId: record.id,
          completed: false,
          stage: 'speaking',
          feedback: null,
          item: null,
          writingTask: null,
          speakingTask: nextTask,
          result: null,
          progress: progress(record),
        } satisfies PlacementAnswer);
      }

      const interim = record.raw.result ?? buildPlacementResult(record.raw.state);
      const finalResult = applySpeakingToResult(interim, merged, 2);
      const completedRecord: PlacementRecord = {
        ...record,
        raw: {
          ...record.raw,
          speakingEvaluations: [...(record.raw.speakingEvaluations ?? []), merged],
          speakingTranscripts: [...(record.raw.speakingTranscripts ?? []), transcription.text],
        },
      };
      return c.json(
        await completePlacement(
          deps,
          completedRecord,
          null,
          timestamp,
          snapshot.profile,
          undefined,
          finalResult,
        ),
      );
    } catch (error) {
      if (error instanceof AiGatewayError) {
        return c.json(errorResponse(error.code, error.message), aiErrorStatus(error.code));
      }
      return c.json(errorResponse('provider_error', 'Speaking evaluation failed'), 502);
    }
  });

  app.post('/:id/speaking/skip', async (c) => {
    const user = c.get('user');
    const record = await deps.assessments.getAssessment(user.id, c.req.param('id'));
    if (!record) {
      return c.json(errorResponse('not_found', 'Assessment not found'), 404);
    }
    if (record.status !== 'in_progress' || record.raw.stage !== 'speaking') {
      return c.json(errorResponse('speaking_not_expected', 'Speaking is not expected now'), 409);
    }
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const interim = record.raw.result ?? buildPlacementResult(record.raw.state);
    return c.json(
      await completePlacement(
        deps,
        record,
        null,
        deps.now().toISOString(),
        snapshot.profile,
        undefined,
        interim,
      ),
    );
  });

  return app;
}
