import { AiGatewayError, getPrompt, type AiGateway } from '@loqua/ai';
import {
  EXPORT_FORMAT_VERSION,
  EXPORT_SCHEMA_VERSION,
  PLACEMENT_TOTAL_TARGET,
  buildPlacementResult,
  canProcessAi,
  createPlacementState,
  isPlacementComplete,
  recordPlacementAnswer,
  selectNextPlacementItem,
  consentRecordSchema,
  createExportEnvelope,
  deviceSchema,
  generateUuidV7,
  learnerProfileSchema,
  registerDevice,
  type AssessmentItem,
  type ConsentRecord,
  type ExportPayload,
  type LearnerProfile,
  type PlacementState,
} from '@loqua/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { authMiddleware, type AppEnv, type JwtVerifier } from './auth.js';
import type { AccountRepository } from './repos/account.js';
import type {
  AssessmentScoreRecord,
  AssessmentStore,
  LevelEventRecord,
  PlacementRecord,
  SkillStateRecord,
} from './repos/assessment.js';

export interface AppDeps {
  readonly ai: AiGateway;
  readonly auth: JwtVerifier;
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly now?: () => Date;
  readonly corsOrigins?: readonly string[];
}

const profileInputSchema = learnerProfileSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

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

const placementAnswerSchema = z.object({
  itemId: z.string().min(1).max(120),
  optionId: z.string().min(1).max(40),
});

function toPlacementItem(item: AssessmentItem): Record<string, unknown> {
  return {
    id: item.id,
    targetLang: item.targetLang,
    type: item.type,
    skill: item.skill,
    skillId: item.skillId,
    cefrLevel: item.cefrLevel,
    conceptId: item.conceptId,
    difficultyB: item.difficultyB,
    prompt: item.prompt,
    options: item.options,
  };
}

function placementSession(record: PlacementRecord, item: AssessmentItem): Record<string, unknown> {
  return {
    assessmentId: record.id,
    status: record.status,
    item: toPlacementItem(item),
    progress: {
      answered: record.raw.state.responses.length,
      target: PLACEMENT_TOTAL_TARGET,
    },
  };
}

