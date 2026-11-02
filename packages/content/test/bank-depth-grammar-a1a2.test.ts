import { describe, expect, it } from 'vitest';

import { DEPTH_GRAMMAR_A1A2_BANK } from '../src/bank/depth-grammar-a1a2.js';
import { ALL_CONCEPTS, FOUNDATION_ITEMS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS } from '../src/knowledge-graph.js';

const EXPECTED_COUNTS: Readonly<Record<string, number>> = {
  'en.gram.tense.present_simple': 6,
  'en.gram.article.zero': 2,
  'en.gram.preposition.time': 2,
  'en.gram.tense.present_continuous': 2,
  'en.gram.tense.past_simple': 6,
  'en.gram.conditional.first': 2,
  'en.gram.future.will_going_to': 2,
  'en.gram.tense.past_participle_irregular': 2,
  'en.gram.tense.present_perfect_form': 2,
};

const DIFFICULTY_CENTERS: Readonly<Record<string, number>> = {
  A1: -2,
  A2: -1,
};

const externalFoundationItems = FOUNDATION_ITEMS.filter(
  (item) => !item.id.startsWith('bank.depth.grammar.a1a2.'),
);

describe('depth grammar A1-A2 bank', () => {
  it('uses the expected pack id', () => {
    expect(DEPTH_GRAMMAR_A1A2_BANK.id).toBe('bank.depth.grammar.a1a2.v1');
  });

  it('passes foundation item validation on its own', () => {
    expect(validateFoundationItems(DEPTH_GRAMMAR_A1A2_BANK.items)).toEqual([]);
  });

  it('passes foundation item validation together with the foundation items', () => {
    const combined = [...externalFoundationItems, ...DEPTH_GRAMMAR_A1A2_BANK.items];
    expect(validateFoundationItems(combined, ALL_CONCEPTS)).toEqual([]);
  });

  it('contains exactly 26 items with the expected per-concept counts', () => {
    expect(DEPTH_GRAMMAR_A1A2_BANK.items).toHaveLength(26);
    for (const [conceptId, expected] of Object.entries(EXPECTED_COUNTS)) {
      const count = DEPTH_GRAMMAR_A1A2_BANK.items.filter(
        (item) => item.conceptId === conceptId,
      ).length;
      expect(count, conceptId).toBe(expected);
    }
  });

  it('reaches at least five practice items per target concept in the combined bank', () => {
    const combined = [...externalFoundationItems, ...DEPTH_GRAMMAR_A1A2_BANK.items];
    const practice = combined.filter((item) => !item.tags.includes('assessment'));
    for (const conceptId of Object.keys(EXPECTED_COUNTS)) {
      const count = practice.filter((item) => item.conceptId === conceptId).length;
      expect(count, conceptId).toBeGreaterThanOrEqual(5);
    }
  });

  it('uses unique, namespaced item ids', () => {
    const ids = DEPTH_GRAMMAR_A1A2_BANK.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.depth\.grammar\.a1a2\.\d+$/);
    }
  });

  it('does not reuse any prompt from the existing foundation items or within the pack', () => {
    const normalize = (prompt: string) => prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    const existingPrompts = new Set(externalFoundationItems.map((item) => normalize(item.prompt)));
    const packPrompts = new Set<string>();
    for (const item of DEPTH_GRAMMAR_A1A2_BANK.items) {
      const prompt = normalize(item.prompt);
      expect(existingPrompts.has(prompt), item.id).toBe(false);
      expect(packPrompts.has(prompt), item.id).toBe(false);
      packPrompts.add(prompt);
    }
  });

  it('matches the concept graph levels and domains', () => {
    for (const item of DEPTH_GRAMMAR_A1A2_BANK.items) {
      const concept = CONCEPTS.find((entry) => entry.id === item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(item.skill, item.id).toBe(concept?.domain);
      expect(item.cefrLevel, item.id).toBe(concept?.level);
    }
  });

  it('uses cloze or error spotting with unique options and one valid answer', () => {
    for (const item of DEPTH_GRAMMAR_A1A2_BANK.items) {
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

  it('keeps difficulty near the CEFR center and supplies copy and tags', () => {
    for (const item of DEPTH_GRAMMAR_A1A2_BANK.items) {
      const center = DIFFICULTY_CENTERS[item.cefrLevel];
      if (center === undefined) throw new Error(`missing difficulty center for ${item.cefrLevel}`);
      expect(Math.abs(item.difficultyB - center), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });
});
