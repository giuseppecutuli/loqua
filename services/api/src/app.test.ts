import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createGateway,
  InMemoryCostSink,
  type AiProvider,
  type ProviderRequest,
  type ProviderResponse,
} from '@loqua/ai';
import {
  createLearnerProfile,
  parseExportJson,
  registerDevice,
  type AssessmentItem,
  type PlacementSkill,
} from '@loqua/core';

import { createApp } from './app.js';
import type { JwtVerifier } from './auth.js';
import { InMemoryAccountRepository } from './repos/account.js';
import { InMemoryAssessmentRepository } from './repos/assessment.js';

const validCorrection = {
  corrections: [
    {
      span: 'have went',
      errorType: 'tense',
      ruleId: 'en.gram.tense.present_perfect',
      severity: 'medium',
      confidence: 0.95,
      explanation: 'Use the simple past with a finished time.',
    },
  ],
};

class ScriptedProvider implements AiProvider {
  readonly name = 'scripted';

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    return {
      text: JSON.stringify(validCorrection),
      provider: 'scripted',
      model: request.model,
      tokensIn: 100,
      tokensOut: 40,
    };
  }
}

const now = new Date('2026-11-01T10:00:00.000Z');

function createTestApp(
  options: { readonly items?: readonly AssessmentItem[]; readonly withProfile?: boolean } = {},
) {
  const verifier: JwtVerifier = async (token) => {
    if (token !== 'good-token') throw new Error('bad token');
    return { id: 'user-1', email: 'a@example.test', role: 'authenticated', isAnonymous: false };
  };
  const account = new InMemoryAccountRepository();
  const assessments = new InMemoryAssessmentRepository(options.items ?? []);
  const registration = registerDevice([], {
    id: 'device-1',
    userId: 'user-1',
    platform: 'web',
    name: 'Browser',
    now,
  });
  if (!registration.ok) throw new Error(registration.error);
  const profile = options.withProfile
    ? createLearnerProfile(
        {
          goal: 'work',
          dailyMinutes: 20,
          timezone: 'Europe/Rome',
          interests: ['technology'],
          selfAssessment: { grammar: 'B1', vocabulary: 'B1', reading: 'B1', pragmatics: 'B1' },
        },
        { id: 'profile-1', userId: 'user-1', now },
      )
    : null;
  if (profile && !profile.ok) throw new Error('profile fixture failed');
  account.seed('user-1', {
    profile: profile?.value ?? null,
    consents: [
      {
        id: 'consent-terms',
        userId: 'user-1',
        kind: 'terms',
        version: '1',
        grantedAt: now.toISOString(),
        revokedAt: null,
        createdAt: now.toISOString(),
      },
      {
        id: 'consent-privacy',
        userId: 'user-1',
        kind: 'privacy',
        version: '1',
        grantedAt: now.toISOString(),
        revokedAt: null,
        createdAt: now.toISOString(),
      },
      {
        id: 'consent-ai',
        userId: 'user-1',
        kind: 'ai_processing',
        version: '1',
        grantedAt: now.toISOString(),
        revokedAt: null,
        createdAt: now.toISOString(),
      },
    ],
    devices: registration.value,
    settings: null,
    data: { attempts: [] },
  });

  const costs = new InMemoryCostSink();
  const ai = createGateway({ provider: new ScriptedProvider(), costSink: costs });
  const app = createApp({
    ai,
    auth: verifier,
    account,
    assessments,
    now: () => now,
    corsOrigins: ['http://localhost:8081'],
  });
  return { app, costs, account, assessments };
}

const authHeaders = { authorization: 'Bearer good-token', 'content-type': 'application/json' };

function placementItems(): AssessmentItem[] {
  const values: Array<[PlacementSkill, number]> = [
    ['grammar', -2],
    ['grammar', -1.2],
    ['grammar', -0.4],
    ['grammar', 0.2],
    ['grammar', 1],
    ['grammar', 2],
    ['vocabulary', -1.8],
    ['vocabulary', -0.8],
    ['vocabulary', 0],
    ['vocabulary', 0.9],
    ['vocabulary', 1.7],
    ['reading', -1.4],
    ['reading', -0.2],
    ['reading', 0.8],
    ['reading', 1.6],
    ['pragmatics', -1],
    ['pragmatics', 0.3],
    ['pragmatics', 1.4],
  ];
  return values.map(([skill, difficultyB], index) => ({
    id: `test-${skill}-${index}`,
    targetLang: 'en',
    type: 'cloze',
    skill,
    skillId: `skill-en-${skill}`,
    cefrLevel: 'B1',
    conceptId: `test-concept-${skill}-${index}`,
    difficultyB,
    prompt: `Question ${index + 1}`,
    options: [
      { id: 'a', text: 'Correct' },
      { id: 'b', text: 'Wrong' },
      { id: 'c', text: 'Also wrong' },
    ],
    correctOptionId: 'a',
    explanation: 'Option A is correct.',
  }));
}

