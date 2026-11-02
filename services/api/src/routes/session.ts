import {
  ERROR_WINDOW_DAYS,
  applyAttempt,
  buildDailySession,
  createConceptState,
  createSrsCard,
  dailyBacklogCap,
  isAnswerAccepted,
  ratingForAttempt,
  generateUuidV7,
  masteryFromTheta,
  reviewSrsCard,
  selectDrillItem,
  shouldTriggerErrorDrill,
  srsCardSchema,
  type AssessmentItem,
  type SessionBlockKind,
  type SessionCandidate,
  type SessionItemView,
  type SessionView,
  type SrsCard,
  type SrsRating,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import { toPublicItem } from '../items.js';
import type { AccountRepository } from '../repos/account.js';
import type { AssessmentStore } from '../repos/assessment.js';
import type { ConceptStateRecord } from '@loqua/db-postgres';
import type {
  ErrorEventRecord,
  SessionItemRecord,
  SessionRecord,
  SessionStore,
  SrsCardRecord,
  SrsReviewRecord,
} from '../repos/session.js';

export interface SessionRoutesDeps {
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

const attemptSchema = z
  .object({
    sessionItemId: z.string().min(1).max(120),
    optionId: z.string().min(1).max(40).optional(),
    text: z.string().trim().min(1).max(2000).optional(),
    latencyMs: z.number().int().nonnegative().max(600_000).optional(),
    hintUsed: z.boolean().optional(),
  })
  .refine((value) => value.optionId !== undefined || value.text !== undefined, {
    message: 'optionId or text is required',
  });

function sessionSize(dailyMinutes: number): number {
  return Math.min(16, Math.max(6, Math.round(dailyMinutes / 5)));
}

function narrowBlock(value: SessionItemRecord['block']): SessionBlockKind | null {
  switch (value) {
    case 'review':
    case 'input':
    case 'production':
      return value;
    default:
      return null;
  }
}

function currentView(
  session: SessionRecord,
  items: readonly SessionItemRecord[],
  itemsById: ReadonlyMap<string, AssessmentItem>,
): SessionView {
  const answered = items.filter((item) => item.status === 'answered').length;
  const pending = items.find((item) => item.status === 'pending');
  const item = pending ? itemsById.get(pending.itemId) : undefined;
  const block = pending ? narrowBlock(pending.block) : null;
  const current: SessionItemView | null =
    pending && item && block
      ? {
          id: pending.id,
          itemId: pending.itemId,
          block,
          rationale: pending.rationaleCode,
          status: pending.status,
          item: toPublicItem(item),
        }
      : null;
  return {
    id: session.id,
    status: session.status,
    total: items.length,
    answered,
    current,
  };
}

function toCoreCard(record: SrsCardRecord): SrsCard | null {
  const parsed = srsCardSchema.safeParse(record.fsrs);
  return parsed.success ? parsed.data : null;
}

function toSrsCardRecord(
  card: SrsCard,
  userId: string,
  profileId: string,
  itemId: string,
  cardType: 'recognition' | 'production',
  now: string,
  createdAt: string,
): SrsCardRecord {
  return {
    id: card.id,
    userId,
    profileId,
    cardType,
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
    createdAt,
    updatedAt: now,
    deletedAt: null,
  };
}

export function createSessionRoutes(deps: SessionRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  async function loadItems(userId: string, targetLang: string) {
    const items = await deps.assessments.listApprovedItems(userId, targetLang);
    return new Map(items.map((item) => [item.id, item]));
  }

  async function ensureSession(
    userId: string,
    profileId: string,
    targetLang: string,
    dailyMinutes: number,
  ) {
    const active = await deps.sessions.findActiveSession(userId, profileId);
    if (active) {
      const items = await deps.sessions.listSessionItems(userId, active.id);
      return { session: active, items, itemsById: await loadItems(userId, targetLang) };
    }

    const itemsById = await loadItems(userId, targetLang);
    const dueLimit = dailyBacklogCap(dailyMinutes);
    const dueCards = await deps.sessions.listDueSrsCards(userId, profileId, deps.now(), dueLimit);
    const candidates: SessionCandidate[] = [];
    for (const card of dueCards) {
      const item = itemsById.get(card.sourceId);
      if (!item) continue;
      candidates.push({
        itemId: item.id,
        skillId: item.skillId,
        skill: item.skill,
        conceptId: item.conceptId,
        difficultyB: item.difficultyB,
        sourceType: 'review',
        dueAt: card.dueAt,
      });
    }
    const backlogged = dueCards.length >= dueLimit;
    for (const item of itemsById.values()) {
      if (backlogged) continue;
      candidates.push({
        itemId: item.id,
        skillId: item.skillId,
        skill: item.skill,
        conceptId: item.conceptId,
        difficultyB: item.difficultyB,
        sourceType: 'foundation',
      });
    }

    const knownConceptIds = (await deps.sessions.listConceptStates(userId))
      .filter((state) => state.mastery >= 0.85)
      .map((state) => state.conceptId);
    const plan = buildDailySession({
      candidates,
      knownConceptIds,
      now: deps.now(),
      size: sessionSize(dailyMinutes),
    });
    if (plan.items.length === 0) return null;

    const timestamp = deps.now().toISOString();
    const session: SessionRecord = {
      id: generateUuidV7(),
      userId,
      profileId,
      targetLang,
      kind: 'lesson',
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
    const sessionItems: SessionItemRecord[] = plan.items.map((item, index) => ({
      id: generateUuidV7(),
      sessionId: session.id,
      itemId: item.itemId,
      block: item.block,
      sortOrder: index,
      rationaleCode: item.rationale,
      rationale: { sourceType: item.sourceType },
      status: 'pending',
      servedAt: null,
      answeredAt: null,
      createdAt: timestamp,
    }));
    const inserted = await deps.sessions.addSessionItems(userId, session.id, sessionItems);
    return { session, items: inserted, itemsById };
  }

  app.post('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const loaded = await ensureSession(
      user.id,
      snapshot.profile.id,
      snapshot.profile.targetLang,
      snapshot.profile.dailyMinutes,
    );
    if (!loaded) {
      return c.json(errorResponse('content_unavailable', 'No approved session items'), 503);
    }
    return c.json({ session: currentView(loaded.session, loaded.items, loaded.itemsById) }, 201);
  });

  app.get('/current', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const active = await deps.sessions.findActiveSession(user.id, snapshot.profile.id);
    if (!active) {
      return c.json({ session: null });
    }
    const items = await deps.sessions.listSessionItems(user.id, active.id);
    const itemsById = await loadItems(user.id, active.targetLang);
    return c.json({ session: currentView(active, items, itemsById) });
  });

  app.post('/:id/attempts', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = attemptSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid attempt payload'), 400);
    }

    const session = await deps.sessions.getSession(user.id, c.req.param('id'));
    if (!session) {
      return c.json(errorResponse('not_found', 'Session not found'), 404);
    }
    if (session.status === 'completed' || session.status === 'abandoned') {
      return c.json(errorResponse('session_finished', 'Session is already finished'), 409);
    }

    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }

    const items = await deps.sessions.listSessionItems(user.id, session.id);
    const sessionItem = items.find((item) => item.id === parsed.data.sessionItemId);
    if (!sessionItem || sessionItem.status !== 'pending') {
      return c.json(errorResponse('stale_item', 'This is not a pending session item'), 409);
    }
    const itemsById = await loadItems(user.id, session.targetLang);
    const item = itemsById.get(sessionItem.itemId);
    if (!item) {
      return c.json(errorResponse('content_unavailable', 'Session item is unavailable'), 503);
    }

    const answerMode = item.answerMode ?? 'mcq';
    const correct =
      answerMode === 'mcq'
        ? parsed.data.optionId === item.correctOptionId
        : parsed.data.text !== undefined &&
          item.options.some((option) => isAnswerAccepted(option.text, parsed.data.text ?? ''));
    const now = deps.now();
    const timestamp = now.toISOString();
    const skill = await deps.sessions.getSkillState(user.id, item.skillId);
    const concept = await deps.sessions.getConceptState(user.id, item.conceptId);
    const outcome = applyAttempt({
      skill: {
        theta: skill?.theta ?? 0,
        se: skill?.se ?? 1,
        nObs: skill?.nObs ?? 0,
      },
      concept: concept
        ? {
            conceptId: concept.conceptId,
            mastery: concept.mastery,
            evidenceCount: concept.evidenceCount,
            lastErrorAt: null,
            lastSeenAt: concept.lastSeenAt,
          }
        : createConceptState(item.conceptId),
      difficultyB: item.difficultyB,
      correct,
      now,
    });

    const skillState = {
      userId: user.id,
      skillId: item.skillId,
      theta: outcome.skill.theta,
      se: outcome.skill.se,
      nObs: outcome.skill.nObs,
      mastery: masteryFromTheta(outcome.skill.theta),
      lastSeenAt: timestamp,
      createdAt: skill?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const conceptState: ConceptStateRecord & { lastErrorAt: string | null } = {
      userId: user.id,
      conceptId: outcome.concept.conceptId,
      mastery: outcome.concept.mastery,
      evidenceCount: outcome.concept.evidenceCount,
      lastSeenAt: outcome.concept.lastSeenAt ?? timestamp,
      createdAt: concept?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastErrorAt: outcome.concept.lastErrorAt,
    };

    const since = new Date(now.getTime() - ERROR_WINDOW_DAYS * 86_400_000).toISOString();
    const previousErrors = correct
      ? 0
      : await deps.sessions.countErrorEvents(user.id, item.conceptId, since);
    const errorEvent: ErrorEventRecord | null = correct
      ? null
      : {
          id: generateUuidV7(),
          userId: user.id,
          sessionId: session.id,
          source: 'exercise',
          span:
            parsed.data.text ??
            item.options.find((option) => option.id === parsed.data.optionId)?.text ??
            item.prompt,
          errorType: item.conceptId,
          ruleId: null,
          severity: 'medium',
          confidence: 1,
          shownToUser: true,
          status: 'open',
          resolvedAt: null,
          createdAt: timestamp,
        };

    const rating: SrsRating = ratingForAttempt({
      correct,
      hintUsed: parsed.data.hintUsed ?? false,
      latencyMs: parsed.data.latencyMs ?? 0,
      p90LatencyMs: 4_000,
    });
    const cardType = answerMode === 'mcq' ? 'recognition' : 'production';
    const existingCard = await deps.sessions.findSrsCard(
      user.id,
      session.profileId,
      'item',
      item.id,
      cardType,
    );
    const baseCard =
      (existingCard ? toCoreCard(existingCard) : null) ??
      createSrsCard({ cardType, now, id: generateUuidV7() });
    const reviewed = reviewSrsCard({ card: baseCard, rating, now });
    const srsCard = toSrsCardRecord(
      reviewed.card,
      user.id,
      session.profileId,
      item.id,
      cardType,
      timestamp,
      existingCard?.createdAt ?? timestamp,
    );
    const srsReview: SrsReviewRecord = {
      id: generateUuidV7(),
      cardId: reviewed.card.id,
      userId: user.id,
      rating,
      reviewedAt: timestamp,
      elapsedDays: reviewed.review.elapsedDays,
      scheduledDays: reviewed.review.scheduledDays,
      durationMs: parsed.data.latencyMs ?? 0,
      createdAt: timestamp,
    };

    await deps.sessions.recordAttempt({
      attempt: {
        id: generateUuidV7(),
        userId: user.id,
        itemId: item.id,
        sessionId: session.id,
        sessionItemId: sessionItem.id,
        correct,
        score: correct ? 1 : 0,
        latencyMs: parsed.data.latencyMs ?? 0,
        hintUsed: parsed.data.hintUsed ?? false,
        response: {
          ...(parsed.data.optionId ? { optionId: parsed.data.optionId } : {}),
          ...(parsed.data.text ? { text: parsed.data.text } : {}),
        },
        createdAt: timestamp,
      },
      sessionItemId: sessionItem.id,
      sessionItemStatus: 'answered',
      sessionItemAnsweredAt: timestamp,
      skillState,
      conceptState,
      srsCard,
      srsReview,
      errorEvent,
    });

    let updatedItems = items.map((entry) =>
      entry.id === sessionItem.id ? { ...entry, status: 'answered' as const } : entry,
    );

    if (!correct && shouldTriggerErrorDrill(previousErrors)) {
      const used = new Set(updatedItems.map((entry) => entry.itemId));
      const drill = selectDrillItem(
        [...itemsById.values()].map((candidate) => ({
          itemId: candidate.id,
          skill: candidate.skill,
          conceptId: candidate.conceptId,
        })),
        used,
        item.id,
        item.skill,
        item.conceptId,
      );
      if (drill) {
        const inserted = await deps.sessions.addSessionItems(user.id, session.id, [
          {
            id: generateUuidV7(),
            sessionId: session.id,
            itemId: drill.itemId,
            block: 'review',
            sortOrder: updatedItems.length,
            rationaleCode: 'error_drill',
            rationale: { sourceType: 'foundation', triggerConceptId: item.conceptId },
            status: 'pending',
            servedAt: null,
            answeredAt: null,
            createdAt: timestamp,
          },
        ]);
        updatedItems = [...updatedItems, ...inserted];
      }
    }
    const finished = updatedItems.every((entry) => entry.status !== 'pending');
    const updatedSession: SessionRecord = finished
      ? {
          ...session,
          status: 'completed',
          endedAt: timestamp,
          updatedAt: timestamp,
          turns: session.turns + 1,
        }
      : { ...session, status: 'in_progress', updatedAt: timestamp, turns: session.turns + 1 };
    await deps.sessions.updateSession(updatedSession);

    return c.json({
      session: currentView(updatedSession, updatedItems, itemsById),
      feedback: {
        correct,
        correctOptionId: item.correctOptionId,
        correctAnswer:
          item.options.find((option) => option.id === item.correctOptionId)?.text ?? null,
        explanation: item.explanation,
      },
    });
  });

  return app;
}
