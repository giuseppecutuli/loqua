import { describe, expect, it } from 'vitest';

import { CEFR_THETA_CENTERS } from '@loqua/core';

import { ALL_CONCEPTS, FOUNDATION_ITEMS } from '../src/bank/index.js';
import { M2_LISTENING_BANK } from '../src/bank/m2-listening.js';
import { validateFoundationItems } from '../src/item-bank.js';

const EXPECTED_CONCEPTS: ReadonlyArray<{
  readonly id: string;
  readonly level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  readonly count: number;
}> = [
  { id: 'en.list.classroom_instructions', level: 'A1', count: 12 },
  { id: 'en.list.routine_conversation', level: 'A2', count: 13 },
  { id: 'en.list.standard_speech_main_points', level: 'B1', count: 14 },
  { id: 'en.list.natural_speed_discussion', level: 'B2', count: 14 },
  { id: 'en.list.implicit_meaning', level: 'C1', count: 14 },
];

const PREFIX = 'bank.m2.listening.';

const items = M2_LISTENING_BANK.items;

const normalize = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ');

const externalFoundationItems = FOUNDATION_ITEMS.filter((item) => !item.id.startsWith(PREFIX));

describe('m2 listening practice bank', () => {
  it('uses the expected pack id', () => {
    expect(M2_LISTENING_BANK.id).toBe('bank.m2.listening.v1');
  });

  it('contains exactly 67 items', () => {
    expect(items).toHaveLength(67);
  });

  it('passes foundation item validation against all concepts', () => {
    expect(validateFoundationItems(items, ALL_CONCEPTS)).toEqual([]);
  });

  it('passes foundation item validation combined with the external foundation items', () => {
    expect(validateFoundationItems([...externalFoundationItems, ...items], ALL_CONCEPTS)).toEqual(
      [],
    );
  });

  it('has the exact requested number of items per concept', () => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.conceptId, (counts.get(item.conceptId) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(
      EXPECTED_CONCEPTS.map((concept) => concept.id).sort(),
    );
    for (const expected of EXPECTED_CONCEPTS) {
      expect(counts.get(expected.id), expected.id).toBe(expected.count);
    }
  });

  it('covers only the expected listening concepts with matching skill, level, and type', () => {
    const expectedById = new Map(EXPECTED_CONCEPTS.map((concept) => [concept.id, concept]));

    for (const item of items) {
      const expected = expectedById.get(item.conceptId);
      expect(expected, item.id).toBeDefined();
      expect(item.skill, item.id).toBe('listening');
      expect(item.cefrLevel, item.id).toBe(expected?.level);
      expect(item.type, item.id).toBe('listening_mcq');
    }
  });

  it('uses unique, namespaced ids', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^bank\.m2\.listening\.\d+$/);
    }
    expect(ids).toEqual(Array.from({ length: 67 }, (_, index) => `${PREFIX}${index + 1}`));
  });

  it('includes non-empty audio text on every item', () => {
    for (const item of items) {
      expect(item.audioText, item.id).toBeDefined();
      expect(item.audioText?.trim().length ?? 0, item.id).toBeGreaterThan(0);
    }
  });

  it('uses unique audio text within the pack and against the external foundation items', () => {
    const audioTexts = items.map((item) => normalize(item.audioText ?? ''));
    expect(new Set(audioTexts).size).toBe(audioTexts.length);

    const existing = new Set(
      externalFoundationItems
        .map((item) => item.audioText)
        .filter((text): text is string => typeof text === 'string' && text.trim().length > 0)
        .map((text) => normalize(text)),
    );
    for (const item of items) {
      expect(existing.has(normalize(item.audioText ?? '')), item.id).toBe(false);
    }
  });

  it('uses unique prompts within the pack and against the external foundation items', () => {
    const prompts = items.map((item) => normalize(item.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);

    const existing = new Set(externalFoundationItems.map((item) => normalize(item.prompt)));
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
      expect(['casual', 'neutral', 'formal'], item.id).toContain(item.register);
    }
  });
});
