import type { CefrLevel, SkillDomain } from '@loqua/core';

export const EVIDENCE_TYPES = [
  'objective_mcq',
  'cloze',
  'transformation',
  'comprehension',
  'listening_mcq',
  'writing_task',
  'speaking_task',
  'roleplay',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface CanDoStatement {
  readonly id: string;
  readonly level: CefrLevel;
  readonly skill: SkillDomain;
  readonly statement: string;
  readonly conceptIds: readonly string[];
  readonly evidenceTypes: readonly EvidenceType[];
}

export const CAN_DO_STATEMENTS: readonly CanDoStatement[] = [
  {
    id: 'en.can.a1.introduce_self',
    level: 'A1',
    skill: 'speaking',
    statement: 'Introduce myself and ask simple personal questions.',
    conceptIds: ['en.speak.introductions', 'en.prag.greetings', 'en.vocab.family'],
    evidenceTypes: ['speaking_task', 'roleplay'],
  },
  {
    id: 'en.can.a1.talk_about_routine',
    level: 'A1',
    skill: 'grammar',
    statement: 'Describe my daily routine with simple present statements.',
    conceptIds: ['en.gram.tense.present_simple', 'en.vocab.daily_routine'],
    evidenceTypes: ['objective_mcq', 'cloze'],
  },
  {
    id: 'en.can.a1.read_signs',
    level: 'A1',
    skill: 'reading',
    statement: 'Understand short signs, labels, and opening hours.',
    conceptIds: ['en.read.signs_labels', 'en.vocab.food'],
    evidenceTypes: ['objective_mcq'],
  },
  {
    id: 'en.can.a1.write_personal_details',
    level: 'A1',
    skill: 'writing',
    statement: 'Fill in personal details on a simple form.',
    conceptIds: ['en.write.personal_details'],
    evidenceTypes: ['writing_task'],
  },
  {
    id: 'en.can.a1.buy_food',
    level: 'A1',
    skill: 'pragmatics',
    statement: 'Ask for food or drink politely in a shop or cafe.',
    conceptIds: ['en.prag.requests', 'en.vocab.food'],
    evidenceTypes: ['roleplay', 'listening_mcq'],
  },
  {
    id: 'en.can.a2.describe_past_weekend',
    level: 'A2',
    skill: 'grammar',
    statement: 'Describe a past weekend with simple past forms.',
    conceptIds: ['en.gram.tense.past_simple', 'en.vocab.travel'],
    evidenceTypes: ['cloze', 'transformation'],
  },
  {
    id: 'en.can.a2.use_travel_vocabulary',
    level: 'A2',
    skill: 'vocabulary',
    statement: 'Use common travel words to buy a ticket and ask for directions.',
    conceptIds: ['en.vocab.travel', 'en.prag.requests'],
    evidenceTypes: ['objective_mcq', 'roleplay'],
  },
  {
    id: 'en.can.a2.make_polite_requests',
    level: 'A2',
    skill: 'pragmatics',
    statement: 'Make simple requests with could and would.',
    conceptIds: ['en.prag.requests', 'en.vocab.food'],
    evidenceTypes: ['roleplay', 'objective_mcq'],
  },
  {
    id: 'en.can.a2.follow_short_conversation',
    level: 'A2',
    skill: 'listening',
    statement: 'Follow a short conversation about daily life or services.',
    conceptIds: ['en.list.routine_conversation', 'en.vocab.daily_routine'],
    evidenceTypes: ['listening_mcq'],
  },
  {
    id: 'en.can.a2.write_short_message',
    level: 'A2',
    skill: 'writing',
    statement: 'Write a short personal message with connected sentences.',
    conceptIds: ['en.write.connected_sentences', 'en.gram.tense.past_simple'],
    evidenceTypes: ['writing_task'],
  },
  {
    id: 'en.can.a2.talk_future_plans',
    level: 'A2',
    skill: 'grammar',
    statement: 'Talk about future plans with will and going to.',
    conceptIds: ['en.gram.future.will_going_to', 'en.vocab.travel'],
    evidenceTypes: ['objective_mcq', 'speaking_task'],
  },
  {
    id: 'en.can.a2.apologize',
    level: 'A2',
    skill: 'pragmatics',
    statement: 'Apologize and respond to an apology in a common situation.',
    conceptIds: ['en.prag.apologies'],
    evidenceTypes: ['roleplay', 'objective_mcq'],
  },
  {
    id: 'en.can.b1.describe_experience',
    level: 'B1',
    skill: 'grammar',
    statement: 'Describe a past experience and explain why it matters now.',
    conceptIds: [
      'en.gram.tense.present_perfect_experience',
      'en.gram.tense.present_perfect_vs_past_simple',
    ],
    evidenceTypes: ['cloze', 'writing_task'],
  },
  {
    id: 'en.can.b1.give_opinion_with_reasons',
    level: 'B1',
    skill: 'speaking',
    statement: 'Give an opinion and support it with connected reasons.',
    conceptIds: ['en.speak.giving_reasons', 'en.prag.hedging'],
    evidenceTypes: ['speaking_task', 'objective_mcq'],
  },
  {
    id: 'en.can.b1.handle_phone_call',
    level: 'B1',
    skill: 'listening',
    statement: 'Handle a routine phone call and ask for repetition.',
    conceptIds: ['en.prag.requests', 'en.list.standard_speech_main_points'],
    evidenceTypes: ['listening_mcq', 'roleplay'],
  },
  {
    id: 'en.can.b1.write_informal_email',
    level: 'B1',
    skill: 'writing',
    statement: 'Write an informal email with clear paragraphs and a purpose.',
    conceptIds: ['en.write.paragraphs_informal_email', 'en.gram.tense.past_simple'],
    evidenceTypes: ['writing_task'],
  },
  {
    id: 'en.can.b1.understand_main_points',
    level: 'B1',
    skill: 'listening',
    statement: 'Identify the main points of clear, standard speech on familiar topics.',
    conceptIds: ['en.list.standard_speech_main_points', 'en.list.routine_conversation'],
    evidenceTypes: ['listening_mcq', 'comprehension'],
  },
  {
    id: 'en.can.b1.explain_work_task',
    level: 'B1',
    skill: 'speaking',
    statement: 'Explain a simple work task and the steps involved.',
    conceptIds: ['en.vocab.work', 'en.speak.giving_reasons'],
    evidenceTypes: ['speaking_task', 'comprehension'],
  },
  {
    id: 'en.can.b1.use_present_perfect_vs_past',
    level: 'B1',
    skill: 'grammar',
    statement: 'Choose between the present perfect and past simple.',
    conceptIds: ['en.gram.tense.present_perfect_vs_past_simple', 'en.gram.tense.past_simple'],
    evidenceTypes: ['transformation', 'cloze'],
  },
  {
    id: 'en.can.b2.argue_a_position',
    level: 'B2',
    skill: 'speaking',
    statement: 'Argue a position and respond to a counter-argument.',
    conceptIds: ['en.speak.arguing_position', 'en.prag.disagreeing_politely'],
    evidenceTypes: ['speaking_task', 'roleplay'],
  },
  {
    id: 'en.can.b2.follow_natural_discussion',
    level: 'B2',
    skill: 'listening',
    statement: 'Follow an extended discussion at natural speed.',
    conceptIds: ['en.list.natural_speed_discussion', 'en.vocab.abstract_topics'],
    evidenceTypes: ['listening_mcq', 'comprehension'],
  },
  {
    id: 'en.can.b2.read_long_article',
    level: 'B2',
    skill: 'reading',
    statement: 'Read a long article and identify its argument and examples.',
    conceptIds: ['en.read.long_articles', 'en.vocab.abstract_topics'],
    evidenceTypes: ['comprehension', 'objective_mcq'],
  },
  {
    id: 'en.can.b2.write_detailed_text',
    level: 'B2',
    skill: 'writing',
    statement: 'Write a clear, detailed text with relevant examples.',
    conceptIds: ['en.write.detailed_texts', 'en.gram.relative_clauses'],
    evidenceTypes: ['writing_task'],
  },
  {
    id: 'en.can.b2.disagree_politely',
    level: 'B2',
    skill: 'pragmatics',
    statement: 'Disagree politely and keep the conversation cooperative.',
    conceptIds: ['en.prag.disagreeing_politely', 'en.prag.hedging'],
    evidenceTypes: ['roleplay', 'speaking_task'],
  },
  {
    id: 'en.can.c1.infer_implicit_meaning',
    level: 'C1',
    skill: 'listening',
    statement: 'Infer stance and implication from fast, unscripted speech.',
    conceptIds: ['en.list.implicit_meaning', 'en.read.demanding_stance'],
    evidenceTypes: ['listening_mcq', 'comprehension'],
  },
  {
    id: 'en.can.c1.adapt_register',
    level: 'C1',
    skill: 'pragmatics',
    statement: 'Adapt register and indirectness to the situation.',
    conceptIds: ['en.vocab.register.nuance', 'en.prag.indirectness_humor'],
    evidenceTypes: ['roleplay', 'transformation'],
  },
  {
    id: 'en.can.c1.write_professional_report',
    level: 'C1',
    skill: 'writing',
    statement: 'Write a structured professional report with precise vocabulary.',
    conceptIds: [
      'en.write.professional_complex',
      'en.gram.reporting_verbs',
      'en.vocab.collocation.academic',
    ],
    evidenceTypes: ['writing_task'],
  },
  {
    id: 'en.can.c1.speak_fluently',
    level: 'C1',
    skill: 'speaking',
    statement: 'Speak fluently and adjust emphasis for effect.',
    conceptIds: ['en.speak.fluent_adjusting_emphasis', 'en.vocab.idioms'],
    evidenceTypes: ['speaking_task'],
  },
];

export type PlacementPartKind = 'objective' | 'writing' | 'speaking';

export interface PlacementItemRange {
  readonly min: number;
  readonly max: number;
}

export interface PlacementBlueprintPart {
  readonly id: string;
  readonly skill: SkillDomain;
  readonly kind: PlacementPartKind;
  readonly itemRange: PlacementItemRange;
  readonly minimumEvidence: number;
  readonly weight: number;
  readonly evidenceTypes: readonly EvidenceType[];
}

export interface PlacementBlueprint {
  readonly objectiveItemRange: PlacementItemRange;
  readonly writingTaskCount: number;
  readonly speakingTaskCount: number;
  readonly parts: readonly PlacementBlueprintPart[];
}

export const PLACEMENT_BLUEPRINT: PlacementBlueprint = {
  objectiveItemRange: { min: 18, max: 24 },
  writingTaskCount: 1,
  speakingTaskCount: 2,
  parts: [
    {
      id: 'placement.grammar',
      skill: 'grammar',
      kind: 'objective',
      itemRange: { min: 7, max: 8 },
      minimumEvidence: 3,
      weight: 0.2,
      evidenceTypes: ['objective_mcq', 'cloze', 'transformation'],
    },
    {
      id: 'placement.vocabulary',
      skill: 'vocabulary',
      kind: 'objective',
      itemRange: { min: 4, max: 6 },
      minimumEvidence: 3,
      weight: 0.15,
      evidenceTypes: ['objective_mcq', 'cloze'],
    },
    {
      id: 'placement.listening',
      skill: 'listening',
      kind: 'objective',
      itemRange: { min: 3, max: 4 },
      minimumEvidence: 2,
      weight: 0.15,
      evidenceTypes: ['listening_mcq', 'comprehension'],
    },
    {
      id: 'placement.reading',
      skill: 'reading',
      kind: 'objective',
      itemRange: { min: 2, max: 3 },
      minimumEvidence: 2,
      weight: 0.15,
      evidenceTypes: ['comprehension', 'objective_mcq'],
    },
    {
      id: 'placement.pragmatics',
      skill: 'pragmatics',
      kind: 'objective',
      itemRange: { min: 2, max: 3 },
      minimumEvidence: 2,
      weight: 0.05,
      evidenceTypes: ['objective_mcq', 'roleplay'],
    },
    {
      id: 'placement.writing',
      skill: 'writing',
      kind: 'writing',
      itemRange: { min: 1, max: 1 },
      minimumEvidence: 1,
      weight: 0.15,
      evidenceTypes: ['writing_task'],
    },
    {
      id: 'placement.speaking',
      skill: 'speaking',
      kind: 'speaking',
      itemRange: { min: 2, max: 2 },
      minimumEvidence: 2,
      weight: 0.15,
      evidenceTypes: ['speaking_task'],
    },
  ],
};

const CAN_DO_BY_ID = new Map(CAN_DO_STATEMENTS.map((statement) => [statement.id, statement]));

export function getCanDoStatement(canDoId: string): CanDoStatement | undefined {
  return CAN_DO_BY_ID.get(canDoId);
}

export function getCanDoStatementsForLevel(level: CefrLevel): readonly CanDoStatement[] {
  return CAN_DO_STATEMENTS.filter((statement) => statement.level === level);
}
