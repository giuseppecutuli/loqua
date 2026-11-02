import { describe, expect, it } from 'vitest';

import { VOCABULARY_BANK } from '../src/bank/vocabulary.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS } from '../src/knowledge-graph.js';

const vocabularyConcepts = CONCEPTS.filter((concept) => concept.domain === 'vocabulary');
const items = VOCABULARY_BANK.items;

describe('vocabulary foundation bank', () => {
  it('uses the expected pack id', () => {
    expect(VOCABULARY_BANK.id).toBe('bank.vocabulary.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('contains exactly 30 items across 10 concepts', () => {
    expect(items).toHaveLength(30);
    const conceptIds = new Set(items.map((item) => item.conceptId));
    expect(conceptIds.size).toBe(10);
  });

  it('has exactly three items for every chosen concept', () => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.conceptId, (counts.get(item.conceptId) ?? 0) + 1);
    }
    for (const [conceptId, count] of counts) {
      expect(count, conceptId).toBe(3);
    }
    expect(counts.size).toBe(10);
  });

  it('only uses vocabulary concepts and spans A1 to C1', () => {
    const chosen = new Set(items.map((item) => item.conceptId));
    for (const conceptId of chosen) {
      const concept = vocabularyConcepts.find((entry) => entry.id === conceptId);
      expect(concept, conceptId).toBeDefined();
    }
    const levels = new Set(items.map((item) => item.cefrLevel));
    expect([...levels].sort()).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('has unique item ids with the bank vocabulary prefix', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.vocabulary\.[a-z-]+\.\d+$/);
    }
  });

  it('has valid options and answers', () => {
    for (const item of items) {
      expect(item.options.length).toBeGreaterThanOrEqual(3);
      expect(item.options.length).toBeLessThanOrEqual(4);
      const optionIds = new Set(item.options.map((option) => option.id));
      const optionTexts = new Set(item.options.map((option) => option.text.trim().toLowerCase()));
      expect(optionIds.size).toBe(item.options.length);
      expect(optionTexts.size).toBe(item.options.length);
      expect(optionIds.has(item.correctOptionId)).toBe(true);
    }
  });
});