function errorResponse(
  code: string,
  message: string,
): { error: { code: string; message: string } } {
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
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }),
    );
  }

  app.get('/health', (c) => c.json({ status: 'ok', service: 'loqua-api', version: '0.1.0' }));

  app.use('/v1/*', authMiddleware(deps.auth));

  app.get('/v1/me', (c) => c.json({ user: c.get('user') }));

  app.get('/v1/profile', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    return c.json({ profile: snapshot.profile });
  });

  app.put('/v1/profile', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = profileInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid profile payload'), 400);
    }

    const snapshot = await deps.account.getSnapshot(user.id);
    const timestamp = now().toISOString();
    const profile: LearnerProfile = {
      ...parsed.data,
      id: snapshot.profile?.id ?? generateUuidV7(),
      userId: user.id,
      createdAt: snapshot.profile?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    const validated = learnerProfileSchema.safeParse(profile);
    if (!validated.success) {
      return c.json(errorResponse('invalid_request', 'Invalid profile payload'), 400);
    }

    await deps.account.upsertProfile(validated.data);
    return c.json({ profile: validated.data });
  });

  app.get('/v1/consents', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    return c.json({ consents: snapshot.consents });
  });

  app.put('/v1/consents', async (c) => {
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

  app.post('/v1/devices', async (c) => {
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

  async function finalizePlacement(
    record: PlacementRecord,
    state: PlacementState,
    item: AssessmentItem,
    correct: boolean,
    timestamp: string,
    profile: LearnerProfile,
  ): Promise<Record<string, unknown>> {
    const result = buildPlacementResult(state);
    const completed: PlacementRecord = {
      ...record,
      status: 'completed',
      overallLevel: result.overallLevel,
      confidence: result.confidence,
      raw: { ...record.raw, state, currentItemId: null, result },
      completedAt: timestamp,
    };

    const scores: AssessmentScoreRecord[] = result.measured
      .filter((entry) => entry.measured)
      .map((entry) => ({
        id: generateUuidV7(),
        assessmentId: record.id,
        dimension: entry.skill,
        score: entry.score,
        confidence: entry.confidence,
        notes: entry.range,
        createdAt: timestamp,
      }));

    const skillIds = new Map<string, string>();
    for (const entry of Object.values(record.raw.items)) {
      skillIds.set(entry.skill, entry.skillId);
    }

    const skills: SkillStateRecord[] = result.measured
      .filter((entry) => entry.measured)
      .flatMap((entry) => {
        const skillId = skillIds.get(entry.skill);
        if (!skillId) return [];
        return [
          {
            userId: record.userId,
            skillId,
            theta: entry.theta,
            se: entry.se,
            nObs: entry.nObs,
            mastery: entry.score,
            lastSeenAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ];
      });

    const levelEvent: LevelEventRecord = {
      id: generateUuidV7(),
      userId: record.userId,
      profileId: record.profileId,
      skillId: null,
      fromLevel: profile.proficiencyEstimate,
      toLevel: result.overallLevel,
      reason: 'placement',
      detail: {
        overallTheta: result.overallTheta,
        overallRange: result.overallRange,
        confidence: result.confidence,
        priorities: result.priorities,
      },
      createdAt: timestamp,
    };

    await deps.assessments.completeAssessment({
      assessment: completed,
      scores,
      levelEvent,
      skills,
    });
    await deps.account.upsertProfile({
      ...profile,
      proficiencyEstimate: result.overallLevel,
      updatedAt: timestamp,
    });

    return {
      assessmentId: record.id,
      completed: true,
      feedback: {
        correct,
        correctOptionId: item.correctOptionId,
        explanation: item.explanation,
      },
      item: null,
      result,
      progress: {
        answered: state.responses.length,
        target: PLACEMENT_TOTAL_TARGET,
      },
    };
  }

  app.post('/v1/assessments/placement/start', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    const profile = snapshot.profile;
    if (!profile || !profile.onboardingCompleted) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }

    const active = await deps.assessments.findActivePlacement(user.id, profile.id);
    if (active) {
      const currentId = active.raw.currentItemId;
      const item = currentId ? active.raw.items[currentId] : undefined;
      if (!item) {
        return c.json(
          errorResponse('assessment_incomplete', 'Assessment has no current item'),
          409,
        );
      }
      return c.json(placementSession(active, item));
    }

    const candidates = await deps.assessments.listApprovedItems(user.id, profile.targetLang);
    if (candidates.length === 0) {
      return c.json(errorResponse('content_unavailable', 'No approved placement items'), 503);
    }

    const state = createPlacementState({
      targetLang: profile.targetLang,
      selfAssessment: profile.selfAssessment,
      now: now(),
    });
    const first = selectNextPlacementItem(state, candidates);
    if (!first) {
      return c.json(errorResponse('content_unavailable', 'No approved placement items'), 503);
    }

    const timestamp = now().toISOString();
    const record: PlacementRecord = {
      id: generateUuidV7(),
      userId: user.id,
      profileId: profile.id,
      targetLang: profile.targetLang,
      status: 'in_progress',
      overallLevel: null,
      confidence: null,
      raw: {
        state,
        items: { [first.id]: first },
        currentItemId: first.id,
      },
      createdAt: timestamp,
      completedAt: null,
    };
    await deps.assessments.createAssessment(record);
    return c.json(placementSession(record, first), 201);
  });

  app.post('/v1/assessments/:id/answer', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = placementAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid answer payload'), 400);
    }

    const record = await deps.assessments.getAssessment(user.id, c.req.param('id'));
    if (!record) {
      return c.json(errorResponse('not_found', 'Assessment not found'), 404);
    }
    if (record.status !== 'in_progress') {
      return c.json(errorResponse('assessment_finished', 'Assessment is already finished'), 409);
    }

    const currentId = record.raw.currentItemId;
    if (!currentId || currentId !== parsed.data.itemId) {
      return c.json(errorResponse('stale_item', 'This is not the current item'), 409);
    }
    const item = record.raw.items[currentId];
    if (!item) {
      return c.json(errorResponse('assessment_incomplete', 'Assessment item is missing'), 409);
    }
    if (!item.options.some((option) => option.id === parsed.data.optionId)) {
      return c.json(errorResponse('invalid_request', 'Unknown option'), 400);
    }

    const answeredAt = now();
    const outcome = recordPlacementAnswer(record.raw.state, item, parsed.data.optionId, answeredAt);

    let next: AssessmentItem | null = null;
    if (!isPlacementComplete(outcome.state)) {
      const candidates = await deps.assessments.listApprovedItems(user.id, record.targetLang);
      next = selectNextPlacementItem(outcome.state, candidates);
    }

    if (isPlacementComplete(outcome.state) || next === null) {
      const snapshot = await deps.account.getSnapshot(user.id);
      if (!snapshot.profile) {
        return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
      }
      const response = await finalizePlacement(
        record,
        outcome.state,
        item,
        outcome.correct,
        answeredAt.toISOString(),
        snapshot.profile,
      );
      return c.json(response);
    }

    const updated: PlacementRecord = {
      ...record,
      raw: {
        ...record.raw,
        state: outcome.state,
        items: { ...record.raw.items, [next.id]: next },
        currentItemId: next.id,
      },
    };
    await deps.assessments.updateAssessment(updated);

    return c.json({
      assessmentId: record.id,
      completed: false,
      feedback: {
        correct: outcome.correct,
        correctOptionId: item.correctOptionId,
        explanation: item.explanation,
      },
      item: toPlacementItem(next),
      result: null,
      progress: {
        answered: outcome.state.responses.length,
        target: PLACEMENT_TOTAL_TARGET,
      },
    });
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
      return c.json(errorResponse('consent_required', 'AI processing consent is required'), 403);
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
        return c.json(errorResponse(error.code, error.message), aiErrorStatus(error.code));
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
