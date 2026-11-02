import { AiGatewayError, getPrompt, type AiGateway } from '@loqua/ai';
import {
  EXPORT_FORMAT_VERSION,
  EXPORT_SCHEMA_VERSION,
  canProcessAi,
  createExportEnvelope,
  type ExportPayload,
} from '@loqua/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { authMiddleware, type AppEnv, type JwtVerifier } from './auth.js';
import type { AccountRepository } from './repos/account.js';

export interface AppDeps {
  readonly ai: AiGateway;
  readonly auth: JwtVerifier;
  readonly account: AccountRepository;
  readonly now?: () => Date;
  readonly corsOrigins?: readonly string[];
}

const aiCallSchema = z.object({
  promptId: z.string().min(1).max(120),
  promptVersion: z.number().int().positive(),
  tier: z.enum(['fast', 'balanced', 'reason', 'stt', 'tts']),
  input: z.unknown(),
  cacheKey: z.string().min(1).max(200).optional(),
});

function errorResponse(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

function aiErrorStatus(code: AiGatewayError['code']): 400 | 402 | 502 {
  switch (code) {
    case 'unknown_prompt':
    case 'invalid_input':
      return 400;
    case 'budget_blocked':
      return 402;
    case 'provider_error':
    case 'schema_error':
      return 502;
  }
}

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const now = deps.now ?? (() => new Date());

  if (deps.corsOrigins && deps.corsOrigins.length > 0) {
    const allowed = new Set(deps.corsOrigins);
    app.use(
      '*',
      cors({
        origin: (origin) => (allowed.has(origin) ? origin : null),
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      }),
    );
  }

  app.get('/health', (c) => c.json({ status: 'ok', service: 'loqua-api', version: '0.1.0' }));

  app.use('/v1/*', authMiddleware(deps.auth));

  app.get('/v1/me', (c) => c.json({ user: c.get('user') }));

  app.get('/v1/account/export', async (c) => {
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

  app.delete('/v1/account', async (c) => {
    const user = c.get('user');
    const request = await deps.account.requestDelete(user.id, now());
    return c.json({ status: 'delete_scheduled', ...request }, 202);
  });

  app.get('/v1/devices', async (c) => {
    const user = c.get('user');
    return c.json({ devices: await deps.account.listDevices(user.id) });
  });

  app.delete('/v1/devices/:id', async (c) => {
    const user = c.get('user');
    const result = await deps.account.revokeDevice(user.id, c.req.param('id'), now());
    if (result === 'not_found') {
      return c.json(errorResponse('not_found', 'Device not found'), 404);
    }
    return c.json({ status: 'revoked' });
  });

  app.post('/v1/ai/call', async (c) => {
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

    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!canProcessAi(snapshot.consents)) {
      return c.json(
        errorResponse('consent_required', 'AI processing consent is required'),
        403,
      );
    }

    try {
      const result = await deps.ai.call({
        promptId: parsed.data.promptId,
        promptVersion: parsed.data.promptVersion,
        tier: parsed.data.tier,
        input: parsed.data.input,
        schema: prompt.outputSchema,
        cacheKey: parsed.data.cacheKey,
        userId: user.id,
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        return c.json(
          errorResponse(error.code, error.message),
          aiErrorStatus(error.code),
        );
      }
      return c.json(errorResponse('provider_error', 'AI call failed'), 502);
    }
  });

  app.notFound((c) => c.json(errorResponse('not_found', 'Route not found'), 404));

  app.onError((error, c) => {
    if (process.env.API_DEBUG_ERRORS === '1') {
      process.stderr.write(
        `[api] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
    }
    return c.json(errorResponse('internal', 'Internal error'), 500);
  });

  return app;
}
