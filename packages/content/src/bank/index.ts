import type { FoundationItem, FoundationItemPack } from '../item-bank.js';

import { ASSESSMENT_A1A2_BANK } from './assessment-a1a2.js';
import { ASSESSMENT_B1_BANK } from './assessment-b1.js';
import { ASSESSMENT_B2_BANK } from './assessment-b2.js';
import { ASSESSMENT_C1_BANK } from './assessment-c1.js';
import { GRAMMAR_BANK } from './grammar.js';
import { MISSING_CONCEPTS_BANK } from './missing-concepts.js';
import { READING_PRAGMATICS_BANK } from './reading-pragmatics.js';
import { VOCABULARY_BANK } from './vocabulary.js';

export {
  ASSESSMENT_A1A2_BANK,
  ASSESSMENT_B1_BANK,
  ASSESSMENT_B2_BANK,
  ASSESSMENT_C1_BANK,
  GRAMMAR_BANK,
  MISSING_CONCEPTS_BANK,
  READING_PRAGMATICS_BANK,
  VOCABULARY_BANK,
};

export const FOUNDATION_BANKS: readonly FoundationItemPack[] = [
  GRAMMAR_BANK,
  VOCABULARY_BANK,
  READING_PRAGMATICS_BANK,
  MISSING_CONCEPTS_BANK,
  ASSESSMENT_A1A2_BANK,
  ASSESSMENT_B1_BANK,
  ASSESSMENT_B2_BANK,
  ASSESSMENT_C1_BANK,
];

export const FOUNDATION_ITEMS: readonly FoundationItem[] = FOUNDATION_BANKS.flatMap(
  (bank) => bank.items,
);
