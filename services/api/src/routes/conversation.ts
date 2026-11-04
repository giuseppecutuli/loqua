import {
  AiGatewayError,
  conversationTurnOutputSchema,
  correctionOutputSchema,
  type AiGateway,
} from '@loqua/ai';
import { RULES } from '@loqua/content';
import {
  CONVERSATION_SCENARIOS,
  getConversationScenario,
  type ConversationScenario,
} from '@loqua/content';
import {
  canProcessAi,
  canUseVoice,
  createSrsCard,
  isPromptInjection,
  isUnsafeConversationText,
  generateUuidV7,
  buildConversationContext,
  type ConversationReply,
  type ConversationReport,
  type ConversationScenarioView,
  type ConversationView,
  type LearnerProfile,
} from '@loqua/core';
import { upgradeWebSocket } from '@hono/node-server';
import { Hono } from 'hono';
import type { WSEvents, WSContext, WSMessageReceive } from 'hono/ws';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { maybeRecordStreakRepair } from '../services/gamification/streak-repair.js';
import {
  createStreamTicket,
  verifyStreamTicket,
  type StreamingTranscriberLike,
  type StreamingTurnEvent,
} from '../services/conversation/streaming.js';
import { errorResponse } from '../http.js';
import { aiErrorStatus } from '../http/ai-error.js';
import type { AccountRepository } from '../repos/account.js';
import type { AssessmentStore } from '../repos/assessment.js';
import type {
  ErrorEventRecord,
  SessionItemRecord,
  SessionRecord,
  SessionStore,
  SessionTurnRecord,
} from '../repos/session.js';

export interface ConversationRoutesDeps {
  readonly ai: AiGateway;
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly sessions: SessionStore;
  readonly transcribe?: (
    audio: Uint8Array,
    languageCode?: string,
  ) => Promise<{ text: string; durationSec: number; languageCode: string | null }>;
  readonly streamSecret?: string;
  readonly createStreamingTranscriber?: (opts: {
    readonly languageCode: string;
    readonly sampleRate: number;
  }) => StreamingTranscriberLike;
  readonly now: () => Date;
}

const CONVERSATION_DAILY_TURNS = 40;
const STREAM_SAMPLE_RATE = 16_000;
const MAX_STREAM_MS = 120_000;
const MAX_AUDIO_CHUNK_BYTES = 64 * 1024;
const MAX_TOTAL_AUDIO_BYTES = STREAM_SAMPLE_RATE * 2 * 120;

const startSchema = z.object({ scenarioId: z.string().min(1).max(120) });
const turnSchema = z.object({ text: z.string().min(1).max(2000) });
const voiceTurnSchema = z.object({
  audioBase64: z.string().min(1).max(8_000_000),
  durationSec: z.number().positive().max(120),
});

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

