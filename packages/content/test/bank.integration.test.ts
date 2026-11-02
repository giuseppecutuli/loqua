import { describe, expect, it } from 'vitest';

import { ALL_CONCEPTS, FOUNDATION_ITEMS, FOUNDATION_BANKS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';

describe('foundation bank integration', () => {
  it('contains 782 uniquely identified items across eighteen packs', () => {
    expect(FOUNDATION_BANKS).toHaveLength(18);
    expect(FOUNDATION_ITEMS).toHaveLength(782);
    expect(new Set(FOUNDATION_ITEMS.map((item) => item.id)).size).toBe(782);
  });

  it('validates every item against the concept graph', () => {
    expect(validateFoundationItems(FOUNDATION_ITEMS, ALL_CONCEPTS)).toEqual([]);
  });

  it('splits assessment and practice coverage', () => {
    const assessment = FOUNDATION_ITEMS.filter((item) => item.tags.includes('assessment'));
    expect(assessment).toHaveLength(200);
    const expectedByLevel: Record<string, number> = {
      A1: 25,
      A2: 25,
      B1: 50,
      B2: 50,
      C1: 50,
    };
    for (const [level, count] of Object.entries(expectedByLevel)) {
      expect(assessment.filter((item) => item.cefrLevel === level)).toHaveLength(count);
    }
    const practice = FOUNDATION_ITEMS.filter((item) => !item.tags.includes('assessment'));
    expect(practice).toHaveLength(582);
    const covered = new Set(practice.map((item) => item.conceptId));
    expect(covered.size).toBe(66);
    for (const conceptId of covered) {
      expect(practice.filter((item) => item.conceptId === conceptId).length).toBeGreaterThanOrEqual(
        4,
      );
    }
  });

  it('leaves only listening/speaking/writing concepts without items', () => {
    const missing = ALL_CONCEPTS.filter(
      (concept) => !FOUNDATION_ITEMS.some((item) => item.conceptId === concept.id),
    );
    expect(missing).toHaveLength(10);
    expect(missing.every((concept) => ['speaking', 'writing'].includes(concept.domain))).toBe(true);
    const listening = FOUNDATION_ITEMS.filter((item) => item.skill === 'listening');
    expect(listening).toHaveLength(92);
    expect(
      listening.every((item) => typeof item.audioText === 'string' && item.audioText.length > 0),
    ).toBe(true);
  });
});
