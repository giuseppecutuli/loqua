import { describe, expect, it } from 'vitest';

import { FOUNDATION_ITEMS, FOUNDATION_BANKS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS } from '../src/knowledge-graph.js';

describe('foundation bank integration', () => {
  it('contains 90 uniquely identified items across three packs', () => {
    expect(FOUNDATION_BANKS).toHaveLength(3);
    expect(FOUNDATION_ITEMS).toHaveLength(90);
    expect(new Set(FOUNDATION_ITEMS.map((item) => item.id)).size).toBe(90);
  });

  it('validates every item against the concept graph', () => {
    expect(validateFoundationItems(FOUNDATION_ITEMS)).toEqual([]);
  });

  it('gives every covered concept three items', () => {
    const counts = new Map<string, number>();
    for (const item of FOUNDATION_ITEMS) {
      counts.set(item.conceptId, (counts.get(item.conceptId) ?? 0) + 1);
    }
    const coveredConcepts = new Set(FOUNDATION_ITEMS.map((item) => item.conceptId));
    expect(coveredConcepts.size).toBe(30);
    for (const conceptId of coveredConcepts) {
      expect(CONCEPTS.some((concept) => concept.id === conceptId)).toBe(true);
      expect(counts.get(conceptId)).toBe(3);
    }
  });
});
