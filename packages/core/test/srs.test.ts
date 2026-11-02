import { describe, expect, it } from 'vitest';

import {
  LEECH_LAPSE_THRESHOLD,
  SRS_MAX_INTERVAL_DAYS,
  SUSPEND_LAPSE_THRESHOLD,
  dailyBacklogCap,
  isAnswerAccepted,
  ratingForAttempt,
  createSrsCard,
  isSrsCardDue,
  reviewSrsCard,
  suspendSrsCard,
  unsuspendSrsCard,
  type SrsCard,
} from '../src/srs.js';

const now = new Date('2026-11-02T10:00:00.000Z');

function dueTime(card: SrsCard): number {
  return Date.parse(card.dueAt);
}

describe('srs operational rules', () => {
  it('normalizes case, punctuation, whitespace, and apostrophes', () => {
    expect(isAnswerAccepted('I have gone.', ' i HAVE gone ')).toBe(true);
    expect(isAnswerAccepted("don't", 'do not')).toBe(true);
  });

  it('allows one typo only for short answers', () => {
    expect(isAnswerAccepted('went', 'wemt')).toBe(true);
    expect(isAnswerAccepted('is', 'in')).toBe(false);
    expect(isAnswerAccepted('no', 'go')).toBe(false);
    expect(isAnswerAccepted('cat', 'bat')).toBe(false);
    expect(isAnswerAccepted('environment', 'enviroment')).toBe(false);
  });

  it('lowers the rating for hints and slow answers', () => {
    expect(ratingForAttempt({ correct: true, hintUsed: false, latencyMs: 1000, p90LatencyMs: 5000 })).toBe(4);
    expect(ratingForAttempt({ correct: true, hintUsed: true, latencyMs: 1000 })).toBe(3);
    expect(ratingForAttempt({ correct: true, hintUsed: true, latencyMs: 9000, p90LatencyMs: 5000 })).toBe(2);
    expect(ratingForAttempt({ correct: false, hintUsed: false, latencyMs: 100 })).toBe(1);
  });

  it('caps the daily backlog', () => {
    expect(dailyBacklogCap(20)).toBe(40);
    expect(dailyBacklogCap(60)).toBe(60);
  });
});

describe('srs card creation', () => {
  it('creates new recognition and production cards due at the injected clock', () => {
    const recognition = createSrsCard({ cardType: 'recognition', now, id: 'card-recognition' });
    const production = createSrsCard({ cardType: 'production', now, id: 'card-production' });

    expect(recognition.id).toBe('card-recognition');
    expect(recognition.cardType).toBe('recognition');
    expect(production.cardType).toBe('production');
    for (const card of [recognition, production]) {
      expect(card.dueAt).toBe(now.toISOString());
      expect(card.state).toBe('new');
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.leech).toBe(false);
      expect(card.suspended).toBe(false);
      expect(isSrsCardDue(card, now)).toBe(true);
    }
  });
});

describe('fsrs scheduling', () => {
  it('schedules Good later than Again for the same card', () => {
    const card = createSrsCard({ cardType: 'recognition', now });
    const again = reviewSrsCard({ card, rating: 1, now });
    const hard = reviewSrsCard({ card, rating: 2, now });
    const good = reviewSrsCard({ card, rating: 3, now });
    const easy = reviewSrsCard({ card, rating: 4, now });

    expect(dueTime(good.card)).toBeGreaterThan(dueTime(again.card));
    expect(dueTime(hard.card)).toBeGreaterThan(dueTime(again.card));
    expect(dueTime(good.card)).toBeGreaterThan(dueTime(hard.card));
    expect(dueTime(easy.card)).toBeGreaterThan(dueTime(good.card));
    expect(good.card.reps).toBe(1);
    expect(good.review.previousState).toBe('new');
    expect(good.review.rating).toBe(3);
    expect(good.review.reviewedAt).toBe(now.toISOString());
  });

  it('is deterministic with an injected clock and no fuzz', () => {
    const first = reviewSrsCard({
      card: createSrsCard({ cardType: 'production', now }),
      rating: 3,
      now,
    });
    const second = reviewSrsCard({
      card: createSrsCard({ cardType: 'production', now }),
      rating: 3,
      now,
    });

    expect(first.card.dueAt).toBe(second.card.dueAt);
    expect(first.card.stability).toBe(second.card.stability);
    expect(first.card.difficulty).toBe(second.card.difficulty);
    expect(first.review.scheduledDays).toBe(second.review.scheduledDays);
  });

  it('never exceeds the configured maximum interval', () => {
    let card = createSrsCard({ cardType: 'recognition', now });
    for (let index = 0; index < 12; index += 1) {
      const reviewedAt = new Date(card.dueAt);
      card = reviewSrsCard({ card, rating: 4, now: reviewedAt }).card;
      const scheduled = (dueTime(card) - reviewedAt.getTime()) / 86_400_000;
      expect(scheduled).toBeLessThanOrEqual(SRS_MAX_INTERVAL_DAYS);
    }
  });
});

describe('leech and suspension decisions', () => {
  it('flags a leech at four lapses and suspends at eight', () => {
    let card = reviewSrsCard({
      card: createSrsCard({ cardType: 'recognition', now }),
      rating: 3,
      now,
    }).card;

    for (let lapses = 1; lapses <= SUSPEND_LAPSE_THRESHOLD; lapses += 1) {
      card = reviewSrsCard({ card, rating: 1, now: new Date(card.dueAt) }).card;
      expect(card.lapses).toBe(lapses);
      expect(card.leech).toBe(lapses >= LEECH_LAPSE_THRESHOLD);
      expect(card.suspended).toBe(lapses >= SUSPEND_LAPSE_THRESHOLD);
      if (lapses < SUSPEND_LAPSE_THRESHOLD) {
        card = reviewSrsCard({ card, rating: 3, now: new Date(card.dueAt) }).card;
      }
    }
  });

  it('supports explicit suspend and unsuspend', () => {
    const card = createSrsCard({ cardType: 'recognition', now });
    const suspended = suspendSrsCard(card);
    expect(suspended.suspended).toBe(true);
    expect(unsuspendSrsCard(suspended).suspended).toBe(false);
  });
});
