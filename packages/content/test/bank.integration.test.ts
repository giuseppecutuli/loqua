import { describe, expect, it } from 'vitest';

import { FOUNDATION_ITEMS, FOUNDATION_BANKS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS } from '../src/knowledge-graph.js';

describe('foundation bank integration', () => {
  it('contains 329 uniquely identified items across eight packs', () => {
    expect(FOUNDATION_BANKS).toHaveLength(8);
    expect(FOUNDATION_ITEMS).toHaveLength(329);
    expect(new Set(FOUNDATION_ITEMS.map((item) => item.id)).size).toBe(329);
  });

  it('validates every item against the concept graph', () => {
    expect(validateFoundationItems(FOUNDATION_ITEMS)).toEqual([]);
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
    expect(practice).toHaveLength(129);
    const covered = new Set(practice.map((item) => item.conceptId));
    expect(covered.size).toBe(43);
    for (const conceptId of covered) {
      expect(practice.filter((item) => item.conceptId === conceptId).length).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it('leaves only listening/speaking/writing concepts without items', () => {
    const covered = new Set(FOUNDATION_ITEMS.map((item) => item.conceptId));
    const missing = CONCEPTS.filter((concept) => !covered.has(concept.id));
    expect(missing).toHaveLength(15);
    expect(
      missing.every((concept) => ['listening', 'speaking', 'writing'].includes(concept.domain)),
    ).toBe(true);
  });
});
