import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { ASSESSMENT_B1_BANK } from '../src/bank/assessment-b1.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { getConcept } from '../src/knowledge-graph.js';

const items = ASSESSMENT_B1_BANK.items;

const SKILL_DISTRIBUTION: Readonly<Record<string, number>> = {
  grammar: 24,
  vocabulary: 12,
  reading: 8,
  pragmatics: 6,
};

describe('B1 assessment bank', () => {
  it('uses the expected pack id', () => {
    expect(ASSESSMENT_B1_BANK.id).toBe('bank.assessment.b1.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('contains exactly 50 items', () => {
    expect(items).toHaveLength(50);
  });

  it('has unique ids following the assessment naming pattern', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.assessment\.b1\.\d+$/);
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

  it('uses only B1 concepts with matching skill and level', () => {
    for (const item of items) {
      const concept = getConcept(item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(concept?.level, item.id).toBe('B1');
      expect(concept?.domain, item.id).toBe(item.skill);
      expect(item.cefrLevel, item.id).toBe('B1');
    }
  });

  it('matches the expected skill distribution', () => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.skill, (counts.get(item.skill) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual(SKILL_DISTRIBUTION);
  });

  it('uses only the allowed item types', () => {
    for (const item of items) {
      expect(['cloze', 'error_spotting', 'reading_mcq'], item.id).toContain(item.type);
    }
  });

  it('keeps difficulty near the B1 centre', () => {
    const centre = CEFR_THETA_CENTERS.B1;
    for (const item of items) {
      expect(Math.abs(item.difficultyB - centre), item.id).toBeLessThanOrEqual(0.2);
    }
  });

  it('tags every item as assessment and B1 with a topic and register', () => {
    for (const item of items) {
      expect(item.tags, item.id).toContain('assessment');
      expect(item.tags, item.id).toContain('B1');
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.register, item.id).toBeDefined();
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
    }
  });
});
