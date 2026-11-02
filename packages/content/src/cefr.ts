import type { CefrLevel, SkillDomain } from '@loqua/core';

export interface CefrDescriptor {
  readonly level: CefrLevel;
  readonly canDo: Readonly<Record<SkillDomain, string>>;
}

export const CEFR_DESCRIPTORS: readonly CefrDescriptor[] = [
  {
    level: 'A1',
    canDo: {
      grammar: 'Uses fixed phrases and simple present forms for basic needs.',
      vocabulary: 'Recognizes everyday words about self, family, and immediate surroundings.',
      listening: 'Understands slow, clearly articulated phrases about familiar topics.',
      speaking: 'Introduces self and asks simple questions with support.',
      reading: 'Reads short notices, menus, and labels.',
      writing: 'Writes short messages and fills in personal details.',
      pragmatics: 'Uses greetings and thanks in predictable situations.',
    },
  },
  {
    level: 'A2',
    canDo: {
      grammar: 'Handles simple past and future forms in short, connected sentences.',
      vocabulary: 'Covers routine activities, shopping, travel, and work basics.',
      listening: 'Follows short conversations on familiar, everyday topics.',
      speaking: 'Describes routines and handles simple transactions.',
      reading: 'Reads short articles and personal messages.',
      writing: 'Writes connected sentences about familiar topics.',
      pragmatics: 'Makes requests and apologies in common service situations.',
    },
  },
  {
    level: 'B1',
    canDo: {
      grammar: 'Links clauses and uses perfect and conditional forms with some control.',
      vocabulary: 'Explains opinions and experiences with a developing range.',
      listening: 'Understands the main points of clear standard speech.',
      speaking: 'Sustains a conversation on familiar matters and gives reasons.',
      reading: 'Reads factual texts and simple narratives.',
      writing: 'Writes structured paragraphs and informal emails.',
      pragmatics: 'Negotiates meaning and repairs misunderstandings.',
    },
  },
  {
    level: 'B2',
    canDo: {
      grammar: 'Produces complex sentences with generally reliable tense and aspect control.',
      vocabulary: 'Uses precise vocabulary for abstract and professional topics.',
      listening: 'Follows extended speech and discussion at natural speed.',
      speaking: 'Argues a position and adapts register to the situation.',
      reading: 'Reads long articles and reports efficiently.',
      writing: 'Writes clear, detailed texts with relevant examples.',
      pragmatics: 'Handles disagreement, persuasion, and polite negotiation.',
    },
  },
  {
    level: 'C1',
    canDo: {
      grammar: 'Controls a wide range of structures flexibly and precisely.',
      vocabulary: 'Uses idiomatic language, collocation, and nuanced register.',
      listening: 'Understands implicit meaning in fast, unscripted speech.',
      speaking: 'Speaks fluently and adjusts emphasis for effect.',
      reading: 'Understands demanding texts, including stance and implication.',
      writing: 'Writes well-structured, complex texts for professional purposes.',
      pragmatics: 'Navigates humor, indirectness, and high-stakes interaction.',
    },
  },
];
