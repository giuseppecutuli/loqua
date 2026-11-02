import type { FoundationItem, FoundationItemPack } from '../item-bank.js';

import { GRAMMAR_BANK } from './grammar.js';
import { READING_PRAGMATICS_BANK } from './reading-pragmatics.js';
import { VOCABULARY_BANK } from './vocabulary.js';

export { GRAMMAR_BANK, READING_PRAGMATICS_BANK, VOCABULARY_BANK };

export const FOUNDATION_BANKS: readonly FoundationItemPack[] = [
  GRAMMAR_BANK,
  VOCABULARY_BANK,
  READING_PRAGMATICS_BANK,
];

export const FOUNDATION_ITEMS: readonly FoundationItem[] = FOUNDATION_BANKS.flatMap(
  (bank) => bank.items,
);
