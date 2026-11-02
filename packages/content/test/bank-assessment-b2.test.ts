import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { ASSESSMENT_B2_BANK } from '../src/bank/assessment-b2.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, getConcept } from '../src/knowledge-graph.js';

const items = ASSESSMENT_B2_BANK.items;

const EXPECTED_SKILLS = {
  grammar: 18,
  vocabulary: 14,
  reading: 10,
  pragmatics: 8,
} as const;

const ALLOWED_TYPES = new Set(['cloze', 'error_spotting', 'reading_mcq']);

describe('B2 assessment bank', () => {
  it('has the expected pack id', () => {
    expect(ASSESSMENT_B2_BANK.id).toBe('bank.assessment.b2.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('contains exactly 50 items with unique ids', () => {
    expect(items).toHaveLength(50);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(50);
    for (const item of items) {
      expect(item.id).toMatch(/^bank\.assessment\.b2\.\d+$/);
    }
  });

  it('uses only B2 concepts with matching skills and levels', () => {
    for (const item of items) {
      const concept = getConcept(item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(concept?.level).toBe('B2');
      expect(item.cefrLevel).toBe('B2');
      expect(item.skill).toBe(concept?.domain);
    }
  });

  it('covers every available B2 concept in the assessed domains', () => {
    const covered = new Set(items.map((item) => item.conceptId));
    const available = CONCEPTS.filter(
      (concept) =>
        concept.level === 'B2' &&
        Object.prototype.hasOwnProperty.call(EXPECTED_SKILLS, concept.domain),
    ).map((concept) => concept.id);

    expect(available).toHaveLength(6);
    for (const conceptId of available) {
      expect(covered.has(conceptId), conceptId).toBe(true);
    }
  });

  it('has the expected skill distribution', () => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.skill] = (counts[item.skill] ?? 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_SKILLS);
  });

  it('uses only allowed item types', () => {
    for (const item of items) {
      expect(ALLOWED_TYPES.has(item.type), item.id).toBe(true);
    }
  });

  it('has 3-4 unique options and exactly one correct answer', () => {
    for (const item of items) {
      expect(item.options.length).toBeGreaterThanOrEqual(3);
      expect(item.options.length).toBeLessThanOrEqual(4);

      const optionIds = item.options.map((option) => option.id);
      const optionTexts = item.options.map((option) => option.text.trim().toLowerCase());
      expect(new Set(optionIds).size).toBe(optionIds.length);
      expect(new Set(optionTexts).size).toBe(optionTexts.length);
      expect(optionIds.filter((optionId) => optionId === item.correctOptionId)).toHaveLength(1);
    }
  });

  it('has a unique non-empty prompt for every item', () => {
    const prompts = items.map((item) => item.prompt.trim().toLowerCase().replace(/\s+/g, ' '));
    expect(new Set(prompts).size).toBe(items.length);
    for (const item of items) {
      expect(item.prompt.trim().length).toBeGreaterThan(0);
      expect(item.explanation.trim().length).toBeGreaterThan(0);
    }
  });

  it('tags every item as an assessment item at B2', () => {
    for (const item of items) {
      expect(item.tags).toContain('assessment');
      expect(item.tags).toContain('B2');
      expect(item.topic.trim().length).toBeGreaterThan(0);
      expect(item.register).toBeDefined();
    }
  });

  it('keeps difficulty close to the B2 centre', () => {
    const centre = CEFR_THETA_CENTERS.B2;
    for (const item of items) {
      expect(Math.abs(item.difficultyB - centre)).toBeLessThanOrEqual(0.3);
    }
  });

  it('includes a passage and a question in reading and pragmatics prompts', () => {
    for (const item of items.filter(
      (entry) => entry.skill === 'reading' || entry.skill === 'pragmatics',
    )) {
      expect(item.prompt).toContain('Passage:');
      expect(item.prompt).toContain('Question:');
    }
  });
});
