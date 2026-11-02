import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { ASSESSMENT_A1A2_BANK } from '../src/bank/assessment-a1a2.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, getConcept } from '../src/knowledge-graph.js';

const items = ASSESSMENT_A1A2_BANK.items;
const ALLOWED_TYPES = ['cloze', 'error_spotting', 'reading_mcq'] as const;

describe('A1-A2 assessment foundation bank', () => {
  it('has the expected pack id', () => {
    expect(ASSESSMENT_A1A2_BANK.id).toBe('bank.assessment.a1a2.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('contains exactly 50 items with 25 at each level', () => {
    expect(items).toHaveLength(50);
    expect(items.filter((item) => item.cefrLevel === 'A1')).toHaveLength(25);
    expect(items.filter((item) => item.cefrLevel === 'A2')).toHaveLength(25);
  });

  it('uses unique ids in the assessment namespace', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(items.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.assessment\.a1a2\.[1-9]\d*$/);
    }
  });

  it('uses concepts from the knowledge graph with matching skill and level', () => {
    for (const item of items) {
      const concept = CONCEPTS.find((entry) => entry.id === item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(item.skill, item.id).toBe(concept?.domain);
      expect(item.cefrLevel, item.id).toBe(concept?.level);
    }
  });

  it('covers grammar, vocabulary, reading, and pragmatics', () => {
    const skills = new Set(items.map((item) => item.skill));
    expect(skills).toEqual(new Set(['grammar', 'vocabulary', 'reading', 'pragmatics']));
  });

  it('uses only supported item types', () => {
    for (const item of items) {
      expect(ALLOWED_TYPES).toContain(item.type);
    }
  });

  it('has 3-4 options with unique ids and texts and exactly one valid answer', () => {
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

  it('tags every item with assessment and its level and includes topic and register', () => {
    for (const item of items) {
      expect(item.tags, item.id).toContain('assessment');
      expect(item.tags, item.id).toContain(item.cefrLevel);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.register, item.id).toBeDefined();
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
    }
  });

  it('keeps difficulty near the CEFR centre', () => {
    for (const item of items) {
      const centre = CEFR_THETA_CENTERS[item.cefrLevel];
      expect(Math.abs(item.difficultyB - centre), item.id).toBeLessThanOrEqual(0.2);
    }
  });

  it('includes a passage and a question in every reading prompt', () => {
    for (const item of items.filter((entry) => entry.skill === 'reading')) {
      expect(item.prompt, item.id).toContain('Passage:');
      expect(item.prompt, item.id).toContain('Question:');
    }
  });

  it('only references existing concepts', () => {
    for (const item of items) {
      expect(getConcept(item.conceptId), item.id).toBeDefined();
    }
  });
});
