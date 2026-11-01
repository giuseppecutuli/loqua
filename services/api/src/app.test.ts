import { describe, expect, it } from 'vitest';

import {
  createGateway,
  InMemoryCostSink,
  type AiProvider,
  type ProviderRequest,
  type ProviderResponse,
} from '@loqua/ai';
import { parseExportJson, registerDevice } from '@loqua/core';

import { createApp } from './app.js';
import type { JwtVerifier } from './auth.js';
import { InMemoryAccountRepository } from './repos/account.js';

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

function createTestApp() {
  const verifier: JwtVerifier = async (token) => {
    if (token !== 'good-token') throw new Error('bad token');
    return { id: 'user-1', email: 'a@example.test', role: 'authenticated', isAnonymous: false };
  };
  const account = new InMemoryAccountRepository();
  const registration = registerDevice([], {
    id: 'device-1',
    userId: 'user-1',
    platform: 'web',
    name: 'Browser',
    now,
  });
  if (!registration.ok) throw new Error(registration.error);
  account.seed('user-1', {
    profile: null,
    consents: [],
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
    now: () => now,
    corsOrigins: ['http://localhost:8081'],
  });
  return { app, costs };
}

const authHeaders = { authorization: 'Bearer good-token', 'content-type': 'application/json' };

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
    expect(
      (await app.request('/v1/me', { headers: { authorization: 'Bearer bad' } })).status,
    ).toBe(401);
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
        promptVersion: 1,
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

  it('rejects unknown prompts and invalid input', async () => {
    const { app } = createTestApp();
    const unknown = await app.request('/v1/ai/call', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        promptId: 'missing.prompt',
        promptVersion: 1,
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
        promptVersion: 1,
        tier: 'fast',
        input: { learnerText: '' },
      }),
    });
    expect(invalid.status).toBe(400);
  });
});
