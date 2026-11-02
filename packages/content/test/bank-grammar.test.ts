import { describe, expect, it } from 'vitest';

import { GRAMMAR_BANK } from '../src/bank/grammar.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS } from '../src/knowledge-graph.js';

const CHOSEN_CONCEPT_IDS = [
  'en.gram.tense.present_simple',
  'en.gram.tense.present_continuous',
  'en.gram.preposition.time',
  'en.gram.tense.past_simple',
  'en.gram.future.will_going_to',
  'en.gram.conditional.first',
  'en.gram.conditional.second',
  'en.gram.word_order.adverb',
  'en.gram.relative_clauses',
  'en.gram.modals.deduction',
] as const;

const DIFFICULTY_CENTERS: Readonly<Record<string, number>> = {
  A1: -2,
  A2: -1,
  B1: 0.1,
  B2: 1.25,
};

describe('grammar foundation bank', () => {
  it('uses the expected pack id', () => {
    expect(GRAMMAR_BANK.id).toBe('bank.grammar.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(GRAMMAR_BANK.items)).toEqual([]);
  });

  it('covers 10 grammar concepts across A1-B2', () => {
    const concepts = CHOSEN_CONCEPT_IDS.map((id) => {
      const concept = CONCEPTS.find((entry) => entry.id === id);
      if (!concept) throw new Error(`missing concept ${id}`);
      return concept;
    });

    expect(concepts).toHaveLength(10);
    expect(new Set(concepts.map((concept) => concept.id)).size).toBe(10);
    for (const concept of concepts) {
      expect(concept.domain).toBe('grammar');
    }

    const levels = new Set(concepts.map((concept) => concept.level));
    expect([...levels].sort()).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('contains exactly three items per chosen concept', () => {
    expect(GRAMMAR_BANK.items).toHaveLength(30);
    for (const conceptId of CHOSEN_CONCEPT_IDS) {
      const count = GRAMMAR_BANK.items.filter((item) => item.conceptId === conceptId).length;
      expect(count, conceptId).toBe(3);
    }
  });

  it('uses unique, namespaced item ids', () => {
    const ids = GRAMMAR_BANK.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.grammar\.[a-z0-9_]+\.\d+$/);
    }
  });

  it('uses cloze or error spotting with valid options and answers', () => {
    for (const item of GRAMMAR_BANK.items) {
      expect(['cloze', 'error_spotting']).toContain(item.type);
      expect(item.options.length).toBeGreaterThanOrEqual(3);
      expect(item.options.length).toBeLessThanOrEqual(4);

      const optionIds = new Set(item.options.map((option) => option.id));
      const optionTexts = new Set(item.options.map((option) => option.text.toLowerCase()));
      expect(optionIds.size, item.id).toBe(item.options.length);
      expect(optionTexts.size, item.id).toBe(item.options.length);
      expect(optionIds.has(item.correctOptionId), item.id).toBe(true);
    }
  });

  it('keeps difficulty near the CEFR center', () => {
    for (const item of GRAMMAR_BANK.items) {
      const center = DIFFICULTY_CENTERS[item.cefrLevel];
      if (center === undefined) throw new Error(`missing difficulty center for ${item.cefrLevel}`);
      expect(Math.abs(item.difficultyB - center), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });
});
