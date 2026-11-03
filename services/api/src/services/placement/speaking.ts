import { AiGatewayError } from '@loqua/ai';
import { RULES, getPlacementSpeakingTask } from '@loqua/content';
import {
  applySpeakingToResult,
  buildPlacementResult,
  canProcessAi,
  canUseVoice,
  type PlacementAnswer,
} from '@loqua/core';

import { aiErrorStatus } from '../../http/ai-error.js';
import type { PlacementRecord } from '../../repos/assessment.js';
import { completePlacement } from './completion.js';
import type { PlacementRoutesDeps } from './deps.js';
import { evaluateSubmission } from './evaluation.js';
import { failure, success, type PlacementOutcome } from './result.js';
import { progress } from './view.js';

export async function submitSpeaking(
  deps: PlacementRoutesDeps,
  userId: string,
  assessmentId: string,
  taskId: string,
  audioBase64: string,
  durationSec: number,
): Promise<PlacementOutcome<PlacementAnswer>> {
  const record = await deps.assessments.getAssessment(userId, assessmentId);
  if (!record) {
    return failure(404, 'not_found', 'Assessment not found');
  }
  if (record.status !== 'in_progress' || record.raw.stage !== 'speaking') {
    return failure(409, 'speaking_not_expected', 'Speaking is not expected now');
  }
  const index = record.raw.speakingIndex ?? 0;
  const task = getPlacementSpeakingTask(record.targetLang, index);
  if (!task || task.id !== taskId) {
    return failure(409, 'stale_task', 'This is not the current speaking task');
  }
  if (!deps.transcribe) {
    return failure(503, 'stt_unavailable', 'Speech-to-text is not configured');
  }

  const snapshot = await deps.account.getSnapshot(userId);
  if (!snapshot.profile) {
    return failure(409, 'profile_required', 'Complete onboarding first');
  }
  if (!canProcessAi(snapshot.consents)) {
    return failure(403, 'consent_required', 'AI processing consent is required');
  }
  if (!canUseVoice(snapshot.consents)) {
    return failure(403, 'voice_consent_required', 'Voice consent is required');
  }

  const audio = Buffer.from(audioBase64, 'base64');
  if (audio.byteLength < 200) {
    return failure(400, 'invalid_audio', 'Audio is empty or too short');
  }

  let transcription: { text: string; durationSec: number; languageCode: string | null };
  try {
    transcription = await deps.transcribe(audio, record.targetLang);
  } catch {
    return failure(502, 'transcription_failed', 'Could not transcribe audio');
  }
  if (transcription.text.trim().length === 0) {
    return failure(422, 'empty_transcript', 'No speech detected');
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
    durationSec: Math.max(1, Math.round(transcription.durationSec || durationSec)),
  };

  try {
    const merged = await evaluateSubmission(deps.ai, userId, input, transcription.text);
    if (!merged) {
      return failure(502, 'provider_error', 'Speaking evaluation failed');
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
      return success({
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
    return success(
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
      return failure(aiErrorStatus(error.code), error.code, error.message);
    }
    return failure(502, 'provider_error', 'Speaking evaluation failed');
  }
}

export async function skipSpeaking(
  deps: PlacementRoutesDeps,
  userId: string,
  assessmentId: string,
): Promise<PlacementOutcome<PlacementAnswer>> {
  const record = await deps.assessments.getAssessment(userId, assessmentId);
  if (!record) {
    return failure(404, 'not_found', 'Assessment not found');
  }
  if (record.status !== 'in_progress' || record.raw.stage !== 'speaking') {
    return failure(409, 'speaking_not_expected', 'Speaking is not expected now');
  }
  const snapshot = await deps.account.getSnapshot(userId);
  if (!snapshot.profile) {
    return failure(409, 'profile_required', 'Complete onboarding first');
  }
  const interim = record.raw.result ?? buildPlacementResult(record.raw.state);
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
