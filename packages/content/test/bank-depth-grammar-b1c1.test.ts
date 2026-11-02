import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { DEPTH_GRAMMAR_B1C1_BANK } from '../src/bank/depth-grammar-b1c1.js';
import { FOUNDATION_ITEMS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';
import { CONCEPTS, type Concept } from '../src/knowledge-graph.js';

const EXPECTED_CONCEPTS: ReadonlyArray<{
  readonly id: string;
  readonly domain: 'grammar';
  readonly level: 'B1' | 'B2' | 'C1';
  readonly count: number;
}> = [
  { id: 'concept-en-first-conditional', domain: 'grammar', level: 'B1', count: 4 },
  { id: 'concept-en-present-perfect', domain: 'grammar', level: 'B1', count: 4 },
  { id: 'en.gram.conditional.second', domain: 'grammar', level: 'B1', count: 2 },
  { id: 'en.gram.passive.present', domain: 'grammar', level: 'B1', count: 2 },
  { id: 'en.gram.preposition.depend_on', domain: 'grammar', level: 'B1', count: 2 },
  { id: 'en.gram.syntax.subject', domain: 'grammar', level: 'B1', count: 2 },
  { id: 'en.gram.tense.present_perfect_experience', domain: 'grammar', level: 'B1', count: 2 },
  {
    id: 'en.gram.tense.present_perfect_vs_past_simple',
    domain: 'grammar',
    level: 'B1',
    count: 2,
  },
  { id: 'en.gram.word_order.adverb', domain: 'grammar', level: 'B1', count: 2 },
  { id: 'concept-en-passive', domain: 'grammar', level: 'B2', count: 4 },
  { id: 'en.gram.modals.deduction', domain: 'grammar', level: 'B2', count: 2 },
  { id: 'en.gram.relative_clauses', domain: 'grammar', level: 'B2', count: 2 },
  { id: 'concept-en-inversion', domain: 'grammar', level: 'C1', count: 4 },
  { id: 'en.gram.inversion.negative', domain: 'grammar', level: 'C1', count: 2 },
  { id: 'en.gram.reporting_verbs', domain: 'grammar', level: 'C1', count: 2 },
];

const LEGACY_CONCEPTS: readonly Concept[] = [
  {
    id: 'concept-en-first-conditional',
    domain: 'grammar',
    level: 'B1',
    title: 'First conditional',
    description: 'Real future conditions with if + present simple and will + base verb.',
  },
  {
    id: 'concept-en-present-perfect',
    domain: 'grammar',
    level: 'B1',
    title: 'Present perfect',
    description: 'Past actions with a present result, formed with have or has + past participle.',
  },
  {
    id: 'concept-en-passive',
    domain: 'grammar',
    level: 'B2',
    title: 'Passive voice',
    description: 'Focusing on the action or result with be + past participle.',
  },
  {
    id: 'concept-en-inversion',
    domain: 'grammar',
    level: 'C1',
    title: 'Negative inversion',
    description: 'Inverting auxiliaries and subjects after fronted negative adverbials.',
  },
];

const DEPTH_CONCEPTS: readonly Concept[] = [...CONCEPTS, ...LEGACY_CONCEPTS];

const items = DEPTH_GRAMMAR_B1C1_BANK.items;

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

describe('depth grammar B1-C1 bank', () => {
  it('uses the expected pack id', () => {
    expect(DEPTH_GRAMMAR_B1C1_BANK.id).toBe('bank.depth.grammar.b1c1.v1');
  });

  it('passes foundation item validation on its own', () => {
    expect(validateFoundationItems(items, DEPTH_CONCEPTS)).toEqual([]);
  });

  it('passes foundation item validation combined with the foundation bank', () => {
    expect(validateFoundationItems([...FOUNDATION_ITEMS, ...items], DEPTH_CONCEPTS)).toEqual([]);
  });

  it('contains exactly 38 practice items', () => {
    expect(items).toHaveLength(38);
    for (const item of items) {
      expect(item.tags.includes('assessment'), item.id).toBe(false);
    }
  });

  it('contains the exact requested number of items per concept', () => {
    for (const expected of EXPECTED_CONCEPTS) {
      const count = items.filter((item) => item.conceptId === expected.id).length;
      expect(count, expected.id).toBe(expected.count);
    }
    const total = EXPECTED_CONCEPTS.reduce((sum, expected) => sum + expected.count, 0);
    expect(total).toBe(38);
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

  it('uses canonical concept ids for the existing knowledge graph', () => {
    const knownIds = new Set(CONCEPTS.map((concept) => concept.id));
    const legacyIds = new Set(LEGACY_CONCEPTS.map((concept) => concept.id));
    for (const item of items) {
      expect(knownIds.has(item.conceptId) || legacyIds.has(item.conceptId), item.id).toBe(true);
    }
  });

  it('uses unique, namespaced item ids', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.depth\.grammar\.b1c1\.\d+$/);
    }
  });

  it('uses unique prompts within the pack and against the foundation bank', () => {
    const prompts = items.map((item) => normalizePrompt(item.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);

    const foundationPrompts = new Set(FOUNDATION_ITEMS.map((item) => normalizePrompt(item.prompt)));
    for (const prompt of prompts) {
      expect(foundationPrompts.has(prompt), prompt).toBe(false);
    }
  });

  it('uses cloze or error spotting with 3-4 unique options and one answer', () => {
    for (const item of items) {
      expect(['cloze', 'error_spotting'], item.id).toContain(item.type);
      expect(item.options.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.options.length, item.id).toBeLessThanOrEqual(4);

      const optionIds = item.options.map((option) => option.id);
      const optionTexts = item.options.map((option) => option.text.trim().toLowerCase());
      expect(new Set(optionIds).size, item.id).toBe(optionIds.length);
      expect(new Set(optionTexts).size, item.id).toBe(optionTexts.length);
      expect(optionIds.filter((id) => id === item.correctOptionId), item.id).toHaveLength(1);
    }
  });

  it('keeps difficulty near the CEFR center and has explanations, topics, and tags', () => {
    for (const item of items) {
      const center = CEFR_THETA_CENTERS[item.cefrLevel];
      expect(Math.abs(item.difficultyB - center), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.register, item.id).toBeDefined();
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });
});