async function submitLearnerTurn(
  deps: ConversationRoutesDeps,
  userId: string,
  session: SessionRecord,
  scenario: ConversationScenario,
  profile: LearnerProfile,
  text: string,
  timestamp: string,
): Promise<ConversationReply> {
  const startedAt = Date.now();
  const turns = await deps.sessions.listSessionTurns(userId, session.id);
  const learnerTurns = turns.filter((turn) => turn.role === 'user').length;
  if (learnerTurns >= scenario.maxTurns) {
    throw new ConversationTurnLimitError();
  }
  const context = buildConversationContext(turns, {
    maxRecentTurns: 8,
    maxChars: 6_000,
  });
  const result = await deps.ai.call({
    promptId: 'conversation.turn',
    promptVersion: 1,
    tier: 'fast',
    input: {
      targetLang: scenario.targetLang,
      nativeLang: profile.nativeLang,
      explanationMode: profile.explanationMode,
      proficiencyFramework: profile.proficiencyFramework,
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
      recentTurns: context.recentTurns,
      olderSummary: context.olderSummary,
      learnerMessage: text,
    },
    schema: conversationTurnOutputSchema,
    userId,
  });
  if (isUnsafeConversationText(result.data.reply)) {
    throw new ConversationModerationError();
  }
  const learnerTurn = await deps.sessions.addSessionTurn(userId, {
    id: generateUuidV7(),
    sessionId: session.id,
    role: 'user',
    content: text,
    audioRef: null,
    transcriptMeta: null,
    createdAt: timestamp,
  });
  const tutorTurn = await deps.sessions.addSessionTurn(userId, {
    id: generateUuidV7(),
    sessionId: session.id,
    role: 'tutor',
    content: result.data.reply,
    audioRef: null,
    transcriptMeta: {
      latencyMs: Date.now() - startedAt,
      promptId: 'conversation.turn',
      promptVersion: 1,
      tokensIn: result.meta.tokensIn,
      tokensOut: result.meta.tokensOut,
      costUsd: result.meta.costUsd,
    },
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
  if (done) {
    await maybeRecordStreakRepair(deps, userId, updated);
  }
  return {
    session: conversationView(updated, [...turns, learnerTurn, tutorTurn], scenario),
    reply: result.data.reply,
    hint: result.data.hint ?? null,
    done,
    meta: {
      latencyMs: Date.now() - startedAt,
      costUsd: result.meta.costUsd,
      tokensIn: result.meta.tokensIn,
      tokensOut: result.meta.tokensOut,
    },
  };
}

class ConversationTurnLimitError extends Error {}
class ConversationModerationError extends Error {}

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

  app.post('/:id/stream-ticket', async (c) => {
    const user = c.get('user');
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
    if (!canUseVoice(snapshot.consents)) {
      return c.json(errorResponse('voice_consent_required', 'Voice consent is required'), 403);
    }
    if (!deps.streamSecret || !deps.createStreamingTranscriber) {
      return c.json(errorResponse('streaming_unavailable', 'Streaming is not configured'), 503);
    }
    return c.json(
      createStreamTicket(
        { userId: user.id, conversationId: session.id, now: deps.now() },
        deps.streamSecret,
      ),
    );
  });

  app.get('/:id/stream', upgradeWebSocket(async (c): Promise<WSEvents> => {
    const invalidTicketEvents = (): WSEvents => ({
      onOpen: (_event, ws) => ws.close(1008, 'invalid_ticket'),
    });

    const secret = deps.streamSecret;
    const createTranscriber = deps.createStreamingTranscriber;
    if (!secret || !createTranscriber) return invalidTicketEvents();

    const conversationId = c.req.param('id') ?? '';
    const claims = verifyStreamTicket(
      {
        ticket: c.req.query('ticket') ?? '',
        conversationId,
        now: deps.now(),
      },
      secret,
    );
    if (!claims) return invalidTicketEvents();

    const session = await deps.sessions.getConversationSession(claims.userId, claims.conversationId);
    const scenario = session?.scenarioId ? getConversationScenario(session.scenarioId) : null;
    if (!session || !scenario || session.status !== 'in_progress') {
      return invalidTicketEvents();
    }
    const snapshot = await deps.account.getSnapshot(claims.userId);
    const profile = snapshot.profile;
    if (
      !profile ||
      !canProcessAi(snapshot.consents) ||
      !canUseVoice(snapshot.consents)
    ) {
      return invalidTicketEvents();
    }

    let transcriber: StreamingTranscriberLike | null = null;
    let closed = false;
    let finalized = false;
    let processing = false;
    let stopRequested = false;
    let totalBytes = 0;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): void => {
      if (maxTimer) {
        clearTimeout(maxTimer);
        maxTimer = null;
      }
      const current = transcriber;
      transcriber = null;
      if (current) void current.close(false).catch(() => {});
    };

    const fail = (ws: WSContext, code: string): void => {
      if (closed) return;
      closed = true;
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'error', code }));
        }
      } catch {
        // Socket may already be gone.
      }
      try {
        ws.close(1011, 'stream_error');
      } catch {
        // Socket may already be gone.
      }
      cleanup();
    };

    const sendTurn = (ws: WSContext, reply: ConversationReply): void => {
      closed = true;
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'turn', ...reply }));
          ws.close(1000, 'completed');
        }
      } catch {
        // Socket may already be gone.
      }
      cleanup();
    };

    const finalizeTurn = async (ws: WSContext, transcript: string): Promise<void> => {
      if (closed || finalized || processing) return;
      const text = transcript.trim();
      if (text.length === 0) {
        if (stopRequested) {
          closed = true;
          ws.close(1000, 'stopped');
          cleanup();
        }
        return;
      }
      processing = true;
      try {
        const reply = await submitLearnerTurn(
          deps,
          claims.userId,
          session,
          scenario,
          profile,
          text,
          deps.now().toISOString(),
        );
        finalized = true;
        processing = false;
        sendTurn(ws, reply);
      } catch (error) {
        processing = false;
        const code =
          error instanceof ConversationTurnLimitError
            ? 'session_finished'
            : error instanceof ConversationModerationError
              ? 'moderation_blocked'
              : 'turn_failed';
        fail(ws, code);
      }
    };

    const handleTurn = (ws: WSContext, event: StreamingTurnEvent): void => {
      if (typeof event.transcript !== 'string') return;
      if (!event.end_of_turn) {
        if (event.transcript.trim().length > 0 && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'partial', transcript: event.transcript }));
        }
        return;
      }
      void finalizeTurn(ws, event.transcript);
    };

    const sendAudio = (ws: WSContext, chunk: Uint8Array): void => {
      if (closed || !transcriber) return;
      if (chunk.byteLength === 0) return;
      if (chunk.byteLength > MAX_AUDIO_CHUNK_BYTES) {
        fail(ws, 'audio_chunk_too_large');
        return;
      }
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_TOTAL_AUDIO_BYTES) {
        fail(ws, 'audio_too_long');
        return;
      }
      try {
        transcriber.sendAudio(chunk);
      } catch {
        fail(ws, 'transcription_failed');
      }
    };

    const handleText = async (ws: WSContext, raw: string): Promise<void> => {
      let message: unknown;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      const rawType =
        typeof message === 'object' && message !== null ? Reflect.get(message, 'type') : null;
      const type = typeof rawType === 'string' ? rawType : '';
      if (type === 'ping') {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      if (type !== 'stop') return;
      stopRequested = true;
      const current = transcriber;
      if (!current) {
        closed = true;
        ws.close(1000, 'stopped');
        cleanup();
        return;
      }
      try {
        await current.close(true);
      } catch {
        // The final turn may still be delivered.
      }
      if (!finalized && !processing && !closed) {
        closed = true;
        ws.close(1000, 'stopped');
        cleanup();
      }
    };

    const handleBinary = (ws: WSContext, data: ArrayBufferLike | ArrayBufferView): void => {
      if (ArrayBuffer.isView(data)) {
        sendAudio(ws, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        return;
      }
      sendAudio(ws, new Uint8Array(data));
    };

    const handleMessage = (data: WSMessageReceive, ws: WSContext): void => {
      if (typeof data === 'string') {
        void handleText(ws, data);
        return;
      }
      if (data instanceof Blob) {
        void data
          .arrayBuffer()
          .then((buffer) => sendAudio(ws, new Uint8Array(buffer)))
          .catch(() => fail(ws, 'transcription_failed'));
        return;
      }
      handleBinary(ws, data);
    };

    return {
      onOpen: async (_event, ws) => {
        if (closed) return;
        maxTimer = setTimeout(() => fail(ws, 'stream_timeout'), MAX_STREAM_MS);
        try {
          const instance = createTranscriber({
            languageCode: scenario.targetLang,
            sampleRate: STREAM_SAMPLE_RATE,
          });
          transcriber = instance;
          instance.on('turn', (event) => handleTurn(ws, event));
          instance.on('error', () => fail(ws, 'transcription_failed'));
          await instance.connect();
          if (!closed && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'ready' }));
          }
        } catch {
          fail(ws, 'streaming_connection_failed');
        }
      },
      onMessage: (event, ws) => handleMessage(event.data, ws),
      onClose: () => {
        closed = true;
        cleanup();
      },
    };
  }));

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
    const quotaSince = new Date(deps.now().getTime() - 86_400_000).toISOString();
    if ((await deps.sessions.countConversationTurnsSince(user.id, quotaSince)) >= CONVERSATION_DAILY_TURNS) {
      return c.json(errorResponse('turn_quota', 'Daily conversation turn quota reached'), 429);
    }

    if (isPromptInjection(parsed.data.text) || isUnsafeConversationText(parsed.data.text)) {
      return c.json(errorResponse('unsafe_input', 'Message rejected by moderation'), 422);
    }
    try {
      return c.json(
        await submitLearnerTurn(
          deps,
          user.id,
          session,
          scenario,
          snapshot.profile,
          parsed.data.text,
          deps.now().toISOString(),
        ),
      );
    } catch (error) {
      if (error instanceof ConversationTurnLimitError) {
        return c.json(errorResponse('session_finished', 'Turn limit reached'), 409);
      }
      if (error instanceof ConversationModerationError) {
        return c.json(errorResponse('moderation_blocked', 'Reply rejected by moderation'), 502);
      }
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
    await maybeRecordStreakRepair(deps, user.id, updated);
    const scenario = getConversationScenario(session.scenarioId);
    if (!scenario) return c.json(errorResponse('not_found', 'Scenario not found'), 404);
    const turns = await deps.sessions.listSessionTurns(user.id, session.id);
    return c.json({ session: conversationView(updated, turns, scenario) });
  });

  app.post('/:id/turns/voice', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = voiceTurnSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid voice turn payload'), 400);
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
    if (!canUseVoice(snapshot.consents)) {
      return c.json(errorResponse('voice_consent_required', 'Voice consent is required'), 403);
    }
    const quotaSince = new Date(deps.now().getTime() - 86_400_000).toISOString();
    if ((await deps.sessions.countConversationTurnsSince(user.id, quotaSince)) >= CONVERSATION_DAILY_TURNS) {
      return c.json(errorResponse('turn_quota', 'Daily conversation turn quota reached'), 429);
    }
    if (!deps.transcribe) {
      return c.json(errorResponse('stt_unavailable', 'Speech-to-text is not configured'), 503);
    }

    const audio = Buffer.from(parsed.data.audioBase64, 'base64');
    if (audio.byteLength < 200) {
      return c.json(errorResponse('invalid_audio', 'Audio is empty or too short'), 400);
    }
    let transcription;
    try {
      transcription = await deps.transcribe(audio, scenario.targetLang);
    } catch {
      return c.json(errorResponse('transcription_failed', 'Could not transcribe audio'), 502);
    }
    if (transcription.text.trim().length === 0) {
      return c.json(errorResponse('empty_transcript', 'No speech detected'), 422);
    }
    if (
      isPromptInjection(transcription.text) ||
      isUnsafeConversationText(transcription.text)
    ) {
      return c.json(errorResponse('unsafe_input', 'Message rejected by moderation'), 422);
    }

    try {
      const reply = await submitLearnerTurn(
        deps,
        user.id,
        session,
        scenario,
        snapshot.profile,
        transcription.text.trim(),
        deps.now().toISOString(),
      );
      return c.json({ ...reply, transcript: transcription.text.trim() });
    } catch (error) {
      if (error instanceof ConversationTurnLimitError) {
        return c.json(errorResponse('session_finished', 'Turn limit reached'), 409);
      }
      if (error instanceof ConversationModerationError) {
        return c.json(errorResponse('moderation_blocked', 'Reply rejected by moderation'), 502);
      }
      if (error instanceof AiGatewayError) {
        return c.json(errorResponse(error.code, error.message), aiErrorStatus(error.code));
      }
      return c.json(errorResponse('provider_error', 'Conversation turn failed'), 502);
    }
  });

  app.post('/:id/report', async (c) => {
    const user = c.get('user');
    const session = await deps.sessions.getConversationSession(user.id, c.req.param('id'));
    if (!session || !session.scenarioId) {
      return c.json(errorResponse('not_found', 'Conversation not found'), 404);
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
    const learnerTurns = turns.filter((turn) => turn.role === 'user').slice(-3);
    const corrections: ConversationReport['corrections'] = [];
    try {
      for (const turn of learnerTurns) {
        const result = await deps.ai.call({
          promptId: 'correction.evaluate',
          promptVersion: 2,
          tier: 'fast',
          input: {
            targetLang: scenario.targetLang,
            nativeLang: snapshot.profile.nativeLang,
            explanationMode: snapshot.profile.explanationMode,
            proficiencyFramework: snapshot.profile.proficiencyFramework,
            cefrLevel: scenario.level,
            learnerText: turn.content,
            scenario: scenario.goal,
          },
          schema: correctionOutputSchema,
          userId: user.id,
        });
        for (const correction of result.data.corrections) {
          if (corrections.length >= 5) break;
          if (!turn.content.includes(correction.span)) continue;
          if (!RULES.some((rule) => rule.id === correction.ruleId)) continue;
          corrections.push(correction);
        }
      }
    } catch (error) {
      if (error instanceof AiGatewayError) {
        return c.json(errorResponse(error.code, error.message), aiErrorStatus(error.code));
      }
      return c.json(errorResponse('provider_error', 'Report generation failed'), 502);
    }

    const timestamp = deps.now().toISOString();
    const sinceEpoch = '1970-01-01T00:00:00.000Z';
    const existingErrors = await deps.sessions.listErrorEventsSince(user.id, sinceEpoch);
    const seenErrors = new Set(
      existingErrors
        .filter((event) => event.sessionId === session.id)
        .map((event) => `${event.span}|${event.ruleId ?? ''}`),
    );
    for (const correction of corrections) {
      const key = `${correction.span}|${correction.ruleId}`;
      if (seenErrors.has(key)) continue;
      seenErrors.add(key);
      const event: ErrorEventRecord = {
        id: generateUuidV7(),
        userId: user.id,
        sessionId: session.id,
        source: 'conversation',
        span: correction.span,
        errorType: correction.errorType,
        ruleId: correction.ruleId,
        severity: correction.severity,
        confidence: correction.confidence,
        shownToUser: true,
        status: 'open',
        resolvedAt: null,
        createdAt: timestamp,
      };
      await deps.sessions.addErrorEvent(event);
    }

    const drillByItem = new Map<string, { itemId: string; ruleId: string }>();
    for (const ruleId of [...new Set(corrections.map((correction) => correction.ruleId))]) {
      const items = await deps.assessments.findItemsByConcept(
        user.id,
        snapshot.profile.targetLang,
        ruleId,
        1,
      );
      const item = items[0];
      if (item) drillByItem.set(item.id, { itemId: item.id, ruleId });
    }
    if (drillByItem.size > 0) {
      const active = await deps.sessions.findActiveSession(user.id, snapshot.profile.id);
      const sessionRecord: SessionRecord =
        active ?? {
          id: generateUuidV7(),
          userId: user.id,
          profileId: snapshot.profile.id,
          targetLang: snapshot.profile.targetLang,
          kind: 'micro',
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
      if (!active) await deps.sessions.createSession(sessionRecord);
      const existing = active
        ? await deps.sessions.listSessionItems(user.id, sessionRecord.id)
        : [];
      const used = new Set(existing.map((item) => item.itemId));
      const newItems: SessionItemRecord[] = [];
      let order = existing.length;
      for (const { itemId, ruleId } of drillByItem.values()) {
        if (used.has(itemId)) continue;
        used.add(itemId);
        newItems.push({
          id: generateUuidV7(),
          sessionId: sessionRecord.id,
          itemId,
          block: 'review',
          sortOrder: order,
          rationaleCode: 'error_drill',
          rationale: { sourceType: 'foundation', ruleId },
          status: 'pending',
          servedAt: null,
          answeredAt: null,
          createdAt: timestamp,
        });
        order += 1;
        const existingCard = await deps.sessions.findSrsCard(
          user.id,
          snapshot.profile.id,
          'item',
          itemId,
          'production',
        );
        if (!existingCard) {
          const card = createSrsCard({ cardType: 'production', now: deps.now(), id: generateUuidV7() });
          await deps.sessions.upsertSrsCard({
            id: card.id,
            userId: user.id,
            profileId: snapshot.profile.id,
            cardType: 'production',
            sourceType: 'item',
            sourceId: itemId,
            fsrs: { ...card },
            dueAt: card.dueAt,
            state: card.state,
            stability: card.stability,
            difficulty: card.difficulty,
            reps: card.reps,
            lapses: card.lapses,
            suspended: card.suspended,
            leech: card.leech,
            lastReviewAt: card.lastReviewAt,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          });
        }
      }
      if (newItems.length > 0) {
        await deps.sessions.addSessionItems(user.id, sessionRecord.id, newItems);
      }
    }

    const report: ConversationReport = {
      corrections,
      focusPoints: [...new Set(corrections.map((correction) => correction.errorType))].slice(0, 3),
      usefulPhrases: scenario.targetPhrases.slice(0, 8),
    };
    return c.json({ report });
  });

  return app;
}
