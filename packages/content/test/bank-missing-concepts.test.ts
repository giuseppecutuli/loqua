import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { MISSING_CONCEPTS_BANK } from '../src/bank/missing-concepts.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, getConcept } from '../src/knowledge-graph.js';

const EXPECTED_CONCEPTS: ReadonlyArray<{
  readonly id: string;
  readonly domain: 'grammar' | 'vocabulary' | 'pragmatics';
  readonly level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
}> = [
  { id: 'en.gram.article.zero', domain: 'grammar', level: 'A1' },
  { id: 'en.prag.greetings', domain: 'pragmatics', level: 'A1' },
  { id: 'en.gram.tense.past_participle_irregular', domain: 'grammar', level: 'A2' },
  { id: 'en.gram.tense.present_perfect_form', domain: 'grammar', level: 'A2' },
  { id: 'en.gram.passive.present', domain: 'grammar', level: 'B1' },
  { id: 'en.gram.preposition.depend_on', domain: 'grammar', level: 'B1' },
  { id: 'en.gram.syntax.subject', domain: 'grammar', level: 'B1' },
  { id: 'en.gram.tense.present_perfect_experience', domain: 'grammar', level: 'B1' },
  { id: 'en.gram.tense.present_perfect_vs_past_simple', domain: 'grammar', level: 'B1' },
  { id: 'en.vocab.phrasal.look_after', domain: 'vocabulary', level: 'B1' },
  { id: 'en.vocab.idioms', domain: 'vocabulary', level: 'B2' },
  { id: 'en.gram.inversion.negative', domain: 'grammar', level: 'C1' },
  { id: 'en.gram.reporting_verbs', domain: 'grammar', level: 'C1' },
];

const items = MISSING_CONCEPTS_BANK.items;

describe('missing concepts foundation bank', () => {
  it('uses the expected pack id', () => {
    expect(MISSING_CONCEPTS_BANK.id).toBe('bank.missing-concepts.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('contains exactly three items per expected concept (39 total)', () => {
    expect(items).toHaveLength(EXPECTED_CONCEPTS.length * 3);
    for (const expected of EXPECTED_CONCEPTS) {
      const count = items.filter((item) => item.conceptId === expected.id).length;
      expect(count, expected.id).toBe(3);
    }
  });

  it('covers only the expected concepts with matching ids, domains, and levels', () => {
    const expectedById = new Map(EXPECTED_CONCEPTS.map((concept) => [concept.id, concept]));
    const covered = new Set(items.map((item) => item.conceptId));
    expect(covered.size).toBe(EXPECTED_CONCEPTS.length);

    for (const item of items) {
      const expected = expectedById.get(item.conceptId);
      expect(expected, item.id).toBeDefined();
      const concept = getConcept(item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(item.skill, item.id).toBe(expected?.domain);
      expect(item.cefrLevel, item.id).toBe(expected?.level);
      expect(concept?.domain, item.id).toBe(expected?.domain);
      expect(concept?.level, item.id).toBe(expected?.level);
    }
  });

  it('uses unique, namespaced item ids', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.missing\.[a-z_]+\.[1-3]$/);
    }
  });

  it('uses allowed item types with 3-4 unique options and one correct answer', () => {
    for (const item of items) {
      expect(['cloze', 'error_spotting', 'reading_mcq'], item.id).toContain(item.type);
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
    }
  });

  it('keeps difficulty near the CEFR center and has explanations and tags', () => {
    for (const item of items) {
      const center = CEFR_THETA_CENTERS[item.cefrLevel];
      expect(Math.abs(item.difficultyB - center), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });

  it('references concepts that exist in the knowledge graph', () => {
    const knownIds = new Set(CONCEPTS.map((concept) => concept.id));
    for (const item of items) {
      expect(knownIds.has(item.conceptId), item.id).toBe(true);
    }
  });
});
