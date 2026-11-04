import { createLearnerProfile, generateUuidV7 } from '@loqua/core';
import { describe, expect, it } from 'vitest';

import { InMemoryAccountRepository } from '../../repos/account.js';
import { InMemorySessionRepository } from '../../repos/session.js';
import { maybeRecordStreakRepair } from './streak-repair.js';

const now = new Date('2026-11-01T12:00:00.000Z');
const userId = 'user-1';
const profileId = 'profile-1';

function profile() {
  const result = createLearnerProfile(
    {
      goal: 'work',
      dailyMinutes: 20,
      timezone: 'UTC',
      interests: ['work'],
      selfAssessment: { grammar: 'B1' },
    },
    { id: profileId, userId, now },
  );
  if (!result.ok) throw new Error('profile fixture failed');
  return result.value;
}

describe('streak repair', () => {
  it('bridges yesterday after a 5-minute conversation once per cooldown', async () => {
    const account = new InMemoryAccountRepository();
    account.seed(userId, {
      profile: profile(),
      consents: [],
      devices: [],
      settings: null,
      data: {},
    });
    const sessions = new InMemorySessionRepository();
    await sessions.recordAttempt({
      attempt: {
        id: generateUuidV7(),
        userId,
        itemId: 'item-1',
        sessionId: null,
        sessionItemId: null,
        correct: true,
        score: 1,
        latencyMs: 1000,
        hintUsed: false,
        response: {},
        createdAt: '2026-10-30T10:00:00.000Z',
      },
    });
    const session = {
      id: 'conversation-1',
      userId,
      profileId,
      targetLang: 'en',
      scenarioId: 'bar',
      kind: 'conversation' as const,
      status: 'in_progress' as const,
      startedAt: '2026-11-01T11:54:00.000Z',
      endedAt: null,
      turns: 3,
      tokensIn: 100,
      tokensOut: 20,
      costUsd: 0.001,
      createdAt: '2026-11-01T11:54:00.000Z',
      updatedAt: '2026-11-01T11:54:00.000Z',
      deletedAt: null,
    };
    await sessions.createSession(session);

    const repaired = await maybeRecordStreakRepair(
      { account, sessions, now: () => now },
      userId,
      session,
    );
    expect(repaired).toBe(true);
    const events = await sessions.listXpEvents(userId, '1970-01-01T00:00:00.000Z');
    expect(events).toContainEqual(
      expect.objectContaining({ reason: 'streak_repair', sourceId: '2026-10-31' }),
    );

    const again = await maybeRecordStreakRepair(
      { account, sessions, now: () => now },
      userId,
      session,
    );
    expect(again).toBe(false);
  });
});
