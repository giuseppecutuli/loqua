import { describe, expect, it } from 'vitest';

import {
  buildGamificationSnapshot,
  computeStreak,
  dayKey,
  levelFromXp,
  skillLevelFromMastery,
  xpForAttempt,
} from '../src/gamification.js';

describe('gamification', () => {
  it('awards more XP for harder correct answers and no XP for wrong ones', () => {
    expect(xpForAttempt({ correct: false, difficultyB: 0, hintUsed: false })).toBe(0);
    expect(xpForAttempt({ correct: true, difficultyB: 0, hintUsed: false })).toBeGreaterThan(
      xpForAttempt({ correct: true, difficultyB: -2, hintUsed: false }),
    );
    expect(xpForAttempt({ correct: true, difficultyB: 0, hintUsed: true })).toBeLessThan(
      xpForAttempt({ correct: true, difficultyB: 0, hintUsed: false }),
    );
  });

  it('derives a 1-10 game level from skill mastery', () => {
    expect(skillLevelFromMastery(0)).toBe(1);
    expect(skillLevelFromMastery(0.62)).toBe(6);
    expect(skillLevelFromMastery(1)).toBe(10);
  });

  it('levels from total XP', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(500)).toBeGreaterThan(1);
  });

  it('computes streaks with one grace day', () => {
    const streak = computeStreak({
      activeDays: ['2026-11-01', '2026-10-31', '2026-10-29'],
      today: '2026-11-02',
      mode: 'daily',
    });
    expect(streak.current).toBe(3);
    expect(streak.activeToday).toBe(false);
  });

  it('bridges a missed day with a streak repair', () => {
    const streak = computeStreak({
      activeDays: ['2026-10-30', '2026-11-01'],
      repairDays: ['2026-10-31'],
      today: '2026-11-01',
      mode: 'daily',
      graceDays: 0,
    });
    expect(streak.current).toBe(3);
  });

  it('does not break weekend-off streaks on weekends', () => {
    const streak = computeStreak({
      activeDays: ['2026-10-30', '2026-10-29'],
      today: '2026-11-02',
      mode: 'weekend_off',
    });
    expect(streak.current).toBeGreaterThanOrEqual(2);
  });

  it('builds today quests and badges', () => {
    const snapshot = buildGamificationSnapshot({
      now: new Date('2026-11-02T10:00:00.000Z'),
      timeZone: 'UTC',
      mode: 'daily',
      activeDays: ['2026-11-02'],
      xpEvents: [{ amount: 20, createdAt: '2026-11-02T09:00:00.000Z' }],
      attemptsToday: [{ correct: true, hintUsed: false, latencyMs: 1000 }],
      conversationsToday: 1,
    });
    expect(dayKey(new Date('2026-11-02T10:00:00.000Z'))).toBe('2026-11-02');
    expect(snapshot.xpToday).toBe(20);
    expect(snapshot.quests).toHaveLength(3);
    expect(snapshot.badges.some((badge) => badge.earned)).toBe(true);
  });
});
