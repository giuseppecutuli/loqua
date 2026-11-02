import type { CefrLevel, SkillDomain } from '@loqua/core';

export interface Concept {
  readonly id: string;
  readonly domain: SkillDomain;
  readonly level: CefrLevel;
  readonly title: string;
  readonly description: string;
}

export interface ConceptEdge {
  readonly from: string;
  readonly to: string;
  readonly weight: number;
}

export const CONCEPT_PREREQUISITE_WEIGHT = 0.7;
export const CONCEPT_MASTERY_THRESHOLD = 0.5;

export const CONCEPTS: readonly Concept[] = [
  {
    id: 'en.gram.tense.present_simple',
    domain: 'grammar',
    level: 'A1',
    title: 'Present simple',
    description: 'Affirmative, negative, and question forms for habits and facts.',
  },
  {
    id: 'en.gram.tense.present_continuous',
    domain: 'grammar',
    level: 'A1',
    title: 'Present continuous',
    description: 'Actions happening now and temporary situations.',
  },
  {
    id: 'en.gram.tense.past_simple',
    domain: 'grammar',
    level: 'A2',
    title: 'Past simple',
    description: 'Finished actions and states with regular and common irregular verbs.',
  },
  {
    id: 'en.gram.tense.past_participle_irregular',
    domain: 'grammar',
    level: 'A2',
    title: 'Irregular past participles',
    description: 'Recognizing and producing high-frequency irregular participles.',
  },
  {
    id: 'en.gram.tense.present_perfect_form',
    domain: 'grammar',
    level: 'A2',
    title: 'Present perfect form',
    description: 'Building have/has + past participle in statements, negatives, and questions.',
  },
  {
    id: 'en.gram.tense.present_perfect_experience',
    domain: 'grammar',
    level: 'B1',
    title: 'Present perfect for experience',
    description: 'Using the present perfect for life experience without a finished time.',
  },
  {
    id: 'en.gram.tense.present_perfect_vs_past_simple',
    domain: 'grammar',
    level: 'B1',
    title: 'Present perfect vs past simple',
    description: 'Choosing the form according to finished time and current relevance.',
  },
  {
    id: 'en.gram.future.will_going_to',
    domain: 'grammar',
    level: 'A2',
    title: 'Future with will and going to',
    description: 'Decisions, predictions, and plans with the two common future forms.',
  },
  {
    id: 'en.gram.conditional.first',
    domain: 'grammar',
    level: 'A2',
    title: 'First conditional',
    description: 'Real future conditions with if + present, will + base verb.',
  },
  {
    id: 'en.gram.conditional.second',
    domain: 'grammar',
    level: 'B1',
    title: 'Second conditional',
    description: 'Hypothetical present or future conditions with if + past, would + base verb.',
  },
  {
    id: 'en.gram.passive.present',
    domain: 'grammar',
    level: 'B1',
    title: 'Present passive',
    description: 'Present simple passive for processes, rules, and general facts.',
  },
  {
    id: 'en.gram.article.zero',
    domain: 'grammar',
    level: 'A1',
    title: 'Zero article',
    description: 'When general plurals and uncountable nouns take no article.',
  },
  {
    id: 'en.gram.preposition.time',
    domain: 'grammar',
    level: 'A1',
    title: 'Prepositions of time',
    description: 'Choosing in, on, and at for times, days, and dates.',
  },
  {
    id: 'en.gram.preposition.depend_on',
    domain: 'grammar',
    level: 'B1',
    title: 'Dependent prepositions',
    description: 'Fixed prepositions after common verbs, adjectives, and nouns.',
  },
  {
    id: 'en.gram.word_order.adverb',
    domain: 'grammar',
    level: 'B1',
    title: 'Adverb position',
    description: 'Placing frequency and degree adverbs in the normal English order.',
  },
  {
    id: 'en.gram.syntax.subject',
    domain: 'grammar',
    level: 'B1',
    title: 'Subject requirement',
    description:
      'Every finite English clause needs an explicit subject, including dummy it and there.',
  },
  {
    id: 'en.gram.relative_clauses',
    domain: 'grammar',
    level: 'B2',
    title: 'Relative clauses',
    description: 'Defining and non-defining clauses with who, which, that, and whose.',
  },
  {
    id: 'en.gram.modals.deduction',
    domain: 'grammar',
    level: 'B2',
    title: 'Modals of deduction',
    description: 'Expressing certainty and possibility with must, might, could, and cannot.',
  },
  {
    id: 'en.gram.inversion.negative',
    domain: 'grammar',
    level: 'C1',
    title: 'Negative inversion',
    description: 'Formal inversion after negative or restrictive adverbials.',
  },
  {
    id: 'en.gram.reporting_verbs',
    domain: 'grammar',
    level: 'C1',
    title: 'Reporting verbs',
    description: 'Reporting structures with verb patterns such as claim, argue, and suggest.',
  },
  {
    id: 'en.vocab.daily_routine',
    domain: 'vocabulary',
    level: 'A1',
    title: 'Daily routine',
    description: 'Everyday activities, times of day, and basic household actions.',
  },
  {
    id: 'en.vocab.family',
    domain: 'vocabulary',
    level: 'A1',
    title: 'Family and people',
    description: 'Close family, relationships, and basic personal descriptions.',
  },
  {
    id: 'en.vocab.food',
    domain: 'vocabulary',
    level: 'A1',
    title: 'Food and shopping',
    description: 'Common food, drinks, quantities, and simple shop transactions.',
  },
  {
    id: 'en.vocab.travel',
    domain: 'vocabulary',
    level: 'A2',
    title: 'Travel and transport',
    description: 'Tickets, directions, accommodation, and common travel problems.',
  },
  {
    id: 'en.vocab.work',
    domain: 'vocabulary',
    level: 'A2',
    title: 'Work and study',
    description: 'Jobs, tasks, schedules, and simple workplace communication.',
  },
  {
    id: 'en.vocab.false_friend.actually',
    domain: 'vocabulary',
    level: 'B1',
    title: 'False friend: actually',
    description: 'Actually means in fact, not currently or right now.',
  },
  {
    id: 'en.vocab.phrasal.look_after',
    domain: 'vocabulary',
    level: 'B1',
    title: 'Phrasal verb: look after',
    description: 'Distinguishing look after, look for, and look at.',
  },
  {
    id: 'en.vocab.collocation.make_do',
    domain: 'vocabulary',
    level: 'B1',
    title: 'Make and do collocations',
    description: 'Choosing make or do in high-frequency fixed expressions.',
  },
  {
    id: 'en.vocab.abstract_topics',
    domain: 'vocabulary',
    level: 'B2',
    title: 'Abstract topics',
    description: 'Vocabulary for society, technology, environment, and personal values.',
  },
  {
    id: 'en.vocab.idioms',
    domain: 'vocabulary',
    level: 'B2',
    title: 'Common idioms',
    description: 'Frequent idiomatic expressions with clear situational meaning.',
  },
  {
    id: 'en.vocab.collocation.academic',
    domain: 'vocabulary',
    level: 'C1',
    title: 'Academic collocations',
    description: 'Formal noun-verb and adjective-noun combinations for reports and arguments.',
  },
  {
    id: 'en.vocab.register.nuance',
    domain: 'vocabulary',
    level: 'C1',
    title: 'Register and nuance',
    description: 'Choosing words that fit formality, distance, and intended effect.',
  },
  {
    id: 'en.list.classroom_instructions',
    domain: 'listening',
    level: 'A1',
    title: 'Classroom instructions',
    description: 'Understanding short, slow instructions and predictable requests.',
  },
  {
    id: 'en.list.routine_conversation',
    domain: 'listening',
    level: 'A2',
    title: 'Routine conversations',
    description: 'Following short exchanges about daily life, plans, and services.',
  },
  {
    id: 'en.list.standard_speech_main_points',
    domain: 'listening',
    level: 'B1',
    title: 'Main points of standard speech',
    description: 'Identifying the main points of clear, standard speech on familiar topics.',
  },
  {
    id: 'en.list.natural_speed_discussion',
    domain: 'listening',
    level: 'B2',
    title: 'Natural-speed discussion',
    description: 'Following extended discussion at natural speed with some redundancy.',
  },
  {
    id: 'en.list.implicit_meaning',
    domain: 'listening',
    level: 'C1',
    title: 'Implicit meaning in speech',
    description: 'Inferring stance, implication, and humor in unscripted speech.',
  },
  {
    id: 'en.speak.introductions',
    domain: 'speaking',
    level: 'A1',
    title: 'Introductions',
    description: 'Introducing yourself and asking simple personal questions.',
  },
  {
    id: 'en.speak.routine_transactions',
    domain: 'speaking',
    level: 'A2',
    title: 'Routine transactions',
    description: 'Handling shops, transport, and simple service encounters.',
  },
  {
    id: 'en.speak.giving_reasons',
    domain: 'speaking',
    level: 'B1',
    title: 'Giving reasons',
    description: 'Explaining opinions and choices with connected reasons.',
  },
  {
    id: 'en.speak.arguing_position',
    domain: 'speaking',
    level: 'B2',
    title: 'Arguing a position',
    description: 'Presenting a position and responding to counter-arguments.',
  },
  {
    id: 'en.speak.fluent_adjusting_emphasis',
    domain: 'speaking',
    level: 'C1',
    title: 'Fluency and emphasis',
    description: 'Speaking fluently and adjusting stress and wording for effect.',
  },
  {
    id: 'en.read.signs_labels',
    domain: 'reading',
    level: 'A1',
    title: 'Signs and labels',
    description: 'Reading short notices, labels, menus, and opening hours.',
  },
  {
    id: 'en.read.short_messages',
    domain: 'reading',
    level: 'A2',
    title: 'Short messages',
    description: 'Reading personal messages and short practical texts.',
  },
  {
    id: 'en.read.factual_texts',
    domain: 'reading',
    level: 'B1',
    title: 'Factual texts',
    description: 'Reading short articles and narratives for main ideas and detail.',
  },
  {
    id: 'en.read.long_articles',
    domain: 'reading',
    level: 'B2',
    title: 'Long articles',
    description: 'Reading long articles and reports efficiently for argument and detail.',
  },
  {
    id: 'en.read.demanding_stance',
    domain: 'reading',
    level: 'C1',
    title: 'Stance in demanding texts',
    description: 'Understanding implication, attitude, and stance in complex texts.',
  },
  {
    id: 'en.write.personal_details',
    domain: 'writing',
    level: 'A1',
    title: 'Personal details',
    description: 'Filling in forms and writing very short personal messages.',
  },
  {
    id: 'en.write.connected_sentences',
    domain: 'writing',
    level: 'A2',
    title: 'Connected sentences',
    description: 'Writing short connected texts with basic linking.',
  },
  {
    id: 'en.write.paragraphs_informal_email',
    domain: 'writing',
    level: 'B1',
    title: 'Paragraphs and informal email',
    description: 'Writing structured paragraphs and informal emails with a clear purpose.',
  },
  {
    id: 'en.write.detailed_texts',
    domain: 'writing',
    level: 'B2',
    title: 'Detailed texts',
    description: 'Writing clear, detailed texts with examples and relevant structure.',
  },
  {
    id: 'en.write.professional_complex',
    domain: 'writing',
    level: 'C1',
    title: 'Professional complex writing',
    description: 'Writing well-structured reports and arguments for professional audiences.',
  },
  {
    id: 'en.prag.greetings',
    domain: 'pragmatics',
    level: 'A1',
    title: 'Greetings and thanks',
    description: 'Using greetings, leave-taking, and thanks in predictable situations.',
  },
  {
    id: 'en.prag.requests',
    domain: 'pragmatics',
    level: 'A2',
    title: 'Requests',
    description: 'Making requests with could, would, and appropriate politeness.',
  },
  {
    id: 'en.prag.apologies',
    domain: 'pragmatics',
    level: 'A2',
    title: 'Apologies',
    description: 'Apologizing and responding to apologies in common situations.',
  },
  {
    id: 'en.prag.hedging',
    domain: 'pragmatics',
    level: 'B1',
    title: 'Hedging',
    description: 'Softening claims with expressions such as I think, maybe, and it seems.',
  },
  {
    id: 'en.prag.disagreeing_politely',
    domain: 'pragmatics',
    level: 'B2',
    title: 'Polite disagreement',
    description: 'Disagreeing while preserving the relationship and the conversation.',
  },
  {
    id: 'en.prag.indirectness_humor',
    domain: 'pragmatics',
    level: 'C1',
    title: 'Indirectness and humor',
    description: 'Recognizing and producing indirect requests, irony, and humor.',
  },
];

