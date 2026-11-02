import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { M2_PRACTICE_B_BANK } from '../src/bank/m2-practice-b.js';
import { ALL_CONCEPTS, FOUNDATION_ITEMS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { getConcept } from '../src/knowledge-graph.js';

const items = M2_PRACTICE_B_BANK.items;

const SKILL_DISTRIBUTION: Readonly<Record<string, number>> = {
  grammar: 20,
  vocabulary: 18,
  reading: 17,
  pragmatics: 10,
};

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

describe('M2 practice B bank', () => {
  it('uses the expected pack id', () => {
    expect(M2_PRACTICE_B_BANK.id).toBe('bank.m2.practice.b.v1');
  });

  it('contains exactly 65 items', () => {
    expect(items).toHaveLength(65);
  });

  it('matches the expected skill distribution', () => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.skill, (counts.get(item.skill) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual(SKILL_DISTRIBUTION);
  });

  it('has unique ids following the pack naming pattern', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.m2\.practice\.b\.\d+$/);
    }
  });

  it('has unique prompts inside the pack', () => {
    const prompts = items.map((item) => normalizePrompt(item.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('has prompts unique against the current foundation items', () => {
    const existing = new Set(
      FOUNDATION_ITEMS.filter((item) => !item.id.startsWith('bank.m2.practice.b.')).map((item) =>
        normalizePrompt(item.prompt),
      ),
    );
    for (const item of items) {
      expect(existing.has(normalizePrompt(item.prompt)), item.id).toBe(false);
    }
  });

  it('passes foundation item validation against all concepts', () => {
    expect(validateFoundationItems(items, ALL_CONCEPTS)).toEqual([]);
  });

  it('uses only B1-B2 concepts with matching skill and level', () => {
    for (const item of items) {
      const concept = getConcept(item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(['B1', 'B2'], item.id).toContain(item.cefrLevel);
      expect(concept?.level, item.id).toBe(item.cefrLevel);
      expect(concept?.domain, item.id).toBe(item.skill);
    }
  });

  it('has 3-4 unique options with exactly one valid answer', () => {
    for (const item of items) {
      expect(item.options.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.options.length, item.id).toBeLessThanOrEqual(4);
      const optionIds = item.options.map((option) => option.id);
      const optionTexts = item.options.map((option) => option.text.trim().toLowerCase());
      expect(new Set(optionIds).size, item.id).toBe(optionIds.length);
      expect(new Set(optionTexts).size, item.id).toBe(optionTexts.length);
      expect(
        optionIds.filter((optionId) => optionId === item.correctOptionId),
        item.id,
      ).toHaveLength(1);
    }
  });

  it('uses only the allowed item types', () => {
    for (const item of items) {
      expect(['cloze', 'error_spotting', 'reading_mcq'], item.id).toContain(item.type);
    }
  });

  it('keeps difficulty near the level centre', () => {
    for (const item of items) {
      const centre = CEFR_THETA_CENTERS[item.cefrLevel];
      expect(Math.abs(item.difficultyB - centre), item.id).toBeLessThanOrEqual(0.2);
    }
  });

  it('tags every item with its level, a topic, register, and explanation', () => {
    for (const item of items) {
      expect(item.tags, item.id).toContain(item.cefrLevel);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.register, item.id).toBeDefined();
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });
});
