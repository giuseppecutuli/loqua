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
  mediaCandidateSchema,
  placementAnswerSchema,
  placementStartSchema,
  progressSummarySchema,
  sessionAttemptResponseSchema,
  sessionViewSchema,
  tasteProfileSchema,
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
  type MediaCandidate,
  type PlacementAnswer,
  type PlacementStart,
  type ProgressSummary,
  type SessionAttemptResponse,
  type SessionView,
  type TasteProfile,
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

export type MediaProgressStatus = 'watching' | 'reading' | 'finished' | 'abandoned';
export type MediaFeedbackKind = 'accepted' | 'rejected' | 'started' | 'finished' | 'abandoned';

export interface MediaTaste extends TasteProfile {
  readonly profileId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MediaReason {
  readonly whyItFits: string;
  readonly levelNote: string;
  readonly approach: string;
  readonly phrasesToNotice: readonly string[];
}

export interface MediaRecommendationComponents {
  readonly levelFit: number;
  readonly tasteMatch: number;
  readonly gapFit: number;
  readonly quality: number;
  readonly diversity: number;
  readonly freshness: number;
}

export interface MediaRecommendationView {
  readonly recommendationId: string;
  readonly status: string;
  readonly media: MediaCandidate;
  readonly score: number;
  readonly components: MediaRecommendationComponents;
  readonly reason: MediaReason;
}

export interface MediaGuideView {
  readonly mediaId: string;
  readonly before: readonly string[];
  readonly during: readonly string[];
  readonly after: readonly string[];
  readonly targetConcepts: readonly string[];
  readonly functionalPhrases: readonly string[];
  readonly comprehensionPrompts: readonly string[];
  readonly reflectionTask: string;
  readonly spoilerFree: boolean;
}

export interface MediaProgressView {
  readonly id: string;
  readonly mediaId: string;
  readonly status: MediaProgressStatus;
  readonly progressPct: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MediaPlanView {
  readonly weeklyMinutes: number;
  readonly focus: MediaCandidate | null;
  readonly nextStep: string;
}

export interface MediaReflectionSummary {
  readonly countsAsProduction: boolean;
  readonly praise?: string;
  readonly nextFocus: readonly string[];
}

export interface MediaSavedPhrase {
  readonly id: string;
  readonly text: string;
}

export interface MediaReflectionView {
  readonly reflection: MediaReflectionSummary;
  readonly savedPhrases: readonly MediaSavedPhrase[];
  readonly xpAwarded: number;
}

export interface MediaExplanationView {
  readonly explanation: MediaReason;
  readonly source: 'llm' | 'rule';
}

export interface MediaFeedbackInput {
  readonly kind: MediaFeedbackKind;
  readonly rating?: number;
  readonly difficulty?: 'too_easy' | 'ok' | 'too_hard';
  readonly reasonCode?: string;
  readonly recommendationId?: string;
}

export interface MediaReflectionInput {
  readonly text: string;
  readonly durationSec?: number;
  readonly phrases?: readonly string[];
}

function stringField(value: unknown, key: string): string | null {
  const candidate = field(value, key);
  return typeof candidate === 'string' ? candidate : null;
}

function numberField(value: unknown, key: string): number | null {
  const candidate = field(value, key);
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

function booleanField(value: unknown, key: string): boolean | null {
  const candidate = field(value, key);
  return typeof candidate === 'boolean' ? candidate : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function parseMediaTaste(value: unknown): MediaTaste | null {
  if (value === null || value === undefined) return null;
  const parsed = tasteProfileSchema.safeParse(value);
  const profileId = stringField(value, 'profileId');
  const createdAt = stringField(value, 'createdAt');
  const updatedAt = stringField(value, 'updatedAt');
  if (!parsed.success || profileId === null || createdAt === null || updatedAt === null) {
    throw new Error('invalid_media_taste');
  }
  return { ...parsed.data, profileId, createdAt, updatedAt };
}

function parseMediaCandidate(value: unknown): MediaCandidate {
  const parsed = mediaCandidateSchema.safeParse(value);
  if (!parsed.success) throw new Error('invalid_media');
  return parsed.data;
}

function parseMediaReason(value: unknown): MediaReason {
  return {
    whyItFits: stringField(value, 'whyItFits') ?? '',
    levelNote: stringField(value, 'levelNote') ?? '',
    approach: stringField(value, 'approach') ?? '',
    phrasesToNotice: stringList(field(value, 'phrasesToNotice')),
  };
}

function parseMediaComponents(value: unknown): MediaRecommendationComponents {
  return {
    levelFit: numberField(value, 'levelFit') ?? 0,
    tasteMatch: numberField(value, 'tasteMatch') ?? 0,
    gapFit: numberField(value, 'gapFit') ?? 0,
    quality: numberField(value, 'quality') ?? 0,
    diversity: numberField(value, 'diversity') ?? 0,
    freshness: numberField(value, 'freshness') ?? 0,
  };
}

function parseMediaRecommendation(value: unknown): MediaRecommendationView {
  const recommendationId = stringField(value, 'recommendationId');
  if (recommendationId === null) throw new Error('invalid_media_recommendation');
  return {
    recommendationId,
    status: stringField(value, 'status') ?? 'shown',
    media: parseMediaCandidate(field(value, 'media')),
    score: numberField(value, 'score') ?? 0,
    components: parseMediaComponents(field(value, 'components')),
    reason: parseMediaReason(field(value, 'reason')),
  };
}

function isMediaProgressStatus(value: string): value is MediaProgressStatus {
  return (
    value === 'watching' ||
    value === 'reading' ||
    value === 'finished' ||
    value === 'abandoned'
  );
}

function parseMediaProgress(value: unknown): MediaProgressView | null {
  if (value === null || value === undefined) return null;
  const id = stringField(value, 'id');
  const mediaId = stringField(value, 'mediaId');
  const rawStatus = stringField(value, 'status');
  const progressPct = numberField(value, 'progressPct');
  const createdAt = stringField(value, 'createdAt');
  const updatedAt = stringField(value, 'updatedAt');
  if (
    id === null ||
    mediaId === null ||
    rawStatus === null ||
    !isMediaProgressStatus(rawStatus) ||
    progressPct === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    throw new Error('invalid_media_progress');
  }
  return {
    id,
    mediaId,
    status: rawStatus,
    progressPct,
    startedAt: stringField(value, 'startedAt'),
    finishedAt: stringField(value, 'finishedAt'),
    createdAt,
    updatedAt,
  };
}

function parseMediaGuide(value: unknown): MediaGuideView {
  const mediaId = stringField(value, 'mediaId');
  const reflectionTask = stringField(value, 'reflectionTask');
  if (mediaId === null || reflectionTask === null) throw new Error('invalid_media_guide');
  return {
    mediaId,
    before: stringList(field(value, 'before')),
    during: stringList(field(value, 'during')),
    after: stringList(field(value, 'after')),
    targetConcepts: stringList(field(value, 'targetConcepts')),
    functionalPhrases: stringList(field(value, 'functionalPhrases')),
    comprehensionPrompts: stringList(field(value, 'comprehensionPrompts')),
    reflectionTask,
    spoilerFree: booleanField(value, 'spoilerFree') ?? true,
  };
}

function parseMediaPlan(value: unknown): MediaPlanView {
  const weeklyMinutes = numberField(value, 'weeklyMinutes');
  if (weeklyMinutes === null) throw new Error('invalid_media_plan');
  const focusValue = field(value, 'focus');
  return {
    weeklyMinutes,
    focus: focusValue === null || focusValue === undefined ? null : parseMediaCandidate(focusValue),
    nextStep: stringField(value, 'nextStep') ?? '',
  };
}

function parseMediaReflection(value: unknown): MediaReflectionView {
  const reflectionValue = field(value, 'reflection');
  const saved = field(value, 'savedPhrases');
  const savedPhrases: MediaSavedPhrase[] = Array.isArray(saved)
    ? saved.flatMap((entry) => {
        const id = stringField(entry, 'id');
        const text = stringField(entry, 'text');
        return id === null || text === null ? [] : [{ id, text }];
      })
    : [];
  return {
    reflection: {
      countsAsProduction: booleanField(reflectionValue, 'countsAsProduction') ?? false,
      praise: stringField(reflectionValue, 'praise') ?? undefined,
      nextFocus: stringList(field(reflectionValue, 'nextFocus')),
    },
    savedPhrases,
    xpAwarded: numberField(value, 'xpAwarded') ?? 0,
  };
}

function parseMediaSource(value: unknown): 'llm' | 'rule' {
  return stringField(value, 'source') === 'llm' ? 'llm' : 'rule';
}

export async function fetchMediaTaste(): Promise<MediaTaste | null> {
  const response = await request('/v1/media/taste');
  const body: unknown = await response.json();
  return parseMediaTaste(field(body, 'taste'));
}

export async function saveMediaTaste(taste: TasteProfile): Promise<MediaTaste> {
  const response = await request('/v1/media/taste', {
    method: 'PUT',
    body: JSON.stringify({ taste }),
  });
  const body: unknown = await response.json();
  const parsed = parseMediaTaste(field(body, 'taste'));
  if (parsed === null) throw new Error('invalid_media_taste');
  return parsed;
}

export async function deleteMediaTaste(): Promise<boolean> {
  const response = await request('/v1/media/taste', { method: 'DELETE' });
  const body: unknown = await response.json();
  return booleanField(body, 'deleted') ?? false;
}

export async function fetchMediaRecommendations(limit = 5): Promise<{
  readonly taste: MediaTaste | null;
  readonly recommendations: readonly MediaRecommendationView[];
}> {
  const response = await request(`/v1/media/recommendations?limit=${encodeURIComponent(limit)}`);
  const body: unknown = await response.json();
  const value = field(body, 'recommendations');
  if (!Array.isArray(value)) throw new Error('invalid_media_recommendations');
  return {
    taste: parseMediaTaste(field(body, 'taste')),
    recommendations: value.map(parseMediaRecommendation),
  };
}

export async function explainMedia(mediaId: string): Promise<MediaExplanationView> {
  const response = await request(`/v1/media/${encodeURIComponent(mediaId)}/explain`, {
    method: 'POST',
  });
  const body: unknown = await response.json();
  return {
    explanation: parseMediaReason(field(body, 'explanation')),
    source: parseMediaSource(body),
  };
}

export async function fetchMediaGuide(mediaId: string): Promise<{
  readonly guide: MediaGuideView;
  readonly source: 'llm' | 'rule';
  readonly progress: MediaProgressView | null;
}> {
  const response = await request(`/v1/media/${encodeURIComponent(mediaId)}/guide`, {
    method: 'POST',
  });
  const body: unknown = await response.json();
  return {
    guide: parseMediaGuide(field(body, 'guide')),
    source: parseMediaSource(body),
    progress: parseMediaProgress(field(body, 'progress')),
  };
}

export async function sendMediaFeedback(
  mediaId: string,
  input: MediaFeedbackInput,
): Promise<{
  readonly taste: MediaTaste;
  readonly progress: MediaProgressView | null;
  readonly status: string;
}> {
  const response = await request(`/v1/media/${encodeURIComponent(mediaId)}/feedback`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  const taste = parseMediaTaste(field(body, 'taste'));
  if (taste === null) throw new Error('invalid_media_taste');
  return {
    taste,
    progress: parseMediaProgress(field(body, 'progress')),
    status: stringField(body, 'status') ?? input.kind,
  };
}

export async function saveMediaProgress(
  mediaId: string,
  status: MediaProgressStatus,
  progressPct: number,
): Promise<MediaProgressView> {
  const response = await request(`/v1/media/${encodeURIComponent(mediaId)}/progress`, {
    method: 'POST',
    body: JSON.stringify({ status, progressPct }),
  });
  const body: unknown = await response.json();
  const parsed = parseMediaProgress(field(body, 'progress'));
  if (parsed === null) throw new Error('invalid_media_progress');
  return parsed;
}

export async function fetchMediaProgress(): Promise<readonly MediaProgressView[]> {
  const response = await request('/v1/media/progress');
  const body: unknown = await response.json();
  const value = field(body, 'progress');
  if (!Array.isArray(value)) throw new Error('invalid_media_progress');
  return value.flatMap((entry) => {
    const parsed = parseMediaProgress(entry);
    return parsed === null ? [] : [parsed];
  });
}

export async function fetchMediaPlan(): Promise<MediaPlanView> {
  const response = await request('/v1/media/plan');
  const body: unknown = await response.json();
  return parseMediaPlan(body);
}

export async function submitMediaReflection(
  mediaId: string,
  input: MediaReflectionInput,
): Promise<MediaReflectionView> {
  const response = await request(`/v1/media/${encodeURIComponent(mediaId)}/reflection`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  return parseMediaReflection(body);
}
