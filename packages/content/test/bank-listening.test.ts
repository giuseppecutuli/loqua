import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { LISTENING_BANK } from '../src/bank/listening.js';
import { ALL_CONCEPTS, FOUNDATION_ITEMS } from '../src/bank/index.js';
import { validateFoundationItems } from '../src/item-bank.js';

const EXPECTED_CONCEPTS: ReadonlyArray<{
  readonly id: string;
  readonly level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
}> = [
  { id: 'en.list.classroom_instructions', level: 'A1' },
  { id: 'en.list.routine_conversation', level: 'A2' },
  { id: 'en.list.standard_speech_main_points', level: 'B1' },
  { id: 'en.list.natural_speed_discussion', level: 'B2' },
  { id: 'en.list.implicit_meaning', level: 'C1' },
];

const items = LISTENING_BANK.items;

const normalize = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ');

describe('listening foundation bank', () => {
  it('uses the expected pack id', () => {
    expect(LISTENING_BANK.id).toBe('bank.listening.v1');
  });

  it('passes foundation item validation against all concepts', () => {
    expect(validateFoundationItems(items, ALL_CONCEPTS)).toEqual([]);
  });

  it('contains exactly 25 items, five per expected concept', () => {
    expect(items).toHaveLength(25);
    for (const expected of EXPECTED_CONCEPTS) {
      const conceptItems = items.filter((item) => item.conceptId === expected.id);
      expect(conceptItems, expected.id).toHaveLength(5);
    }
  });

  it('covers only the expected listening concepts with matching skill and level', () => {
    const expectedById = new Map(EXPECTED_CONCEPTS.map((concept) => [concept.id, concept]));
    const covered = new Set(items.map((item) => item.conceptId));
    expect(covered.size).toBe(EXPECTED_CONCEPTS.length);

    for (const item of items) {
      const expected = expectedById.get(item.conceptId);
      expect(expected, item.id).toBeDefined();
      expect(item.skill, item.id).toBe('listening');
      expect(item.cefrLevel, item.id).toBe(expected?.level);
      expect(item.type, item.id).toBe('listening_mcq');
    }
  });

  it('uses unique, namespaced item ids', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.listening\.\d+$/);
    }
  });

  it('includes non-empty audio text on every item', () => {
    for (const item of items) {
      expect(item.audioText, item.id).toBeDefined();
      expect(item.audioText?.trim().length ?? 0, item.id).toBeGreaterThan(0);
    }
  });

  it('uses unique prompts within the pack and against the foundation items', () => {
    const prompts = items.map((item) => normalize(item.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);

    const existing = new Set(
      FOUNDATION_ITEMS.filter((item) => !item.id.startsWith('bank.listening.')).map((item) =>
        normalize(item.prompt),
      ),
    );
    for (const item of items) {
      expect(existing.has(normalize(item.prompt)), item.id).toBe(false);
    }
  });

  it('uses 3-4 unique options and exactly one defensible answer', () => {
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

  it('keeps difficulty near the CEFR centre and includes explanation, topic, and tags', () => {
    for (const item of items) {
      const centre = CEFR_THETA_CENTERS[item.cefrLevel];
      expect(Math.abs(item.difficultyB - centre), item.id).toBeLessThanOrEqual(0.2);
      expect(item.explanation.trim().length, item.id).toBeGreaterThan(0);
      expect(item.topic.trim().length, item.id).toBeGreaterThan(0);
      expect(item.tags.length, item.id).toBeGreaterThan(0);
    }
  });
});
