import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { READING_PRAGMATICS_BANK } from '../src/bank/reading-pragmatics.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, getConcept } from '../src/knowledge-graph.js';

const items = READING_PRAGMATICS_BANK.items;
const conceptCounts = new Map<string, number>();
for (const item of items) {
  conceptCounts.set(item.conceptId, (conceptCounts.get(item.conceptId) ?? 0) + 1);
}

describe('reading and pragmatics foundation bank', () => {
  it('has the expected pack id', () => {
    expect(READING_PRAGMATICS_BANK.id).toBe('bank.reading-pragmatics.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(items)).toEqual([]);
  });

  it('covers exactly 5 reading and 5 pragmatics concepts with 3 items each', () => {
    expect(conceptCounts.size).toBe(10);
    for (const [conceptId, count] of conceptCounts) {
      const concept = getConcept(conceptId);
      expect(concept).toBeDefined();
      expect(['reading', 'pragmatics']).toContain(concept?.domain);
      expect(count).toBe(3);
    }
    expect(items).toHaveLength(30);

    const domains = [...conceptCounts.keys()].map((conceptId) => getConcept(conceptId)?.domain);
    expect(domains.filter((domain) => domain === 'reading')).toHaveLength(5);
    expect(domains.filter((domain) => domain === 'pragmatics')).toHaveLength(5);
  });

  it('uses concept ids and levels from the knowledge graph', () => {
    for (const item of items) {
      const concept = CONCEPTS.find((entry) => entry.id === item.conceptId);
      expect(concept, item.id).toBeDefined();
      expect(item.skill).toBe(concept?.domain);
      expect(item.cefrLevel).toBe(concept?.level);
    }
  });

  it('has globally unique ids following the bank naming pattern', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of items) {
      const domain = item.skill === 'reading' ? 'reading' : 'pragmatics';
      expect(item.id).toMatch(new RegExp(`^bank\\.${domain}\\.[a-z_]+\\.[1-3]$`));
    }
  });

  it('has 3-4 options with unique ids and texts and exactly one valid answer', () => {
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

  it('includes a passage and a question in every reading prompt', () => {
    for (const item of items.filter((entry) => entry.skill === 'reading')) {
      expect(item.prompt).toContain('Passage:');
      expect(item.prompt).toContain('Question:');
      const [passage, question] = item.prompt.split('Question:');
      expect((passage ?? '').trim().length).toBeGreaterThan(40);
      expect((question ?? '').trim().length).toBeGreaterThan(10);
    }
  });

  it('keeps difficulty close to the CEFR centre', () => {
    for (const item of items) {
      const centre = CEFR_THETA_CENTERS[item.cefrLevel];
      expect(Math.abs(item.difficultyB - centre)).toBeLessThanOrEqual(0.3);
    }
  });

  it('has explanations, topics, and tags for every item', () => {
    for (const item of items) {
      expect(item.explanation.trim().length).toBeGreaterThan(0);
      expect(item.topic.trim().length).toBeGreaterThan(0);
      expect(item.tags.length).toBeGreaterThan(0);
    }
  });
});
