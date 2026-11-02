import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { FOUNDATION_ITEMS } from '../src/bank/index.js';
import {
  DEPTH_READING_PRAGMATICS_BANK,
  DEPTH_READING_PRAGMATICS_CONCEPTS,
} from '../src/bank/depth-reading-pragmatics.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, type Concept } from '../src/knowledge-graph.js';

const items = DEPTH_READING_PRAGMATICS_BANK.items;
const validationConcepts: readonly Concept[] = [
  ...CONCEPTS,
  ...DEPTH_READING_PRAGMATICS_CONCEPTS,
];

const EXPECTED_CONCEPTS: ReadonlyArray<{
  readonly id: string;
  readonly domain: 'reading' | 'pragmatics';
  readonly level: string;
  readonly count: number;
}> = [
  { id: 'concept-en-reading-job', domain: 'reading', level: 'A1', count: 4 },
  { id: 'en.read.signs_labels', domain: 'reading', level: 'A1', count: 2 },
  { id: 'concept-en-reading-reason', domain: 'reading', level: 'A2', count: 4 },
  { id: 'en.read.short_messages', domain: 'reading', level: 'A2', count: 2 },
  { id: 'concept-en-reading-benefit', domain: 'reading', level: 'B1', count: 4 },
  { id: 'en.read.factual_texts', domain: 'reading', level: 'B1', count: 2 },
  { id: 'concept-en-reading-causation', domain: 'reading', level: 'B2', count: 4 },
  { id: 'en.read.long_articles', domain: 'reading', level: 'B2', count: 2 },
  { id: 'en.read.demanding_stance', domain: 'reading', level: 'C1', count: 2 },
  { id: 'en.prag.greetings', domain: 'pragmatics', level: 'A1', count: 2 },
  { id: 'concept-en-polite-request', domain: 'pragmatics', level: 'A2', count: 4 },
  { id: 'en.prag.apologies', domain: 'pragmatics', level: 'A2', count: 2 },
  { id: 'en.prag.requests', domain: 'pragmatics', level: 'A2', count: 2 },
  { id: 'concept-en-feedback', domain: 'pragmatics', level: 'B1', count: 4 },
  { id: 'en.prag.hedging', domain: 'pragmatics', level: 'B1', count: 2 },
  { id: 'concept-en-disagree', domain: 'pragmatics', level: 'B2', count: 4 },
  { id: 'en.prag.disagreeing_politely', domain: 'pragmatics', level: 'B2', count: 2 },
  { id: 'en.prag.indirectness_humor', domain: 'pragmatics', level: 'C1', count: 2 },
];

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

describe('depth reading and pragmatics bank', () => {
  it('uses the expected pack id', () => {
    expect(DEPTH_READING_PRAGMATICS_BANK.id).toBe('bank.depth.reading-pragmatics.v1');
  });

  it('contains exactly 50 practice items', () => {
    expect(items).toHaveLength(50);
    for (const item of items) {
      expect(item.tags.includes('assessment'), item.id).toBe(false);
    }
  });

  it('passes foundation item validation on its own', () => {
    expect(validateFoundationItems(items, validationConcepts)).toEqual([]);
  });

  it('passes foundation item validation combined with FOUNDATION_ITEMS', () => {
    expect(
      validateFoundationItems([...FOUNDATION_ITEMS, ...items], validationConcepts),
    ).toEqual([]);
  });

  it('has the exact requested number of items per concept', () => {
    for (const expected of EXPECTED_CONCEPTS) {
      const count = items.filter((item) => item.conceptId === expected.id).length;
      expect(count, expected.id).toBe(expected.count);
    }
    const total = EXPECTED_CONCEPTS.reduce((sum, expected) => sum + expected.count, 0);
    expect(total).toBe(50);
  });

  it('covers only the expected concepts with matching domains and levels', () => {
    const expectedById = new Map(EXPECTED_CONCEPTS.map((concept) => [concept.id, concept]));
    const covered = new Set(items.map((item) => item.conceptId));
    expect(covered.size).toBe(EXPECTED_CONCEPTS.length);

    for (const item of items) {
      const expected = expectedById.get(item.conceptId);
      expect(expected, item.id).toBeDefined();
      expect(item.skill, item.id).toBe(expected?.domain);
      expect(item.cefrLevel, item.id).toBe(expected?.level);
    }
  });

  it('uses unique ids with the depth reading or pragmatics prefix', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.depth\.(reading|pragmatics)\.\d+$/);
    }

    const readingIds = items
      .filter((item) => item.skill === 'reading')
      .map((item) => item.id);
    const pragmaticsIds = items
      .filter((item) => item.skill === 'pragmatics')
      .map((item) => item.id);
    expect(readingIds).toEqual(
      Array.from({ length: 26 }, (_, index) => `bank.depth.reading.${index + 1}`),
    );
    expect(pragmaticsIds).toEqual(
      Array.from({ length: 24 }, (_, index) => `bank.depth.pragmatics.${index + 1}`),
    );
  });

  it('uses unique prompts within the pack and against the foundation bank', () => {
    const prompts = items.map((item) => normalizePrompt(item.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);

    const foundationPrompts = new Set(FOUNDATION_ITEMS.map((item) => normalizePrompt(item.prompt)));
    for (const prompt of prompts) {
      expect(foundationPrompts.has(prompt), prompt).toBe(false);
    }
  });

  it('uses reading passages or scenarios with a question', () => {
    for (const item of items) {
      expect(item.prompt, item.id).toContain('Question:');
      if (item.skill === 'reading') {
        expect(item.prompt, item.id).toContain('Passage:');
        const [passage, question] = item.prompt.split('Question:');
        expect((passage ?? '').trim().length, item.id).toBeGreaterThan(40);
        expect((question ?? '').trim().length, item.id).toBeGreaterThan(10);
      }
    }
  });

  it('uses reading_mcq or error_spotting with 3-4 unique options and one answer', () => {
    for (const item of items) {
      expect(['reading_mcq', 'error_spotting'], item.id).toContain(item.type);
      expect(item.options.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.options.length, item.id).toBeLessThanOrEqual(4);

      const optionIds = item.options.map((option) => option.id);
      const optionTexts = item.options.map((option) => option.text.trim().toLowerCase());
      expect(new Set(optionIds).size, item.id).toBe(optionIds.length);
      expect(new Set(optionTexts).size, item.id).toBe(optionTexts.length);
      expect(optionIds.filter((id) => id === item.correctOptionId), item.id).toHaveLength(1);
    }
  });

  it('keeps difficulty near the CEFR centre and has explanations, topics, and tags', () => {
    for (const item of items) {
      const centre = CEFR_THETA_CENTERS[item.cefrLevel];
      expect(Math.abs(item.difficultyB - centre), item.id).toBeLessThanOrEqual(0.3);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.register, item.id).toBeDefined();
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });
});