const startResponseSchema = z.object({
  assessmentId: z.string(),
  item: z.object({ id: z.string() }),
  progress: z.object({ answered: z.number(), target: z.number() }),
});

const answerResponseSchema = z.object({
  assessmentId: z.string(),
  completed: z.boolean(),
  item: z.object({ id: z.string() }).nullable(),
  result: z
    .object({
      overallLevel: z.string().nullable(),
      priorities: z.array(z.object({ skill: z.string() })),
      decisions: z
        .object({
          testOutConcepts: z.array(z.object({ conceptId: z.string() })),
          remediationSkills: z.array(z.object({ skill: z.string() })),
          challengeLevel: z.string().nullable(),
        })
        .optional(),
    })
    .nullable(),
  progress: z.object({ answered: z.number(), target: z.number() }),
});

describe('Hono API', () => {
  it('serves health without auth', async () => {
    const { app } = createTestApp();
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  it('allows only configured CORS origins', async () => {
    const { app } = createTestApp();
    const allowed = await app.request('/health', {
      headers: { origin: 'http://localhost:8081' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');

    const denied = await app.request('/health', {
      headers: { origin: 'https://evil.example' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('rejects missing or invalid tokens', async () => {
    const { app } = createTestApp();
    expect((await app.request('/v1/me')).status).toBe(401);
    expect((await app.request('/v1/me', { headers: { authorization: 'Bearer bad' } })).status).toBe(
      401,
    );
  });

  it('returns the authenticated user', async () => {
    const { app } = createTestApp();
    const response = await app.request('/v1/me', { headers: authHeaders });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: 'user-1' } });
  });

  it('exports a checksummed, versioned payload', async () => {
    const { app } = createTestApp();
    const response = await app.request('/v1/account/export', { headers: authHeaders });
    expect(response.status).toBe(200);
    const body = await response.json();
    const parsed = await parseExportJson(JSON.stringify(body));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.formatVersion).toBe(1);
      expect(parsed.value.userId).toBe('user-1');
    }
  });

  it('schedules account deletion', async () => {
    const { app } = createTestApp();
    const response = await app.request('/v1/account', { method: 'DELETE', headers: authHeaders });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: 'delete_scheduled' });
  });

  it('lists and revokes devices', async () => {
    const { app } = createTestApp();
    const list = await app.request('/v1/devices', { headers: authHeaders });
    expect(await list.json()).toMatchObject({ devices: [{ id: 'device-1' }] });

    const revoked = await app.request('/v1/devices/device-1', {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(revoked.status).toBe(200);

    const again = await app.request('/v1/devices/missing', {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(again.status).toBe(404);
  });

  it('validates and runs AI calls through the gateway', async () => {
    const { app, costs } = createTestApp();
    const response = await app.request('/v1/ai/call', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        promptId: 'correction.evaluate',
        promptVersion: 2,
        tier: 'fast',
        input: {
          targetLang: 'en',
          nativeLang: 'it',
          explanationMode: 'target_simple',
          proficiencyFramework: 'CEFR',
          cefrLevel: 'B1',
          learnerText: 'I have went to the store yesterday.',
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { corrections: [{ ruleId: 'en.gram.tense.present_perfect' }] },
    });
    expect(costs.entries).toHaveLength(1);
    expect(costs.entries[0]?.userId).toBe('user-1');
  });

  it('reads and writes the profile through Hono', async () => {
    const { app } = createTestApp();
    const initial = await app.request('/v1/profile', { headers: authHeaders });
    expect(await initial.json()).toEqual({ profile: null });

    const profile = {
      targetLang: 'en',
      nativeLang: 'it',
      uiLocale: 'it',
      explanationMode: 'target_simple',
      proficiencyFramework: 'CEFR',
      proficiencyEstimate: 'B1',
      goal: 'work',
      dailyMinutes: 20,
      streakMode: 'flexible',
      timezone: 'Europe/Rome',
      interests: ['work'],
      selfAssessment: { grammar: 'B1' },
      onboardingCompleted: true,
    };
    const saved = await app.request('/v1/profile', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(profile),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ profile: { userId: 'user-1', ...profile } });

    const read = await app.request('/v1/profile', { headers: authHeaders });
    expect(await read.json()).toMatchObject({ profile: { userId: 'user-1', goal: 'work' } });
  });

  it('upserts consents through Hono', async () => {
    const { app } = createTestApp();
    const nowIso = now.toISOString();
    const voice = {
      id: 'consent-voice',
      userId: 'ignored',
      kind: 'voice',
      version: '1',
      grantedAt: nowIso,
      revokedAt: null,
      createdAt: nowIso,
    };
    const saved = await app.request('/v1/consents', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ consents: [voice] }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      consents: [{ kind: 'voice', userId: 'user-1' }],
    });

    const read = await app.request('/v1/consents', { headers: authHeaders });
    const body = await read.json();
    expect(body.consents).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'voice' })]),
    );
  });

  it('registers a device through Hono', async () => {
    const { app } = createTestApp();
    const response = await app.request('/v1/devices', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        platform: 'android',
        name: 'Pixel',
      }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      device: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', userId: 'user-1' },
    });
  });
  it('blocks AI calls without consent', async () => {
    const verifier: JwtVerifier = async () => ({
      id: 'no-consent-user',
      email: null,
      role: 'authenticated',
      isAnonymous: true,
    });
    const account = new InMemoryAccountRepository();
    const ai = createGateway({ provider: new ScriptedProvider() });
    const assessments = new InMemoryAssessmentRepository();
    const app = createApp({ ai, auth: verifier, account, assessments, now: () => now });

    const response = await app.request('/v1/ai/call', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        promptId: 'correction.evaluate',
        promptVersion: 2,
        tier: 'fast',
        input: {
          targetLang: 'en',
          nativeLang: 'it',
          explanationMode: 'target_simple',
          proficiencyFramework: 'CEFR',
          cefrLevel: 'B1',
          learnerText: 'I have went to the store yesterday.',
        },
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: 'consent_required' },
    });
  });

  it('rejects unknown prompts and invalid input', async () => {
    const { app } = createTestApp();
    const unknown = await app.request('/v1/ai/call', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        promptId: 'missing.prompt',
        promptVersion: 2,
        tier: 'fast',
        input: {},
      }),
    });
    expect(unknown.status).toBe(400);

    const invalid = await app.request('/v1/ai/call', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        promptId: 'correction.evaluate',
        promptVersion: 2,
        tier: 'fast',
        input: { learnerText: '' },
      }),
    });
    expect(invalid.status).toBe(400);
  });
});

