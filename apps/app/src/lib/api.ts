import {
  consentRecordSchema,
  conversationReplySchema,
  conversationReportSchema,
  conversationScenarioViewSchema,
  conversationViewSchema,
  deviceSchema,
  gamificationSnapshotSchema,
  notificationPlanSchema,
  notificationPreferencesSchema,
  weekInsightsSchema,
  learnerProfileSchema,
  placementAnswerSchema,
  placementStartSchema,
  progressSummarySchema,
  sessionAttemptResponseSchema,
  sessionViewSchema,
  type ConsentRecord,
  type ConversationReply,
  type ConversationReport,
  type ConversationScenarioView,
  type ConversationView,
  type Device,
  type GamificationSnapshot,
  type WeekInsights,
  type DevicePlatform,
  type NotificationPermission,
  type NotificationPlan,
  type NotificationPreferences,
  type LearnerProfile,
  type PlacementAnswer,
  type PlacementStart,
  type ProgressSummary,
  type SessionAttemptResponse,
  type SessionView,
} from '@loqua/core';

import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!apiUrl || !supabase) return null;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders();
  if (!headers) throw new Error('unauthorized');
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`api_${response.status}`);
  return response;
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

export async function hasRemoteSession(): Promise<boolean> {
  return (await authHeaders()) !== null;
}

export async function fetchProfile(): Promise<LearnerProfile | null> {
  const response = await request('/v1/profile');
  const body: unknown = await response.json();
  const value = field(body, 'profile');
  if (value === null) return null;
  const parsed = learnerProfileSchema.safeParse(value);
  if (!parsed.success) throw new Error('invalid_profile');
  return parsed.data;
}

