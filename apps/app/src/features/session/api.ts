import {
  sessionAttemptResponseSchema,
  sessionViewSchema,
  type SessionAttemptResponse,
  type SessionView,
} from '@loqua/core';

import { parseBody, parseEnvelope, request } from '../../lib/http';

export async function startSession(): Promise<SessionView> {
  const body: unknown = await (await request('/v1/sessions', { method: 'POST' })).json();
  return parseEnvelope(body, 'session', sessionViewSchema, 'invalid_session');
}

export async function submitSessionAttempt(
  sessionId: string,
  sessionItemId: string,
  answer: { readonly optionId?: string; readonly text?: string },
  latencyMs: number,
): Promise<SessionAttemptResponse> {
  const body: unknown = await (
    await request(`/v1/sessions/${encodeURIComponent(sessionId)}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ sessionItemId, ...answer, latencyMs }),
    })
  ).json();
  return parseBody(body, sessionAttemptResponseSchema, 'invalid_session');
}