describe('placement assessment API', () => {
  it('requires an onboarded profile', async () => {
    const { app } = createTestApp({ items: placementItems() });
    const response = await app.request('/v1/assessments/placement/start', {
      method: 'POST',
      headers: authHeaders,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'profile_required' } });
  });

  it('runs an adaptive placement and persists the result', async () => {
    const { app, account, assessments } = createTestApp({
      items: placementItems(),
      withProfile: true,
    });
    const started = await app.request('/v1/assessments/placement/start', {
      method: 'POST',
      headers: authHeaders,
    });
    expect(started.status).toBe(201);
    const start = startResponseSchema.parse(await started.json());
    expect(start.progress).toEqual({ answered: 0, target: 18 });

    const resumed = await app.request('/v1/assessments/placement/start', {
      method: 'POST',
      headers: authHeaders,
    });
    const resume = startResponseSchema.parse(await resumed.json());
    expect(resume.assessmentId).toBe(start.assessmentId);
    expect(resume.item.id).toBe(start.item.id);

    let itemId = start.item.id;
    let completed = false;
    let answered = 0;
    let overallLevel: string | null = null;
    let decisions: unknown = null;

    for (let index = 0; index < 30; index += 1) {
      const response = await app.request(`/v1/assessments/${start.assessmentId}/answer`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ itemId, optionId: index % 5 === 4 ? 'b' : 'a' }),
      });
      expect(response.status).toBe(200);
      const body = answerResponseSchema.parse(await response.json());
      answered = body.progress.answered;
      if (body.completed) {
        completed = true;
        overallLevel = body.result?.overallLevel ?? null;
        decisions = body.result?.decisions ?? null;
        expect(body.item).toBeNull();
        expect(body.result?.priorities).toHaveLength(3);
        break;
      }
      if (!body.item) throw new Error('missing next item');
      itemId = body.item.id;
    }

    expect(completed).toBe(true);
    expect(answered).toBe(18);
    expect(overallLevel).not.toBeNull();
    expect(assessments.scores).toHaveLength(4);
    expect(assessments.levelEvents[0]?.reason).toBe('placement');
    expect(assessments.levelEvents.length).toBeGreaterThanOrEqual(1);
    expect(assessments.skillStates).toHaveLength(4);
    expect(assessments.conceptStates).toHaveLength(18);
    expect(decisions).toBeDefined();
    const snapshot = await account.getSnapshot('user-1');
    expect(snapshot.profile?.proficiencyEstimate).toBe(overallLevel);
  });

  it('rejects unknown options and stale items', async () => {
    const { app } = createTestApp({ items: placementItems(), withProfile: true });
    const started = await app.request('/v1/assessments/placement/start', {
      method: 'POST',
      headers: authHeaders,
    });
    const start = startResponseSchema.parse(await started.json());

    const stale = await app.request(`/v1/assessments/${start.assessmentId}/answer`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ itemId: 'not-the-current-item', optionId: 'a' }),
    });
    expect(stale.status).toBe(409);

    const unknown = await app.request(`/v1/assessments/${start.assessmentId}/answer`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ itemId: start.item.id, optionId: 'missing' }),
    });
    expect(unknown.status).toBe(400);
  });
});
