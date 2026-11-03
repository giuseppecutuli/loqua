import {
  buildDailySession,
  dailyBacklogCap,
  generateUuidV7,
  type AssessmentItem,
  type SessionCandidate,
} from '@loqua/core';

import type { AccountRepository } from '../../repos/account.js';
import type { AssessmentStore } from '../../repos/assessment.js';
import type { SessionItemRecord, SessionRecord, SessionStore } from '../../repos/session.js';

export interface SessionDeps {
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

export interface LoadedSession {
  readonly session: SessionRecord;
  readonly items: readonly SessionItemRecord[];
  readonly itemsById: Map<string, AssessmentItem>;
}

function sessionSize(dailyMinutes: number): number {
  return Math.min(16, Math.max(6, Math.round(dailyMinutes / 5)));
}

export async function loadItems(
  deps: SessionDeps,
  userId: string,
  targetLang: string,
): Promise<Map<string, AssessmentItem>> {
  const items = await deps.assessments.listApprovedItems(userId, targetLang);
  return new Map(items.map((item) => [item.id, item]));
}

export async function ensureSession(
  deps: SessionDeps,
  userId: string,
  profileId: string,
  targetLang: string,
  dailyMinutes: number,
): Promise<LoadedSession | null> {
  const active = await deps.sessions.findActiveSession(userId, profileId);
  if (active) {
    const items = await deps.sessions.listSessionItems(userId, active.id);
    return { session: active, items, itemsById: await loadItems(deps, userId, targetLang) };
  }

  const itemsById = await loadItems(deps, userId, targetLang);
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
