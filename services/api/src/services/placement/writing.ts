import { AiGatewayError } from '@loqua/ai';
import { RULES } from '@loqua/content';
import {
  applyWritingToResult,
  buildPlacementResult,
  canProcessAi,
  validateWritingResponse,
  type PlacementAnswer,
} from '@loqua/core';

import { aiErrorStatus } from '../../http/ai-error.js';
import type { PlacementRecord } from '../../repos/assessment.js';
import { beginSpeaking, completePlacement } from './completion.js';
import type { PlacementRoutesDeps } from './deps.js';
import { evaluateSubmission } from './evaluation.js';
import { failure, success, type PlacementOutcome } from './result.js';

export async function submitWriting(
  deps: PlacementRoutesDeps,
  userId: string,
  assessmentId: string,
  text: string,
): Promise<PlacementOutcome<PlacementAnswer>> {
  const record = await deps.assessments.getAssessment(userId, assessmentId);
  if (!record) {
    return failure(404, 'not_found', 'Assessment not found');
  }
  if (record.status !== 'in_progress' || record.raw.stage !== 'writing') {
    return failure(409, 'writing_not_expected', 'Writing is not expected now');
  }
  const task = record.raw.writingTask;
  if (!task) {
    return failure(409, 'assessment_incomplete', 'Writing task is missing');
  }

  const validation = validateWritingResponse(text, task);
  if (!validation.ok) {
    return failure(400, validation.error, 'Writing response length is outside the task range');
  }

  const snapshot = await deps.account.getSnapshot(userId);
  if (!snapshot.profile) {
    return failure(409, 'profile_required', 'Complete onboarding first');
  }
  if (!canProcessAi(snapshot.consents)) {
    return failure(403, 'consent_required', 'AI processing consent is required');
  }

  const input = {
    taskKind: 'writing' as const,
    taskPrompt: task.prompt,
    responseText: text,
    targetLang: record.targetLang,
    nativeLang: snapshot.profile.nativeLang,
    explanationMode: snapshot.profile.explanationMode,
    proficiencyFramework: snapshot.profile.proficiencyFramework,
    cefrTarget: task.cefrTarget,
    ruleIds: RULES.map((rule) => rule.id),
  };

  try {
    const merged = await evaluateSubmission(deps.ai, userId, input, text);
    if (!merged) {
      return failure(502, 'provider_error', 'Writing evaluation failed');
    }

    const timestamp = deps.now().toISOString();
    const interim = applyWritingToResult(buildPlacementResult(record.raw.state), merged, 2);
    const updatedRecord: PlacementRecord = {
      ...record,
      raw: {
        ...record.raw,
        writingTask: task,
        writingText: text,
        writingEvaluation: merged,
        result: interim,
      },
    };
    const speaking = await beginSpeaking(deps, updatedRecord, interim, null);
    if (speaking) return success(speaking);
    return success(
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
      return failure(aiErrorStatus(error.code), error.code, error.message);
    }
    return failure(502, 'provider_error', 'Writing evaluation failed');
  }
}

export async function skipWriting(
  deps: PlacementRoutesDeps,
  userId: string,
  assessmentId: string,
): Promise<PlacementOutcome<PlacementAnswer>> {
  const record = await deps.assessments.getAssessment(userId, assessmentId);
  if (!record) {
    return failure(404, 'not_found', 'Assessment not found');
  }
  if (record.status !== 'in_progress' || record.raw.stage !== 'writing') {
    return failure(409, 'writing_not_expected', 'Writing is not expected now');
  }
  const snapshot = await deps.account.getSnapshot(userId);
  if (!snapshot.profile) {
    return failure(409, 'profile_required', 'Complete onboarding first');
  }
  const interim = buildPlacementResult(record.raw.state);
  const speaking = await beginSpeaking(deps, record, interim, null);
  if (speaking) return success(speaking);
  return success(
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
}