export async function saveProfile(profile: LearnerProfile): Promise<LearnerProfile> {
  const response = await request('/v1/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
  const body: unknown = await response.json();
  const parsed = learnerProfileSchema.safeParse(field(body, 'profile'));
  if (!parsed.success) throw new Error('invalid_profile');
  return parsed.data;
}

export async function fetchConsents(): Promise<readonly ConsentRecord[]> {
  const response = await request('/v1/consents');
  const body: unknown = await response.json();
  const value = field(body, 'consents');
  if (!Array.isArray(value)) throw new Error('invalid_consents');
  return value.flatMap((entry) => {
    const parsed = consentRecordSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function saveConsents(
  consents: readonly ConsentRecord[],
): Promise<readonly ConsentRecord[]> {
  const response = await request('/v1/consents', {
    method: 'PUT',
    body: JSON.stringify({ consents }),
  });
  const body: unknown = await response.json();
  const value = field(body, 'consents');
  if (!Array.isArray(value)) throw new Error('invalid_consents');
  return value.flatMap((entry) => {
    const parsed = consentRecordSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function fetchDevices(): Promise<readonly Device[]> {
  const response = await request('/v1/devices');
  const body: unknown = await response.json();
  const value = field(body, 'devices');
  if (!Array.isArray(value)) throw new Error('invalid_devices');
  return value.flatMap((entry) => {
    const parsed = deviceSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function registerDevice(input: {
  readonly id: string;
  readonly platform: DevicePlatform;
  readonly name: string;
}): Promise<Device> {
  const response = await request('/v1/devices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  const parsed = deviceSchema.safeParse(field(body, 'device'));
  if (!parsed.success) throw new Error('invalid_device');
  return parsed.data;
}

export async function revokeDevice(deviceId: string): Promise<boolean> {
  try {
    const response = await request(`/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchServerExport(): Promise<string | null> {
  try {
    const response = await request('/v1/account/export');
    return await response.text();
  } catch {
    return null;
  }
}

export async function requestServerDelete(): Promise<boolean> {
  try {
    const response = await request('/v1/account', { method: 'DELETE' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function startPlacement(): Promise<PlacementStart> {
  const response = await request('/v1/assessments/placement/start', { method: 'POST' });
  const parsed = placementStartSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function answerPlacement(
  assessmentId: string,
  itemId: string,
  optionId: string,
): Promise<PlacementAnswer> {
  const response = await request(`/v1/assessments/${encodeURIComponent(assessmentId)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ itemId, optionId }),
  });
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function submitWriting(assessmentId: string, text: string): Promise<PlacementAnswer> {
  const response = await request(`/v1/assessments/${encodeURIComponent(assessmentId)}/writing`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function submitSpeaking(
  assessmentId: string,
  taskId: string,
  audioBase64: string,
  durationSec: number,
): Promise<PlacementAnswer> {
  const response = await request(`/v1/assessments/${encodeURIComponent(assessmentId)}/speaking`, {
    method: 'POST',
    body: JSON.stringify({ taskId, audioBase64, durationSec }),
  });
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function skipSpeaking(assessmentId: string): Promise<PlacementAnswer> {
  const response = await request(
    `/v1/assessments/${encodeURIComponent(assessmentId)}/speaking/skip`,
    { method: 'POST' },
  );
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function skipWriting(assessmentId: string): Promise<PlacementAnswer> {
  const response = await request(
    `/v1/assessments/${encodeURIComponent(assessmentId)}/writing/skip`,
    { method: 'POST' },
  );
  const parsed = placementAnswerSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_placement');
  return parsed.data;
}

export async function savePhrase(
  text: string,
  sourceRef?: string,
): Promise<void> {
  await request('/v1/phrases', {
    method: 'POST',
    body: JSON.stringify({ text, source: 'exercise', sourceRef: sourceRef ?? null }),
  });
}

export async function fetchGamification(): Promise<GamificationSnapshot> {
  const response = await request('/v1/gamification');
  const body: unknown = await response.json();
  const parsed = gamificationSnapshotSchema.safeParse(field(body, 'gamification'));
  if (!parsed.success) throw new Error('invalid_gamification');
  return parsed.data;
}

export async function fetchInsights(): Promise<WeekInsights> {
  const response = await request('/v1/insights');
  const body: unknown = await response.json();
  const parsed = weekInsightsSchema.safeParse(field(body, 'insights'));
  if (!parsed.success) throw new Error('invalid_insights');
  return parsed.data;
}

export async function fetchProgress(): Promise<ProgressSummary> {
  const response = await request('/v1/progress');
  const body: unknown = await response.json();
  const parsed = progressSummarySchema.safeParse(field(body, 'progress'));
  if (!parsed.success) throw new Error('invalid_progress');
  return parsed.data;
}

export async function startSession(): Promise<SessionView> {
  const response = await request('/v1/sessions', { method: 'POST' });
  const body: unknown = await response.json();
  const parsed = sessionViewSchema.safeParse(field(body, 'session'));
  if (!parsed.success) throw new Error('invalid_session');
  return parsed.data;
}

export async function fetchCurrentSession(): Promise<SessionView | null> {
  const response = await request('/v1/sessions/current');
  const body: unknown = await response.json();
  const value = field(body, 'session');
  if (value === null) return null;
  const parsed = sessionViewSchema.safeParse(value);
  if (!parsed.success) throw new Error('invalid_session');
  return parsed.data;
}

export async function submitSessionAttempt(
  sessionId: string,
  sessionItemId: string,
  answer: { readonly optionId?: string; readonly text?: string },
  latencyMs: number,
): Promise<SessionAttemptResponse> {
  const response = await request(`/v1/sessions/${encodeURIComponent(sessionId)}/attempts`, {
    method: 'POST',
    body: JSON.stringify({ sessionItemId, ...answer, latencyMs }),
  });
  const parsed = sessionAttemptResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_session');
  return parsed.data;
}

export async function fetchConversationScenarios(): Promise<readonly ConversationScenarioView[]> {
  const response = await request('/v1/conversations/scenarios');
  const body: unknown = await response.json();
  const value = field(body, 'scenarios');
  if (!Array.isArray(value)) throw new Error('invalid_scenarios');
  return value.flatMap((entry) => {
    const parsed = conversationScenarioViewSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function startConversation(scenarioId: string): Promise<ConversationView> {
  const response = await request('/v1/conversations', {
    method: 'POST',
    body: JSON.stringify({ scenarioId }),
  });
  const body: unknown = await response.json();
  const parsed = conversationViewSchema.safeParse(field(body, 'session'));
  if (!parsed.success) throw new Error('invalid_conversation');
  return parsed.data;
}

export async function fetchConversation(id: string): Promise<ConversationView> {
  const response = await request('/v1/conversations/' + encodeURIComponent(id));
  const body: unknown = await response.json();
  const parsed = conversationViewSchema.safeParse(field(body, 'session'));
  if (!parsed.success) throw new Error('invalid_conversation');
  return parsed.data;
}

export async function sendConversationTurn(id: string, text: string): Promise<ConversationReply> {
  const response = await request('/v1/conversations/' + encodeURIComponent(id) + '/turns', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  const parsed = conversationReplySchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_conversation');
  return parsed.data;
}

export async function sendConversationVoice(
  conversationId: string,
  audioBase64: string,
  durationSec: number,
): Promise<ConversationReply> {
  const response = await request(
    `/v1/conversations/${encodeURIComponent(conversationId)}/turns/voice`,
    {
      method: 'POST',
      body: JSON.stringify({ audioBase64, durationSec }),
    },
  );
  const parsed = conversationReplySchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('invalid_conversation');
  return parsed.data;
}

export async function fetchConversationReport(
  conversationId: string,
): Promise<ConversationReport> {
  const response = await request(
    `/v1/conversations/${encodeURIComponent(conversationId)}/report`,
    { method: 'POST' },
  );
  const body: unknown = await response.json();
  const parsed = conversationReportSchema.safeParse(field(body, 'report'));
  if (!parsed.success) throw new Error('invalid_report');
  return parsed.data;
}

export async function completeConversation(id: string): Promise<ConversationView> {
  const response = await request('/v1/conversations/' + encodeURIComponent(id) + '/complete', {
    method: 'POST',
  });
  const body: unknown = await response.json();
  const parsed = conversationViewSchema.safeParse(field(body, 'session'));
  if (!parsed.success) throw new Error('invalid_conversation');
  return parsed.data;
}

export type EventProperties = Record<string, string | number | boolean | null>;

export async function trackEvent(
  name: string,
  properties: EventProperties = {},
): Promise<void> {
  try {
    await request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          {
            name,
            occurredAt: new Date().toISOString(),
            properties,
          },
        ],
      }),
    });
  } catch {
    // Product analytics must never break the learning loop.
  }
}

export async function fetchNotifications(
  permission: NotificationPermission,
): Promise<{ readonly prefs: NotificationPreferences; readonly plan: NotificationPlan }> {
  const response = await request(
    `/v1/notifications?permission=${encodeURIComponent(permission)}`,
  );
  const body: unknown = await response.json();
  const prefs = notificationPreferencesSchema.safeParse(field(body, 'prefs'));
  if (!prefs.success) throw new Error('invalid_notifications');
  const plan = notificationPlanSchema.safeParse(field(body, 'plan'));
  if (!plan.success) throw new Error('invalid_notifications');
  return { prefs: prefs.data, plan: plan.data };
}

export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const response = await request('/v1/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify({ prefs }),
  });
  const body: unknown = await response.json();
  const parsed = notificationPreferencesSchema.safeParse(field(body, 'prefs'));
  if (!parsed.success) throw new Error('invalid_notifications');
  return parsed.data;
}

export async function markNotificationSent(kind: string): Promise<void> {
  await request('/v1/notifications/sent', {
    method: 'POST',
    body: JSON.stringify({ kind }),
  });
}
