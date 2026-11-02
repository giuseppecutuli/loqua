import { AiGatewayError, conversationTurnOutputSchema, type AiGateway } from '@loqua/ai';
import {
  CONVERSATION_SCENARIOS,
  getConversationScenario,
  type ConversationScenario,
} from '@loqua/content';
import {
  canProcessAi,
  generateUuidV7,
  type ConversationReply,
  type ConversationScenarioView,
  type ConversationView,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';
import type { SessionRecord, SessionStore, SessionTurnRecord } from '../repos/session.js';

export interface ConversationRoutesDeps {
  readonly ai: AiGateway;
  readonly account: AccountRepository;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

const startSchema = z.object({ scenarioId: z.string().min(1).max(120) });
const turnSchema = z.object({ text: z.string().min(1).max(2000) });

function scenarioView(scenario: ConversationScenario): ConversationScenarioView {
  return {
    id: scenario.id,
    level: scenario.level,
    title: scenario.title,
    setting: scenario.setting,
    goal: scenario.goal,
    learnerRole: scenario.learnerRole,
    tutorRole: scenario.tutorRole,
    register: scenario.register,
    targetPhrases: [...scenario.targetPhrases],
    openingLine: scenario.openingLine,
    maxTurns: scenario.maxTurns,
  };
}

function turnView(turn: SessionTurnRecord): ConversationView['turns'][number] {
  return {
    id: turn.id,
    role: turn.role,
    content: turn.content,
    createdAt: turn.createdAt,
  };
}

function conversationView(
  session: SessionRecord,
  turns: readonly SessionTurnRecord[],
  scenario: ConversationScenario,
): ConversationView {
  return {
    id: session.id,
    scenarioId: scenario.id,
    title: scenario.title,
    level: scenario.level,
    status: session.status,
    maxTurns: scenario.maxTurns,
    turns: turns.map(turnView),
  };
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

export function createConversationRoutes(deps: ConversationRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/scenarios', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    const targetLang = snapshot.profile?.targetLang ?? 'en';
    return c.json({
      scenarios: CONVERSATION_SCENARIOS.filter((scenario) => scenario.targetLang === targetLang).map(
        scenarioView,
      ),
    });
  });

  app.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid conversation payload'), 400);
    }
    const scenario = getConversationScenario(parsed.data.scenarioId);
    if (!scenario) {
      return c.json(errorResponse('not_found', 'Scenario not found'), 404);
    }
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    if (scenario.targetLang !== snapshot.profile.targetLang) {
      return c.json(errorResponse('language_mismatch', 'Scenario language does not match profile'), 400);
    }
    if (!canProcessAi(snapshot.consents)) {
      return c.json(errorResponse('consent_required', 'AI processing consent is required'), 403);
    }

    const now = deps.now();
    const timestamp = now.toISOString();
    const session: SessionRecord = {
      id: generateUuidV7(),
      userId: user.id,
      profileId: snapshot.profile.id,
      targetLang: scenario.targetLang,
      scenarioId: scenario.id,
      kind: 'conversation',
      status: 'in_progress',
      startedAt: timestamp,
      endedAt: null,
      turns: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    await deps.sessions.createSession(session);
    const opening = await deps.sessions.addSessionTurn(user.id, {
      id: generateUuidV7(),
      sessionId: session.id,
      role: 'tutor',
      content: scenario.openingLine,
      audioRef: null,
      transcriptMeta: null,
      createdAt: timestamp,
    });
    return c.json({ session: conversationView(session, [opening], scenario) }, 201);
  });

  app.get('/:id', async (c) => {
    const user = c.get('user');
    const session = await deps.sessions.getConversationSession(user.id, c.req.param('id'));
    if (!session || !session.scenarioId) {
      return c.json(errorResponse('not_found', 'Conversation not found'), 404);
    }
    const scenario = getConversationScenario(session.scenarioId);
    if (!scenario) return c.json(errorResponse('not_found', 'Scenario not found'), 404);
    const turns = await deps.sessions.listSessionTurns(user.id, session.id);
    return c.json({ session: conversationView(session, turns, scenario) });
  });

  app.post('/:id/turns', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = turnSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid conversation turn'), 400);
    }
    const session = await deps.sessions.getConversationSession(user.id, c.req.param('id'));
    if (!session || !session.scenarioId) {
      return c.json(errorResponse('not_found', 'Conversation not found'), 404);
    }
    if (session.status !== 'in_progress') {
      return c.json(errorResponse('session_finished', 'Conversation is already finished'), 409);
    }
    const scenario = getConversationScenario(session.scenarioId);
    if (!scenario) return c.json(errorResponse('not_found', 'Scenario not found'), 404);
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    if (!canProcessAi(snapshot.consents)) {
      return c.json(errorResponse('consent_required', 'AI processing consent is required'), 403);
    }

    const turns = await deps.sessions.listSessionTurns(user.id, session.id);
    const learnerTurns = turns.filter((turn) => turn.role === 'user').length;
    if (learnerTurns >= scenario.maxTurns) {
      return c.json(errorResponse('session_finished', 'Turn limit reached'), 409);
    }

    const now = deps.now();
    const timestamp = now.toISOString();
    const learnerTurn = await deps.sessions.addSessionTurn(user.id, {
      id: generateUuidV7(),
      sessionId: session.id,
      role: 'user',
      content: parsed.data.text,
      audioRef: null,
      transcriptMeta: null,
      createdAt: timestamp,
    });

    const recentTurns = [...turns, learnerTurn]
      .filter((turn) => turn.role === 'user' || turn.role === 'tutor')
      .slice(-8)
      .map((turn) => ({
        role: turn.role === 'user' ? ('learner' as const) : ('tutor' as const),
        content: turn.content,
      }));

    try {
      const result = await deps.ai.call({
        promptId: 'conversation.turn',
        promptVersion: 1,
        tier: 'fast',
        input: {
          targetLang: scenario.targetLang,
          nativeLang: snapshot.profile.nativeLang,
          explanationMode: snapshot.profile.explanationMode,
          proficiencyFramework: snapshot.profile.proficiencyFramework,
          level: scenario.level,
          scenario: {
            id: scenario.id,
            title: scenario.title,
            setting: scenario.setting,
            goal: scenario.goal,
            learnerRole: scenario.learnerRole,
            tutorRole: scenario.tutorRole,
            targetPhrases: scenario.targetPhrases,
            openingLine: scenario.openingLine,
          },
          recentTurns,
          learnerMessage: parsed.data.text,
        },
        schema: conversationTurnOutputSchema,
        userId: user.id,
      });

      const tutorTurn = await deps.sessions.addSessionTurn(user.id, {
        id: generateUuidV7(),
        sessionId: session.id,
        role: 'tutor',
        content: result.data.reply,
        audioRef: null,
        transcriptMeta: null,
        createdAt: timestamp,
      });
      const done = learnerTurns + 1 >= scenario.maxTurns;
      const updated: SessionRecord = {
        ...session,
        status: done ? 'completed' : 'in_progress',
        endedAt: done ? timestamp : null,
        turns: session.turns + 1,
        tokensIn: session.tokensIn + result.meta.tokensIn,
        tokensOut: session.tokensOut + result.meta.tokensOut,
        costUsd: session.costUsd + result.meta.costUsd,
        updatedAt: timestamp,
      };
      await deps.sessions.updateSession(updated);
      const allTurns = [...turns, learnerTurn, tutorTurn];
      const response: ConversationReply = {
        session: conversationView(updated, allTurns, scenario),
        reply: result.data.reply,
        hint: result.data.hint ?? null,
        done,
      };
      return c.json(response);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        return c.json(errorResponse(error.code, error.message), aiErrorStatus(error.code));
      }
      return c.json(errorResponse('provider_error', 'Conversation turn failed'), 502);
    }
  });

  app.post('/:id/complete', async (c) => {
    const user = c.get('user');
    const session = await deps.sessions.getConversationSession(user.id, c.req.param('id'));
    if (!session || !session.scenarioId) {
      return c.json(errorResponse('not_found', 'Conversation not found'), 404);
    }
    const timestamp = deps.now().toISOString();
    const updated: SessionRecord = {
      ...session,
      status: 'completed',
      endedAt: timestamp,
      updatedAt: timestamp,
    };
    await deps.sessions.updateSession(updated);
    const scenario = getConversationScenario(session.scenarioId);
    if (!scenario) return c.json(errorResponse('not_found', 'Scenario not found'), 404);
    const turns = await deps.sessions.listSessionTurns(user.id, session.id);
    return c.json({ session: conversationView(updated, turns, scenario) });
  });

  return app;
}
