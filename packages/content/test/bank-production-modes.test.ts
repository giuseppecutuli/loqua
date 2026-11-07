import { isAnswerAccepted } from '@loqua/core';
import { describe, expect, it } from 'vitest';

import { PRODUCTION_MODES_BANK } from '../src/bank/production-modes.js';
import { validateFoundationItems } from '../src/item-bank.js';

describe('production modes bank', () => {
  it('uses the expected pack id', () => {
    expect(PRODUCTION_MODES_BANK.id).toBe('bank.production-modes.v1');
  });

  it('passes foundation item validation', () => {
    expect(validateFoundationItems(PRODUCTION_MODES_BANK.items)).toEqual([]);
  });

  it('contains 36 items with unique ids', () => {
    expect(PRODUCTION_MODES_BANK.items).toHaveLength(36);
    const ids = PRODUCTION_MODES_BANK.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses text answers for transformation and dictation', () => {
    for (const item of PRODUCTION_MODES_BANK.items) {
      if (item.type === 'transformation' || item.type === 'dictation') {
        expect(item.answerMode, item.id).toBe('text');
        expect(item.options, item.id).toHaveLength(1);
      }
    }
  });

  it('uses order answers and a word bank for word-order items', () => {
    const wordOrder = PRODUCTION_MODES_BANK.items.filter((item) => item.type === 'word_order');
    expect(wordOrder.length).toBe(12);
    for (const item of wordOrder) {
      expect(item.answerMode, item.id).toBe('order');
      expect(item.wordBank?.length, item.id).toBeGreaterThan(3);
      expect(item.options, item.id).toHaveLength(1);
    }
  });

  it('accepts every model answer', () => {
    for (const item of PRODUCTION_MODES_BANK.items) {
      const expected = item.options[0]?.text;
      if (!expected) throw new Error(`missing model answer for ${item.id}`);
      expect(isAnswerAccepted(expected, expected), item.id).toBe(true);
    }
  });

  it('builds the expected sentence from the word-order tokens', () => {
    for (const item of PRODUCTION_MODES_BANK.items) {
      if (item.type !== 'word_order') continue;
      const expected = item.options[0]?.text;
      const joined = (item.wordBank ?? []).join(' ');
      if (!expected) throw new Error(`missing model answer for ${item.id}`);
      expect(isAnswerAccepted(expected, joined), item.id).toBe(true);
    }
  });

  it('gives every dictation item audio text', () => {
    const dictation = PRODUCTION_MODES_BANK.items.filter((item) => item.type === 'dictation');
    expect(dictation).toHaveLength(10);
    for (const item of dictation) {
      expect(item.audioText?.trim().length, item.id).toBeGreaterThan(0);
    }
  });
});
