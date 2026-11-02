import { describe, expect, it } from 'vitest';

import { M2_PRACTICE_A_BANK } from '../src/bank/m2-practice-a.js';
import { ALL_CONCEPTS, FOUNDATION_ITEMS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS } from '../src/knowledge-graph.js';

const EXPECTED_SKILL_COUNTS: Readonly<Record<string, number>> = {
  grammar: 20,
  vocabulary: 20,
  reading: 15,
  pragmatics: 10,
};

const DIFFICULTY_CENTERS: Readonly<Record<string, number>> = {
  A1: -2,
  A2: -1,
};

const externalFoundationItems = FOUNDATION_ITEMS.filter(
  (item) => !item.id.startsWith('bank.m2.practice.a.'),
);

const normalize = (prompt: string) => prompt.trim().toLowerCase().replace(/\s+/g, ' ');

describe('M2 practice A bank', () => {
  it('uses the expected pack id', () => {
    expect(M2_PRACTICE_A_BANK.id).toBe('bank.m2.practice.a.v1');
  });

  it('passes foundation item validation on its own', () => {
    expect(validateFoundationItems(M2_PRACTICE_A_BANK.items)).toEqual([]);
  });

  it('passes foundation item validation together with the foundation items', () => {
    const combined = [...externalFoundationItems, ...M2_PRACTICE_A_BANK.items];
    expect(validateFoundationItems(combined, ALL_CONCEPTS)).toEqual([]);
  });

  it('contains exactly 65 items with the expected per-skill counts', () => {
    expect(M2_PRACTICE_A_BANK.items).toHaveLength(65);

    const counts: Record<string, number> = {};
    for (const item of M2_PRACTICE_A_BANK.items) {
      counts[item.skill] = (counts[item.skill] ?? 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_SKILL_COUNTS);
  });

  it('uses unique, sequential, namespaced item ids', () => {
    const ids = M2_PRACTICE_A_BANK.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    const numbers = ids.map((id) => {
      const match = /^bank\.m2\.practice\.a\.(\d+)$/.exec(id);
      expect(match, id).not.toBeNull();
      return Number(match?.[1]);
    });
    expect([...numbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 65 }, (_, index) => index + 1),
    );
  });

  it('does not reuse any prompt from existing foundation items or within the pack', () => {
    const existingPrompts = new Set(externalFoundationItems.map((item) => normalize(item.prompt)));
    const packPrompts = new Set<string>();

    for (const item of M2_PRACTICE_A_BANK.items) {
      const prompt = normalize(item.prompt);
      expect(existingPrompts.has(prompt), item.id).toBe(false);
      expect(packPrompts.has(prompt), item.id).toBe(false);
      packPrompts.add(prompt);
    }
  });

  it('matches the concept graph levels and domains', () => {
    for (const item of M2_PRACTICE_A_BANK.items) {
      const concept = CONCEPTS.find((entry) => entry.id === item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(item.skill, item.id).toBe(concept?.domain);
      expect(item.cefrLevel, item.id).toBe(concept?.level);
      expect(['A1', 'A2'], item.id).toContain(item.cefrLevel);
    }
  });

  it('uses the allowed types with 3-4 unique options and one valid answer', () => {
    for (const item of M2_PRACTICE_A_BANK.items) {
      expect(['cloze', 'error_spotting', 'reading_mcq'], item.id).toContain(item.type);
      expect(item.options.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.options.length, item.id).toBeLessThanOrEqual(4);

      const optionIds = new Set(item.options.map((option) => option.id));
      const optionTexts = new Set(item.options.map((option) => option.text.trim().toLowerCase()));
      expect(optionIds.size, item.id).toBe(item.options.length);
      expect(optionTexts.size, item.id).toBe(item.options.length);
      expect(optionIds.has(item.correctOptionId), item.id).toBe(true);
    }
  });

  it('keeps difficulty near the CEFR center and supplies copy and tags', () => {
    for (const item of M2_PRACTICE_A_BANK.items) {
      const center = DIFFICULTY_CENTERS[item.cefrLevel];
      if (center === undefined) throw new Error(`missing difficulty center for ${item.cefrLevel}`);
      expect(Math.abs(item.difficultyB - center), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });
});
