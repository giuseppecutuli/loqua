import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { ASSESSMENT_C1_BANK } from '../src/bank/assessment-c1.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, getConcept } from '../src/knowledge-graph.js';

const items = ASSESSMENT_C1_BANK.items;

const ALLOWED_TYPES = ['cloze', 'error_spotting', 'reading_mcq'] as const;

const EXPECTED_SKILL_DISTRIBUTION: Readonly<Record<string, number>> = {
  grammar: 14,
  vocabulary: 12,
  reading: 12,
  pragmatics: 12,
};

describe('C1 assessment bank', () => {
  it('uses the expected pack id', () => {
    expect(ASSESSMENT_C1_BANK.id).toBe('bank.assessment.c1.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('contains exactly 50 items with unique ids following the assessment prefix', () => {
    expect(items).toHaveLength(50);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.assessment\.c1\.\d+$/);
    }
    expect(ids).toEqual(
      Array.from({ length: 50 }, (_, index) => `bank.assessment.c1.${index + 1}`),
    );
  });

  it('uses only C1 concepts from the knowledge graph with matching domains and levels', () => {
    for (const item of items) {
      const concept = getConcept(item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(concept?.level, item.id).toBe('C1');
      expect(item.cefrLevel, item.id).toBe('C1');
      expect(item.skill, item.id).toBe(concept?.domain);
      expect(['grammar', 'vocabulary', 'reading', 'pragmatics'], item.id).toContain(item.skill);
    }

    const usedConcepts = new Set(items.map((item) => item.conceptId));
    for (const conceptId of usedConcepts) {
      expect(CONCEPTS.some((concept) => concept.id === conceptId)).toBe(true);
    }
    expect(usedConcepts.size).toBe(6);
  });

  it('matches the expected skill distribution', () => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.skill] = (counts[item.skill] ?? 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_SKILL_DISTRIBUTION);
  });

  it('uses only the allowed item types', () => {
    for (const item of items) {
      expect(ALLOWED_TYPES, item.id).toContain(item.type);
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

  it('includes assessment and C1 tags, a topic, and a register on every item', () => {
    for (const item of items) {
      expect(item.tags, item.id).toContain('assessment');
      expect(item.tags, item.id).toContain('C1');
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(['casual', 'neutral', 'formal'], item.id).toContain(item.register);
    }
  });

  it('keeps difficulty near the C1 centre with a simple explanation', () => {
    const centre = CEFR_THETA_CENTERS.C1;
    for (const item of items) {
      expect(Math.abs(item.difficultyB - centre), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
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
});
