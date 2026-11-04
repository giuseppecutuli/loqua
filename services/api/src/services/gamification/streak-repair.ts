import { dayKey, generateUuidV7 } from '@loqua/core';

import type { AccountRepository } from '../../repos/account.js';
import type { SessionRecord, SessionStore } from '../../repos/session.js';

const MIN_REPAIR_SECONDS = 5 * 60;
const REPAIR_COOLDOWN_DAYS = 30;
const ACTIVE_WINDOW_DAYS = 90;

export interface StreakRepairDeps {
  readonly account: AccountRepository;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function maybeRecordStreakRepair(
  deps: StreakRepairDeps,
  userId: string,
  session: SessionRecord,
): Promise<boolean> {
  if (!session.startedAt) return false;
  const now = deps.now();
  const elapsedSeconds = (now.getTime() - Date.parse(session.startedAt)) / 1000;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < MIN_REPAIR_SECONDS) return false;

  const snapshot = await deps.account.getSnapshot(userId);
  if (!snapshot.profile) return false;
  const timeZone = snapshot.profile.timezone;
  const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString();
  const [attempts, xpEvents] = await Promise.all([
    deps.sessions.listAttemptsSince(userId, since),
    deps.sessions.listXpEvents(userId, since),
  ]);

  const cooldownStart = now.getTime() - REPAIR_COOLDOWN_DAYS * 86_400_000;
  if (
    xpEvents.some(
      (event) =>
        event.reason === 'streak_repair' && Date.parse(event.createdAt) >= cooldownStart,
    )
  ) {
    return false;
  }

  const activeDays = new Set(
    attempts.map((attempt) => dayKey(new Date(attempt.createdAt), timeZone)),
  );
  const repairDays = new Set(
    xpEvents
      .filter((event) => event.reason === 'streak_repair')
      .map((event) => event.sourceId),
  );
  const today = dayKey(now, timeZone);
  const yesterday = previousDay(today);
  const dayBefore = previousDay(yesterday);
  const active = new Set([...activeDays, ...repairDays]);
  active.add(today);

  if (active.has(yesterday) || !active.has(dayBefore)) return false;

  await deps.sessions.addXpEvent({
    id: generateUuidV7(),
    userId,
    profileId: session.profileId,
    amount: 0,
    reason: 'streak_repair',
    sourceType: 'streak',
    sourceId: yesterday,
    createdAt: now.toISOString(),
  });
  return true;
}
