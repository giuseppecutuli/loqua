import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { ALL_CONCEPTS, FOUNDATION_ITEMS } from '../src/bank/index.js';
import { M2_PRACTICE_C_BANK } from '../src/bank/m2-practice-c.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, getConcept } from '../src/knowledge-graph.js';

const items = M2_PRACTICE_C_BANK.items;

const ALLOWED_TYPES = ['cloze', 'error_spotting', 'reading_mcq'] as const;

const EXPECTED_SKILL_DISTRIBUTION: Readonly<Record<string, number>> = {
  grammar: 18,
  vocabulary: 17,
  reading: 16,
  pragmatics: 14,
};

const PACK_PREFIX = 'bank.m2.practice.c.';

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

const externalFoundationItems = FOUNDATION_ITEMS.filter(
  (item) => !item.id.startsWith(PACK_PREFIX),
);

describe('M2 C1 practice pack', () => {
  it('uses the expected pack id', () => {
    expect(M2_PRACTICE_C_BANK.id).toBe('bank.m2.practice.c.v1');
  });

  it('passes foundation item validation on its own', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('passes foundation item validation combined with all concepts', () => {
    expect(validateFoundationItems([...externalFoundationItems, ...items], ALL_CONCEPTS)).toEqual(
      [],
    );
  });

  it('contains exactly 65 items with sequential namespaced ids', () => {
    expect(items).toHaveLength(65);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(Array.from({ length: 65 }, (_, index) => `${PACK_PREFIX}${index + 1}`));
  });

  it('matches the expected skill distribution', () => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.skill] = (counts[item.skill] ?? 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_SKILL_DISTRIBUTION);
    expect(counts.grammar).toBeGreaterThanOrEqual(18);
    expect(counts.vocabulary).toBeGreaterThanOrEqual(17);
    expect(counts.reading).toBeGreaterThanOrEqual(16);
    expect(counts.pragmatics).toBeGreaterThanOrEqual(14);
  });

  it('uses only C1 concepts from the knowledge graph with matching domains and levels', () => {
    for (const item of items) {
      const concept = getConcept(item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(concept?.level, item.id).toBe('C1');
      expect(item.cefrLevel, item.id).toBe('C1');
      expect(item.skill, item.id).toBe(concept?.domain);
      expect(CONCEPTS.some((entry) => entry.id === item.conceptId), item.id).toBe(true);
    }
  });

  it('repeats C1 concepts across multiple items', () => {
    const countsByConcept = new Map<string, number>();
    for (const item of items) {
      countsByConcept.set(item.conceptId, (countsByConcept.get(item.conceptId) ?? 0) + 1);
    }
    expect(countsByConcept.size).toBeGreaterThan(1);
    expect([...countsByConcept.values()].every((count) => count > 1)).toBe(true);
  });

  it('uses only the allowed item types', () => {
    for (const item of items) {
      expect(ALLOWED_TYPES, item.id).toContain(item.type);
    }
  });

  it('uses unique prompts within the pack and against the other foundation items', () => {
    const prompts = items.map((item) => normalizePrompt(item.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);

    const foundationPrompts = new Set(
      externalFoundationItems.map((item) => normalizePrompt(item.prompt)),
    );
    for (const prompt of prompts) {
      expect(foundationPrompts.has(prompt), prompt).toBe(false);
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
        optionIds.filter((id) => id === item.correctOptionId),
        item.id,
      ).toHaveLength(1);
      expect(
        item.options.every((option) => option.text.trim().length > 0),
        item.id,
      ).toBe(true);
    }
  });

  it('keeps difficulty near the C1 centre with explanations, topics, and tags', () => {
    const centre = CEFR_THETA_CENTERS.C1;
    for (const item of items) {
      expect(Math.abs(item.difficultyB - centre), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(['casual', 'neutral', 'formal'], item.id).toContain(item.register);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
      expect(item.tags, item.id).toContain('C1');
      expect(item.tags.includes('assessment'), item.id).toBe(false);
    }
  });

  it('wraps every reading item in a passage and question', () => {
    for (const item of items.filter((entry) => entry.skill === 'reading')) {
      expect(item.type, item.id).toBe('reading_mcq');
      expect(item.prompt, item.id).toContain('Passage:');
      expect(item.prompt, item.id).toContain('Question:');
      const [passage, question] = item.prompt.split('Question:');
      expect((passage ?? '').trim().length, item.id).toBeGreaterThan(40);
      expect((question ?? '').trim().length, item.id).toBeGreaterThan(10);
    }
  });

  it('wraps every pragmatics item in a scenario and question', () => {
    for (const item of items.filter((entry) => entry.skill === 'pragmatics')) {
      expect(item.type, item.id).toBe('reading_mcq');
      expect(item.prompt, item.id).toContain('Scenario:');
      expect(item.prompt, item.id).toContain('Question:');
    }
  });
});
