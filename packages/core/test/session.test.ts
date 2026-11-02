import { describe, expect, it } from 'vitest';

import { SESSION_DEFAULT_SIZE, buildDailySession, type SessionCandidate } from '../src/session.js';
import type { SkillDomain } from '../src/skills.js';

const now = new Date('2026-11-02T10:00:00.000Z');

function makeCandidate(index: number, overrides: Partial<SessionCandidate> = {}): SessionCandidate {
  const skill: SkillDomain = overrides.skill ?? 'grammar';
  return {
    itemId: `item-${String(index).padStart(3, '0')}`,
    skillId: `skill-${skill}`,
    skill,
    conceptId: `concept-${index}`,
    difficultyB: 0,
    sourceType: 'foundation',
    ...overrides,
  };
}

function reviewCandidates(count: number): SessionCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    makeCandidate(index, {
      sourceType: 'review',
      dueAt: new Date(now.getTime() - (index + 1) * 60_000).toISOString(),
    }),
  );
}

function inputCandidates(count: number): SessionCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    makeCandidate(100 + index, { skill: index % 2 === 0 ? 'grammar' : 'vocabulary' }),
  );
}

function productionCandidates(count: number): SessionCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    makeCandidate(200 + index, { skill: index % 2 === 0 ? 'writing' : 'speaking' }),
  );
}

describe('daily session selection', () => {
  it('fills the 40/30/30 blueprint when every bucket has candidates', () => {
    const session = buildDailySession({
      candidates: [...reviewCandidates(6), ...inputCandidates(6), ...productionCandidates(5)],
      knownConceptIds: [],
      now,
    });

    expect(session.size).toBe(SESSION_DEFAULT_SIZE);
    expect(session.counts.review).toBe(5);
    expect(session.counts.input).toBe(4);
    expect(session.counts.production).toBe(3);
    expect(session.counts.total).toBe(12);
    expect(session.counts.fallback).toBe(0);
    expect(session.counts.requested).toEqual({ review: 5, input: 4, production: 3 });
    expect(session.rationaleCodes).toEqual(
      expect.arrayContaining(['due_review', 'new_concept', 'production_practice']),
    );
    expect(session.items).toHaveLength(12);
  });

  it('is deterministic regardless of candidate input order', () => {
    const candidates = [...reviewCandidates(6), ...inputCandidates(6), ...productionCandidates(5)];
    const forward = buildDailySession({ candidates, knownConceptIds: [], now });
    const reversed = buildDailySession({
      candidates: candidates.slice().reverse(),
      knownConceptIds: [],
      now,
    });

    expect(reversed.items.map((item) => item.itemId)).toEqual(
      forward.items.map((item) => item.itemId),
    );
    expect(reversed.blocks.map((block) => block.count)).toEqual(
      forward.blocks.map((block) => block.count),
    );
  });

  it('never selects known concepts and never duplicates item IDs', () => {
    const candidates = reviewCandidates(8).concat(inputCandidates(8));
    const knownConceptIds = candidates.slice(0, 4).map((candidate) => candidate.conceptId);
    const session = buildDailySession({ candidates, knownConceptIds, now });

    for (const item of session.items) {
      expect(knownConceptIds).not.toContain(item.conceptId);
    }
    const itemIds = session.items.map((item) => item.itemId);
    expect(new Set(itemIds).size).toBe(itemIds.length);
  });

  it('caps each concept at two items', () => {
    const repeated = Array.from({ length: 10 }, (_, index) =>
      makeCandidate(300 + index, { conceptId: 'concept-repeated', difficultyB: index / 10 }),
    );
    const session = buildDailySession({ candidates: repeated, knownConceptIds: [], now });

    expect(session.counts.total).toBe(2);
    expect(session.items).toHaveLength(2);
    expect(new Set(session.items.map((item) => item.itemId)).size).toBe(2);
  });

  it('falls back deterministically when a bucket is empty', () => {
    const session = buildDailySession({
      candidates: [...inputCandidates(15), ...productionCandidates(6)],
      knownConceptIds: [],
      now,
    });

    expect(session.counts.review).toBe(0);
    expect(session.counts.total).toBe(12);
    expect(session.counts.fallback).toBeGreaterThan(0);
    expect(session.rationaleCodes).toContain('fallback_foundation');
  });

  it('marks weak-skill items with the weak_skill rationale', () => {
    const session = buildDailySession({
      candidates: [...reviewCandidates(6), ...inputCandidates(6), ...productionCandidates(5)],
      knownConceptIds: [],
      now,
      weakSkillIds: ['skill-grammar'],
    });

    const grammarItems = session.items.filter((item) => item.skillId === 'skill-grammar');
    expect(grammarItems.length).toBeGreaterThan(0);
    expect(grammarItems.every((item) => item.rationale === 'weak_skill')).toBe(true);
  });

  it('skips review candidates that are not due yet', () => {
    const notDue = makeCandidate(400, {
      sourceType: 'review',
      dueAt: new Date(now.getTime() + 60_000).toISOString(),
    });
    const session = buildDailySession({
      candidates: [notDue, ...inputCandidates(3)],
      knownConceptIds: [],
      now,
    });

    expect(session.items.some((item) => item.itemId === notDue.itemId)).toBe(false);
  });

  it('returns an empty session for size zero', () => {
    const session = buildDailySession({
      candidates: inputCandidates(3),
      knownConceptIds: [],
      now,
      size: 0,
    });

    expect(session.counts.total).toBe(0);
    expect(session.items).toEqual([]);
  });
});
