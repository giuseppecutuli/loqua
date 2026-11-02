import { describe, expect, it } from 'vitest';

import { ALL_CONCEPTS, FOUNDATION_ITEMS } from '../src/bank/index.js';
import { DEPTH_VOCABULARY_BANK, DEPTH_VOCABULARY_CONCEPTS } from '../src/bank/depth-vocabulary.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS } from '../src/knowledge-graph.js';

const items = DEPTH_VOCABULARY_BANK.items;
const validationConcepts = [...CONCEPTS, ...DEPTH_VOCABULARY_CONCEPTS];

const expectedCounts: Record<string, number> = {
  'concept-en-make-do': 4,
  'en.vocab.daily_routine': 2,
  'en.vocab.family': 2,
  'en.vocab.food': 2,
  'concept-en-put-off': 4,
  'en.vocab.travel': 2,
  'en.vocab.work': 2,
  'concept-en-responsibility': 4,
  'en.vocab.collocation.make_do': 2,
  'en.vocab.false_friend.actually': 2,
  'en.vocab.phrasal.look_after': 2,
  'concept-en-turn-down': 4,
  'en.vocab.abstract_topics': 2,
  'en.vocab.idioms': 2,
  'concept-en-specious': 4,
  'en.vocab.collocation.academic': 2,
  'en.vocab.register.nuance': 2,
};

const expectedLevels: Record<string, string> = {
  'concept-en-make-do': 'A1',
  'en.vocab.daily_routine': 'A1',
  'en.vocab.family': 'A1',
  'en.vocab.food': 'A1',
  'concept-en-put-off': 'A2',
  'en.vocab.travel': 'A2',
  'en.vocab.work': 'A2',
  'concept-en-responsibility': 'B1',
  'en.vocab.collocation.make_do': 'B1',
  'en.vocab.false_friend.actually': 'B1',
  'en.vocab.phrasal.look_after': 'B1',
  'concept-en-turn-down': 'B2',
  'en.vocab.abstract_topics': 'B2',
  'en.vocab.idioms': 'B2',
  'concept-en-specious': 'C1',
  'en.vocab.collocation.academic': 'C1',
  'en.vocab.register.nuance': 'C1',
};

const externalFoundationItems = FOUNDATION_ITEMS.filter(
  (item) => !item.id.startsWith('bank.depth.vocabulary.'),
);

describe('depth vocabulary bank', () => {
  it('uses the expected pack id', () => {
    expect(DEPTH_VOCABULARY_BANK.id).toBe('bank.depth.vocabulary.v1');
  });

  it('contains exactly 44 items', () => {
    expect(items).toHaveLength(44);
  });

  it('passes foundation item validation on its own', () => {
    expect(validateFoundationItems(items, validationConcepts)).toEqual([]);
  });

  it('passes foundation item validation combined with externalFoundationItems', () => {
    expect(validateFoundationItems([...externalFoundationItems, ...items], ALL_CONCEPTS)).toEqual(
      [],
    );
  });

  it('has the exact requested number of items per concept', () => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.conceptId, (counts.get(item.conceptId) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(Object.keys(expectedCounts).sort());
    for (const [conceptId, expected] of Object.entries(expectedCounts)) {
      expect(counts.get(conceptId), conceptId).toBe(expected);
    }
  });

  it('uses the expected concept levels and the vocabulary domain', () => {
    for (const item of items) {
      expect(item.cefrLevel, item.id).toBe(expectedLevels[item.conceptId]);
      expect(item.skill, item.id).toBe('vocabulary');
    }
  });

  it('has unique ids with the depth vocabulary prefix', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.depth\.vocabulary\.\d+$/);
    }
    expect(ids).toEqual(
      Array.from({ length: 44 }, (_, index) => `bank.depth.vocabulary.${index + 1}`),
    );
  });

  it('does not reuse prompts from the foundation bank', () => {
    const normalize = (prompt: string) => prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    const foundationPrompts = new Set(
      externalFoundationItems.map((item) => normalize(item.prompt)),
    );
    for (const item of items) {
      expect(foundationPrompts.has(normalize(item.prompt)), item.id).toBe(false);
    }
  });

  it('has 3-4 unique options, one correct answer, and required metadata', () => {
    for (const item of items) {
      expect(item.options.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.options.length, item.id).toBeLessThanOrEqual(4);
      const optionIds = new Set(item.options.map((option) => option.id));
      const optionTexts = new Set(item.options.map((option) => option.text.trim().toLowerCase()));
      expect(optionIds.size, item.id).toBe(item.options.length);
      expect(optionTexts.size, item.id).toBe(item.options.length);
      expect(optionIds.has(item.correctOptionId), item.id).toBe(true);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
      expect(item.difficultyB, item.id).toBeGreaterThanOrEqual(-3);
      expect(item.difficultyB, item.id).toBeLessThanOrEqual(3);
      expect(['cloze', 'error_spotting', 'reading_mcq'], item.id).toContain(item.type);
    }
  });
});
