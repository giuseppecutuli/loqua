import type { FoundationItem, FoundationItemPack } from '../item-bank.js';
import { CONCEPTS, type Concept } from '../knowledge-graph.js';

import { ASSESSMENT_A1A2_BANK } from './assessment-a1a2.js';
import { ASSESSMENT_B1_BANK } from './assessment-b1.js';
import { ASSESSMENT_B2_BANK } from './assessment-b2.js';
import { ASSESSMENT_C1_BANK } from './assessment-c1.js';
import { DEPTH_GRAMMAR_A1A2_BANK } from './depth-grammar-a1a2.js';
import { DEPTH_GRAMMAR_B1C1_BANK } from './depth-grammar-b1c1.js';
import {
  DEPTH_READING_PRAGMATICS_BANK,
  DEPTH_READING_PRAGMATICS_CONCEPTS,
} from './depth-reading-pragmatics.js';
import { DEPTH_VOCABULARY_BANK, DEPTH_VOCABULARY_CONCEPTS } from './depth-vocabulary.js';
import { EXERCISE_MODES_BANK } from './exercise-modes.js';
import { GRAMMAR_BANK } from './grammar.js';
import { LEGACY_GRAMMAR_DEPTH_BANK } from './legacy-grammar-depth.js';
import { LISTENING_BANK } from './listening.js';
import { LEGACY_CONCEPTS } from './legacy-concepts.js';
import { MISSING_CONCEPTS_BANK } from './missing-concepts.js';
import { M2_PRACTICE_A_BANK } from './m2-practice-a.js';
import { M2_PRACTICE_B_BANK } from './m2-practice-b.js';
import { M2_PRACTICE_C_BANK } from './m2-practice-c.js';
import { M2_LISTENING_BANK } from './m2-listening.js';
import { PRODUCTION_MODES_BANK } from './production-modes.js';
import { READING_PRAGMATICS_BANK } from './reading-pragmatics.js';
import { VOCABULARY_BANK } from './vocabulary.js';

export {
  ASSESSMENT_A1A2_BANK,
  ASSESSMENT_B1_BANK,
  ASSESSMENT_B2_BANK,
  ASSESSMENT_C1_BANK,
  DEPTH_GRAMMAR_A1A2_BANK,
  DEPTH_GRAMMAR_B1C1_BANK,
  DEPTH_READING_PRAGMATICS_BANK,
  DEPTH_READING_PRAGMATICS_CONCEPTS,
  DEPTH_VOCABULARY_BANK,
  DEPTH_VOCABULARY_CONCEPTS,
  EXERCISE_MODES_BANK,
  GRAMMAR_BANK,
  LEGACY_GRAMMAR_DEPTH_BANK,
  LISTENING_BANK,
  M2_LISTENING_BANK,
  M2_PRACTICE_A_BANK,
  M2_PRACTICE_B_BANK,
  M2_PRACTICE_C_BANK,
  MISSING_CONCEPTS_BANK,
  PRODUCTION_MODES_BANK,
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
  DEPTH_GRAMMAR_A1A2_BANK,
  DEPTH_GRAMMAR_B1C1_BANK,
  DEPTH_READING_PRAGMATICS_BANK,
  DEPTH_VOCABULARY_BANK,
  LEGACY_GRAMMAR_DEPTH_BANK,
  LISTENING_BANK,
  M2_PRACTICE_A_BANK,
  M2_PRACTICE_B_BANK,
  M2_PRACTICE_C_BANK,
  M2_LISTENING_BANK,
  EXERCISE_MODES_BANK,
  PRODUCTION_MODES_BANK,
];

const ALL_CONCEPTS_BY_ID = new Map(
  [
    ...CONCEPTS,
    ...LEGACY_CONCEPTS,
    ...DEPTH_READING_PRAGMATICS_CONCEPTS,
    ...DEPTH_VOCABULARY_CONCEPTS,
  ].map((concept) => [concept.id, concept]),
);

export const ALL_CONCEPTS: readonly Concept[] = [...ALL_CONCEPTS_BY_ID.values()];

export const FOUNDATION_ITEMS: readonly FoundationItem[] = FOUNDATION_BANKS.flatMap(
  (bank) => bank.items,
);
