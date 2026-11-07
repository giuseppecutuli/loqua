import {
  placementAnswerSchema,
  placementStartSchema,
  type PlacementAnswer,
  type PlacementStart,
} from '@loqua/core';

import { parseBody, request } from '../../lib/http';

async function placementAnswer(path: string, init: RequestInit = {}): Promise<PlacementAnswer> {
  const body: unknown = await (await request(path, init)).json();
  return parseBody(body, placementAnswerSchema, 'invalid_placement');
}

export async function startPlacement(): Promise<PlacementStart> {
  const body: unknown = await (
    await request('/v1/assessments/placement/start', { method: 'POST' })
  ).json();
  return parseBody(body, placementStartSchema, 'invalid_placement');
}

export async function answerPlacement(
  assessmentId: string,
  itemId: string,
  optionId: string,
): Promise<PlacementAnswer> {
  return placementAnswer(`/v1/assessments/${encodeURIComponent(assessmentId)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ itemId, optionId }),
  });
}

export async function submitWriting(assessmentId: string, text: string): Promise<PlacementAnswer> {
  return placementAnswer(`/v1/assessments/${encodeURIComponent(assessmentId)}/writing`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function submitSpeaking(
  assessmentId: string,
  taskId: string,
  audioBase64: string,
  durationSec: number,
): Promise<PlacementAnswer> {
  return placementAnswer(`/v1/assessments/${encodeURIComponent(assessmentId)}/speaking`, {
    method: 'POST',
    body: JSON.stringify({ taskId, audioBase64, durationSec }),
  });
}

export async function skipSpeaking(assessmentId: string): Promise<PlacementAnswer> {
  return placementAnswer(`/v1/assessments/${encodeURIComponent(assessmentId)}/speaking/skip`, {
    method: 'POST',
  });
}

export async function skipWriting(assessmentId: string): Promise<PlacementAnswer> {
  return placementAnswer(`/v1/assessments/${encodeURIComponent(assessmentId)}/writing/skip`, {
    method: 'POST',
  });
}