export const CONCEPT_EDGES: readonly ConceptEdge[] = [
  { from: 'en.gram.tense.present_simple', to: 'en.gram.tense.present_continuous', weight: 0.8 },
  { from: 'en.gram.tense.present_simple', to: 'en.gram.tense.past_simple', weight: 0.7 },
  { from: 'en.gram.tense.past_simple', to: 'en.gram.tense.past_participle_irregular', weight: 0.7 },
  {
    from: 'en.gram.tense.past_participle_irregular',
    to: 'en.gram.tense.present_perfect_form',
    weight: 0.85,
  },
  {
    from: 'en.gram.tense.present_perfect_form',
    to: 'en.gram.tense.present_perfect_experience',
    weight: 0.8,
  },
  {
    from: 'en.gram.tense.present_perfect_experience',
    to: 'en.gram.tense.present_perfect_vs_past_simple',
    weight: 0.8,
  },
  { from: 'en.gram.tense.present_simple', to: 'en.gram.future.will_going_to', weight: 0.6 },
  { from: 'en.gram.tense.present_simple', to: 'en.gram.conditional.first', weight: 0.6 },
  { from: 'en.gram.tense.past_simple', to: 'en.gram.conditional.second', weight: 0.7 },
  { from: 'en.gram.tense.present_perfect_form', to: 'en.gram.passive.present', weight: 0.5 },
  { from: 'en.gram.article.zero', to: 'en.gram.tense.present_simple', weight: 0.4 },
  { from: 'en.gram.preposition.time', to: 'en.gram.tense.past_simple', weight: 0.4 },
  { from: 'en.gram.tense.present_simple', to: 'en.gram.preposition.depend_on', weight: 0.4 },
  { from: 'en.gram.tense.present_simple', to: 'en.gram.word_order.adverb', weight: 0.6 },
  { from: 'en.gram.tense.present_simple', to: 'en.gram.syntax.subject', weight: 0.6 },
  { from: 'en.gram.syntax.subject', to: 'en.gram.relative_clauses', weight: 0.5 },
  { from: 'en.gram.relative_clauses', to: 'en.gram.modals.deduction', weight: 0.5 },
  { from: 'en.gram.conditional.second', to: 'en.gram.inversion.negative', weight: 0.7 },
  { from: 'en.gram.modals.deduction', to: 'en.gram.inversion.negative', weight: 0.4 },
  { from: 'en.gram.relative_clauses', to: 'en.gram.reporting_verbs', weight: 0.5 },
  { from: 'en.vocab.daily_routine', to: 'en.vocab.family', weight: 0.5 },
  { from: 'en.vocab.daily_routine', to: 'en.vocab.food', weight: 0.5 },
  { from: 'en.vocab.daily_routine', to: 'en.vocab.travel', weight: 0.5 },
  { from: 'en.vocab.family', to: 'en.vocab.work', weight: 0.3 },
  { from: 'en.vocab.travel', to: 'en.vocab.work', weight: 0.4 },
  { from: 'en.vocab.work', to: 'en.vocab.abstract_topics', weight: 0.6 },
  { from: 'en.vocab.abstract_topics', to: 'en.vocab.idioms', weight: 0.5 },
  { from: 'en.vocab.phrasal.look_after', to: 'en.vocab.idioms', weight: 0.5 },
  { from: 'en.vocab.collocation.make_do', to: 'en.vocab.collocation.academic', weight: 0.6 },
  { from: 'en.vocab.abstract_topics', to: 'en.vocab.collocation.academic', weight: 0.5 },
  { from: 'en.vocab.idioms', to: 'en.vocab.register.nuance', weight: 0.7 },
  { from: 'en.vocab.collocation.academic', to: 'en.vocab.register.nuance', weight: 0.7 },
  { from: 'en.vocab.false_friend.actually', to: 'en.vocab.register.nuance', weight: 0.6 },
  { from: 'en.list.classroom_instructions', to: 'en.list.routine_conversation', weight: 0.7 },
  {
    from: 'en.list.routine_conversation',
    to: 'en.list.standard_speech_main_points',
    weight: 0.7,
  },
  {
    from: 'en.list.standard_speech_main_points',
    to: 'en.list.natural_speed_discussion',
    weight: 0.7,
  },
  { from: 'en.list.natural_speed_discussion', to: 'en.list.implicit_meaning', weight: 0.7 },
  { from: 'en.gram.tense.present_simple', to: 'en.list.classroom_instructions', weight: 0.4 },
  { from: 'en.vocab.daily_routine', to: 'en.list.routine_conversation', weight: 0.4 },
  { from: 'en.prag.greetings', to: 'en.speak.introductions', weight: 0.5 },
  { from: 'en.speak.introductions', to: 'en.speak.routine_transactions', weight: 0.7 },
  { from: 'en.prag.requests', to: 'en.speak.routine_transactions', weight: 0.6 },
  { from: 'en.speak.routine_transactions', to: 'en.speak.giving_reasons', weight: 0.7 },
  { from: 'en.prag.hedging', to: 'en.speak.giving_reasons', weight: 0.5 },
  { from: 'en.speak.giving_reasons', to: 'en.speak.arguing_position', weight: 0.7 },
  { from: 'en.prag.disagreeing_politely', to: 'en.speak.arguing_position', weight: 0.6 },
  { from: 'en.speak.arguing_position', to: 'en.speak.fluent_adjusting_emphasis', weight: 0.7 },
  { from: 'en.read.signs_labels', to: 'en.read.short_messages', weight: 0.7 },
  { from: 'en.read.short_messages', to: 'en.read.factual_texts', weight: 0.7 },
  { from: 'en.read.factual_texts', to: 'en.read.long_articles', weight: 0.7 },
  { from: 'en.vocab.abstract_topics', to: 'en.read.long_articles', weight: 0.4 },
  { from: 'en.read.long_articles', to: 'en.read.demanding_stance', weight: 0.7 },
  { from: 'en.write.personal_details', to: 'en.write.connected_sentences', weight: 0.7 },
  { from: 'en.gram.tense.past_simple', to: 'en.write.connected_sentences', weight: 0.5 },
  { from: 'en.write.connected_sentences', to: 'en.write.paragraphs_informal_email', weight: 0.7 },
  { from: 'en.write.paragraphs_informal_email', to: 'en.write.detailed_texts', weight: 0.7 },
  { from: 'en.gram.relative_clauses', to: 'en.write.detailed_texts', weight: 0.5 },
  { from: 'en.write.detailed_texts', to: 'en.write.professional_complex', weight: 0.7 },
  { from: 'en.gram.reporting_verbs', to: 'en.write.professional_complex', weight: 0.5 },
  { from: 'en.prag.greetings', to: 'en.prag.requests', weight: 0.5 },
  { from: 'en.prag.greetings', to: 'en.prag.apologies', weight: 0.5 },
  { from: 'en.prag.requests', to: 'en.prag.hedging', weight: 0.6 },
  { from: 'en.prag.hedging', to: 'en.prag.disagreeing_politely', weight: 0.7 },
  { from: 'en.prag.disagreeing_politely', to: 'en.prag.indirectness_humor', weight: 0.7 },
  { from: 'en.prag.apologies', to: 'en.speak.routine_transactions', weight: 0.4 },
];

const CONCEPTS_BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

export function getConcept(conceptId: string): Concept | undefined {
  return CONCEPTS_BY_ID.get(conceptId);
}

export function getConceptsForLevel(level: CefrLevel): readonly Concept[] {
  return CONCEPTS.filter((concept) => concept.level === level);
}

export function getPrerequisites(conceptId: string): readonly ConceptEdge[] {
  return CONCEPT_EDGES.filter((edge) => edge.to === conceptId);
}

export function isConceptUnlocked(
  conceptId: string,
  masteryByConcept: Readonly<Record<string, number>>,
  threshold = CONCEPT_MASTERY_THRESHOLD,
): boolean {
  if (!CONCEPTS_BY_ID.has(conceptId)) return false;
  return getPrerequisites(conceptId)
    .filter((edge) => edge.weight >= CONCEPT_PREREQUISITE_WEIGHT)
    .every((edge) => (masteryByConcept[edge.from] ?? 0) >= threshold);
}
