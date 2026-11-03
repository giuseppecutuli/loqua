import {
  ERROR_WINDOW_DAYS,
  applyAttempt,
  createConceptState,
  createSrsCard,
  generateUuidV7,
  isAnswerAccepted,
  masteryFromTheta,
  ratingForAttempt,
  reviewSrsCard,
  selectDrillItem,
  shouldTriggerErrorDrill,
  xpForAttempt,
  type SessionAttemptResponse,
  type SrsRating,
} from '@loqua/core';
import type { ConceptStateRecord } from '@loqua/db-postgres';

import type {
  ErrorEventRecord,
  SessionItemRecord,
  SessionRecord,
  SrsReviewRecord,
  XpEventRecord,
} from '../../repos/session.js';
import { loadItems, type SessionDeps } from './planning.js';
import { toCoreCard, toSrsCardRecord } from './srs.js';
import { currentView } from './view.js';

export interface SessionAttemptInput {
  readonly sessionItemId: string;
  readonly optionId?: string;
  readonly text?: string;
  readonly latencyMs?: number;
  readonly hintUsed?: boolean;
}

export interface SessionAttemptSuccess {
  readonly ok: true;
  readonly response: SessionAttemptResponse;
}

export interface SessionAttemptFailure {
  readonly ok: false;
  readonly status: 404 | 409 | 503;
  readonly code: string;
  readonly message: string;
}

export type SessionAttemptResult = SessionAttemptSuccess | SessionAttemptFailure;

export async function recordSessionAttempt(
  deps: SessionDeps,
  userId: string,
  sessionId: string,
  input: SessionAttemptInput,
): Promise<SessionAttemptResult> {
  const session = await deps.sessions.getSession(userId, sessionId);
  if (!session) {
    return { ok: false, status: 404, code: 'not_found', message: 'Session not found' };
  }
  if (session.status === 'completed' || session.status === 'abandoned') {
    return {
      ok: false,
      status: 409,
      code: 'session_finished',
      message: 'Session is already finished',
    };
  }

  const snapshot = await deps.account.getSnapshot(userId);
  if (!snapshot.profile) {
    return {
      ok: false,
      status: 409,
      code: 'profile_required',
      message: 'Complete onboarding first',
    };
  }

  const items = await deps.sessions.listSessionItems(userId, session.id);
  const sessionItem = items.find((item) => item.id === input.sessionItemId);
  if (!sessionItem || sessionItem.status !== 'pending') {
    return {
      ok: false,
      status: 409,
      code: 'stale_item',
      message: 'This is not a pending session item',
    };
  }
  const itemsById = await loadItems(deps, userId, session.targetLang);
  const item = itemsById.get(sessionItem.itemId);
  if (!item) {
    return {
      ok: false,
      status: 503,
      code: 'content_unavailable',
      message: 'Session item is unavailable',
    };
  }

  const answerMode = item.answerMode ?? 'mcq';
  const correct =
    answerMode === 'mcq'
      ? input.optionId === item.correctOptionId
      : input.text !== undefined &&
        item.options.some((option) => isAnswerAccepted(option.text, input.text ?? ''));
  const now = deps.now();
  const timestamp = now.toISOString();
  const skill = await deps.sessions.getSkillState(userId, item.skillId);
  const concept = await deps.sessions.getConceptState(userId, item.conceptId);
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
    userId,
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
    userId,
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
    : await deps.sessions.countErrorEvents(userId, item.conceptId, since);
  const errorEvent: ErrorEventRecord | null = correct
    ? null
    : {
        id: generateUuidV7(),
        userId,
        sessionId: session.id,
        source: 'exercise',
        span:
          input.text ??
          item.options.find((option) => option.id === input.optionId)?.text ??
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

  const xpEvent: XpEventRecord | null = correct
    ? {
        id: generateUuidV7(),
        userId,
        profileId: session.profileId,
        amount: xpForAttempt({
          correct,
          difficultyB: item.difficultyB,
          hintUsed: input.hintUsed ?? false,
        }),
        reason: 'correct_attempt',
        sourceType: 'item',
        sourceId: item.id,
        createdAt: timestamp,
      }
    : null;
  const rating: SrsRating = ratingForAttempt({
    correct,
    hintUsed: input.hintUsed ?? false,
    latencyMs: input.latencyMs ?? 0,
    p90LatencyMs: 4_000,
  });
  const cardType = answerMode === 'mcq' ? 'recognition' : 'production';
  const existingCard = await deps.sessions.findSrsCard(
    userId,
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
    userId,
    session.profileId,
    item.id,
    cardType,
    timestamp,
    existingCard?.createdAt ?? timestamp,
  );
  const srsReview: SrsReviewRecord = {
    id: generateUuidV7(),
    cardId: reviewed.card.id,
    userId,
    rating,
    reviewedAt: timestamp,
    elapsedDays: reviewed.review.elapsedDays,
    scheduledDays: reviewed.review.scheduledDays,
    durationMs: input.latencyMs ?? 0,
    createdAt: timestamp,
  };

  await deps.sessions.recordAttempt({
    attempt: {
      id: generateUuidV7(),
      userId,
      itemId: item.id,
      sessionId: session.id,
      sessionItemId: sessionItem.id,
      correct,
      score: correct ? 1 : 0,
      latencyMs: input.latencyMs ?? 0,
      hintUsed: input.hintUsed ?? false,
      response: {
        ...(input.optionId ? { optionId: input.optionId } : {}),
        ...(input.text ? { text: input.text } : {}),
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
    xpEvent,
  });

  let updatedItems: readonly SessionItemRecord[] = items.map((entry) =>
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
      const inserted = await deps.sessions.addSessionItems(userId, session.id, [
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

  return {
    ok: true,
    response: {
      session: currentView(updatedSession, updatedItems, itemsById),
      feedback: {
        correct,
        correctOptionId: item.correctOptionId,
        correctAnswer:
          item.options.find((option) => option.id === item.correctOptionId)?.text ?? null,
        explanation: item.explanation,
      },
    },
  };
}
