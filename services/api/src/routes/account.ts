import { AiGatewayError, getPrompt, type AiGateway } from '@loqua/ai';
import {
  EXPORT_FORMAT_VERSION,
  EXPORT_SCHEMA_VERSION,
  canProcessAi,
  consentRecordSchema,
  createExportEnvelope,
  deviceSchema,
  generateUuidV7,
  learnerProfilePatchSchema,
  parseExportJson,
  registerDevice,
  type ConsentRecord,
  type ExportPayload,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import { aiErrorStatus } from '../http/ai-error.js';
import type { AccountRepository } from '../repos/account.js';
import { importAccount } from '../services/account/import.js';
import { buildProfile } from '../services/account/profile.js';

const consentsInputSchema = z.object({
  consents: z.array(consentRecordSchema).min(1).max(20),
});

const deviceInputSchema = deviceSchema.pick({ id: true, platform: true, name: true });

const aiCallSchema = z.object({
  promptId: z.string().min(1).max(120),
  promptVersion: z.number().int().positive(),
  tier: z.enum(['fast', 'balanced', 'reason', 'stt', 'tts']),
  input: z.unknown(),
  cacheKey: z.string().min(1).max(200).optional(),
});

const AI_CALL_PROMPT_ALLOWLIST: readonly string[] = ['correction.evaluate'];
const AI_CALL_MAX_INPUT_BYTES = 20_000;

export interface AccountRoutesDeps {
  readonly account: AccountRepository;
  readonly ai: AiGateway;
  readonly now: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createAccountRoutes(deps: AccountRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const now = deps.now;

  app.get('/me', (c) => c.json({ user: c.get('user') }));

  app.get('/profile', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    return c.json({ profile: snapshot.profile });
  });

  app.put('/profile', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = learnerProfilePatchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid profile payload'), 400);
    }

    const snapshot = await deps.account.getSnapshot(user.id);
    const built = buildProfile({
      existing: snapshot.profile,
      patch: parsed.data,
      userId: user.id,
      newId: generateUuidV7(),
      now: now().toISOString(),
    });
    if (!built.ok) {
      if (built.error === 'onboarding_incomplete') {
        return c.json(
          errorResponse(
            'onboarding_incomplete',
            'Creating a profile requires goal, daily minutes, timezone and interests',
          ),
          400,
        );
      }
      return c.json(errorResponse('invalid_request', 'Invalid profile payload'), 400);
    }

    await deps.account.upsertProfile(built.profile);
    return c.json({ profile: built.profile });
  });

  app.get('/consents', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    return c.json({ consents: snapshot.consents });
  });

  app.put('/consents', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = consentsInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid consents payload'), 400);
    }

    const snapshot = await deps.account.getSnapshot(user.id);
    const existing = new Map(
      snapshot.consents.map((consent) => [`${consent.kind}@${consent.version}`, consent]),
    );
    const records: ConsentRecord[] = [];
    for (const input of parsed.data.consents) {
      const current = existing.get(`${input.kind}@${input.version}`);
      const record: ConsentRecord = {
        ...input,
        id: current?.id ?? input.id,
        userId: user.id,
        createdAt: current?.createdAt ?? input.createdAt,
      };
      const validated = consentRecordSchema.safeParse(record);
      if (!validated.success) {
        return c.json(errorResponse('invalid_request', 'Invalid consents payload'), 400);
      }
      records.push(validated.data);
    }

    await deps.account.upsertConsents(records);
    return c.json({ consents: records });
  });

  app.post('/devices', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = deviceInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid device payload'), 400);
    }

    const registration = registerDevice([], {
      id: parsed.data.id,
      userId: user.id,
      platform: parsed.data.platform,
      name: parsed.data.name ?? null,
      now: now(),
    });
    if (!registration.ok) {
      return c.json(errorResponse('invalid_request', 'Invalid device payload'), 400);
    }
    const device = registration.value[0];
    if (!device) {
      return c.json(errorResponse('invalid_request', 'Invalid device payload'), 400);
    }

    await deps.account.upsertDevice(device);
    return c.json({ device }, 201);
  });

  app.get('/devices', async (c) => {
    const user = c.get('user');
    return c.json({ devices: await deps.account.listDevices(user.id) });
  });

  app.delete('/devices/:id', async (c) => {
    const user = c.get('user');
    const result = await deps.account.revokeDevice(user.id, c.req.param('id'), now());
    if (result === 'not_found') {
      return c.json(errorResponse('not_found', 'Device not found'), 404);
    }
    return c.json({ status: 'revoked' });
  });

  app.get('/account/export', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    const exportedAt = now();
    const payload: ExportPayload = {
      formatVersion: EXPORT_FORMAT_VERSION,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      userId: user.id,
      profile: snapshot.profile,
      consents: snapshot.consents,
      devices: snapshot.devices,
      settings: snapshot.settings,
      data: snapshot.data,
    };
    const envelope = await createExportEnvelope(payload);
    return c.json(envelope, 200, {
      'content-disposition': `attachment; filename="loqua-export-${exportedAt.toISOString().slice(0, 10)}.json"`,
    });
  });

  app.post('/account/import', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const raw = isRecord(body) && 'export' in body ? body.export : body;
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const parsed = await parseExportJson(text);
    if (!parsed.ok) {
      return c.json(errorResponse(parsed.error.code, parsed.error.message), 400);
    }
    if (parsed.value.userId !== user.id) {
      return c.json(errorResponse('owner_mismatch', 'Export belongs to a different account'), 403);
    }

    const imported = await importAccount({
      account: deps.account,
      userId: user.id,
      envelope: parsed.value,
      now: now(),
    });
    if (!imported.ok) {
      return c.json(errorResponse('invalid_payload', imported.message), 400);
    }

    return c.json({ status: 'imported', imported: imported.imported });
  });

  app.delete('/account', async (c) => {
    const user = c.get('user');
    const request = await deps.account.requestDelete(user.id, now());
    return c.json({ status: 'delete_scheduled', ...request }, 202);
  });

  app.post('/ai/call', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = aiCallSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid AI call payload'), 400);
    }

    let prompt;
    try {
      prompt = getPrompt(parsed.data.promptId, parsed.data.promptVersion);
    } catch {
      return c.json(errorResponse('unknown_prompt', 'Unknown prompt'), 400);
    }

    if (!AI_CALL_PROMPT_ALLOWLIST.includes(parsed.data.promptId)) {
      return c.json(errorResponse('prompt_not_allowed', 'Prompt not allowed'), 403);
    }

    const serializedInput = JSON.stringify(parsed.data.input) ?? '';
    if (serializedInput.length > AI_CALL_MAX_INPUT_BYTES) {
      return c.json(errorResponse('invalid_request', 'AI call input too large'), 400);
    }

    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!canProcessAi(snapshot.consents)) {
      return c.json(errorResponse('consent_required', 'AI processing consent is required'), 403);
    }

    try {
      const result = await deps.ai.call({
        promptId: parsed.data.promptId,
        promptVersion: parsed.data.promptVersion,
        tier: 'fast',
        input: parsed.data.input,
        schema: prompt.outputSchema,
        cacheKey: parsed.data.cacheKey,
        userId: user.id,
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        return c.json(errorResponse(error.code, error.message), aiErrorStatus(error.code));
      }
      return c.json(errorResponse('provider_error', 'AI call failed'), 502);
    }
  });

  return app;
}
