import type { CefrLevel } from '@loqua/core';

export const RULE_CATEGORIES = [
  'grammar',
  'lexis',
  'pragmatics',
  'phonology',
  'discourse',
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_CATEGORY_PREFIX: Record<RuleCategory, string> = {
  grammar: 'en.gram.',
  lexis: 'en.lex.',
  pragmatics: 'en.prag.',
  phonology: 'en.phon.',
  discourse: 'en.disc.',
};

export interface RuleExample {
  readonly incorrect: string;
  readonly correct: string;
}

export interface L1TransferNote {
  readonly nativeLang: string;
  readonly pattern: string;
  readonly note: string;
}

export interface Rule {
  readonly id: string;
  readonly category: RuleCategory;
  readonly level: CefrLevel;
  readonly title: string;
  readonly targetExplanation: string;
  readonly examples: readonly RuleExample[];
  readonly l1Transfer?: L1TransferNote;
}

export const RULES: readonly Rule[] = [
  {
    id: 'en.gram.tense.present_simple',
    category: 'grammar',
    level: 'A1',
    title: 'Present simple',
    targetExplanation:
      'Use the base verb with I, you, we, and they. Add -s or -es with he, she, and it. Use do or does for negatives and questions.',
    examples: [
      { incorrect: 'She go to work every day.', correct: 'She goes to work every day.' },
      { incorrect: "He don't like coffee.", correct: "He doesn't like coffee." },
    ],
  },
  {
    id: 'en.gram.tense.present_continuous',
    category: 'grammar',
    level: 'A1',
    title: 'Present continuous',
    targetExplanation:
      'Use am, is, or are plus the -ing form for actions happening now or around now.',
    examples: [
      { incorrect: 'I am work now.', correct: 'I am working now.' },
      { incorrect: 'She is study at the moment.', correct: 'She is studying at the moment.' },
    ],
  },
  {
    id: 'en.gram.tense.past_simple',
    category: 'grammar',
    level: 'A2',
    title: 'Past simple',
    targetExplanation:
      'Use the past form for finished actions. After did or did not, use the base verb.',
    examples: [
      { incorrect: 'Yesterday I go to the market.', correct: 'Yesterday I went to the market.' },
      { incorrect: "She didn't went home.", correct: "She didn't go home." },
    ],
  },
  {
    id: 'en.gram.tense.past_participle_irregular',
    category: 'grammar',
    level: 'A2',
    title: 'Irregular past participles',
    targetExplanation:
      'Some verbs have a special past participle. Learn the three forms together: go, went, gone; write, wrote, written.',
    examples: [
      { incorrect: 'I have went to Rome.', correct: 'I have gone to Rome.' },
      { incorrect: 'She has wrote the email.', correct: 'She has written the email.' },
    ],
  },
  {
    id: 'en.gram.tense.present_perfect',
    category: 'grammar',
    level: 'A2',
    title: 'Present perfect',
    targetExplanation:
      'Use have or has plus the past participle for experiences and situations connected to now. Do not use it with a finished past time such as yesterday.',
    examples: [
      { incorrect: 'I have seen him yesterday.', correct: 'I saw him yesterday.' },
      { incorrect: 'I live here since 2020.', correct: 'I have lived here since 2020.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'passato prossimo -> past simple or present perfect',
      note: 'The Italian passato prossimo can map to both English forms; a finished time expression selects the past simple.',
    },
  },
  {
    id: 'en.gram.tense.present_perfect_vs_past_simple',
    category: 'grammar',
    level: 'B1',
    title: 'Present perfect vs past simple',
    targetExplanation:
      'Use the past simple for a finished time. Use the present perfect when the time is open or the result matters now.',
    examples: [
      { incorrect: 'I have visited London in 2019.', correct: 'I visited London in 2019.' },
      {
        incorrect: 'I saw that film, so I know it.',
        correct: 'I have seen that film, so I know it.',
      },
    ],
  },
  {
    id: 'en.gram.tense.stative',
    category: 'grammar',
    level: 'A2',
    title: 'Stative verbs',
    targetExplanation:
      'Stative verbs such as agree, know, believe, and want are not normally used in the continuous form.',
    examples: [
      { incorrect: 'I am agree with you.', correct: 'I agree with you.' },
      { incorrect: 'I am knowing the answer.', correct: 'I know the answer.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'essere + adjective -> single verb',
      note: 'Italian says sono d\u2019accordo; English needs the verb agree.',
    },
  },
  {
    id: 'en.gram.future.will_going_to',
    category: 'grammar',
    level: 'A2',
    title: 'Future with will and going to',
    targetExplanation:
      'Use will plus the base verb for decisions and predictions. Use be going to for plans and visible evidence.',
    examples: [
      { incorrect: 'I will to call you later.', correct: 'I will call you later.' },
      {
        incorrect: 'Look at the clouds; it will rain.',
        correct: 'Look at the clouds; it is going to rain.',
      },
    ],
  },
  {
    id: 'en.gram.conditional.first',
    category: 'grammar',
    level: 'A2',
    title: 'First conditional',
    targetExplanation:
      'In the first conditional, use the present simple after if and will in the other clause.',
    examples: [
      {
        incorrect: 'If it will rain, we will stay home.',
        correct: 'If it rains, we will stay home.',
      },
      {
        incorrect: 'If you study, you pass the test.',
        correct: 'If you study, you will pass the test.',
      },
    ],
  },
  {
    id: 'en.gram.conditional.second',
    category: 'grammar',
    level: 'B1',
    title: 'Second conditional',
    targetExplanation:
      'Use the past simple after if and would plus the base verb for unreal present or future situations.',
    examples: [
      {
        incorrect: 'If I would have more time, I would travel.',
        correct: 'If I had more time, I would travel.',
      },
      {
        incorrect: 'If I was you, I will apologize.',
        correct: 'If I were you, I would apologize.',
      },
    ],
  },
  {
    id: 'en.gram.article.zero',
    category: 'grammar',
    level: 'A1',
    title: 'Zero article',
    targetExplanation:
      'Do not use the with general plural or uncountable nouns when you talk about them in general.',
    examples: [
      { incorrect: 'The life is beautiful.', correct: 'Life is beautiful.' },
      { incorrect: 'I like the music.', correct: 'I like music.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'definite article for general nouns -> zero article',
      note: 'Italian often uses the definite article for general nouns where English uses no article.',
    },
  },
  {
    id: 'en.gram.preposition.time',
    category: 'grammar',
    level: 'A1',
    title: 'Prepositions of time',
    targetExplanation:
      'Use at for clock times, on for days and dates, and in for months, years, and long periods.',
    examples: [
      { incorrect: 'I will see you in Monday.', correct: 'I will see you on Monday.' },
      { incorrect: "The meeting is on 9 o'clock.", correct: "The meeting is at 9 o'clock." },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'a or in for time -> at, on, or in',
      note: 'Italian uses a single preposition for many time expressions; English divides them by time type.',
    },
  },
  {
    id: 'en.gram.preposition.depend_on',
    category: 'grammar',
    level: 'B1',
    title: 'Dependent prepositions',
    targetExplanation:
      'Some verbs and adjectives take a fixed preposition. Learn the whole phrase: depend on, interested in, good at.',
    examples: [
      { incorrect: 'It depends of the weather.', correct: 'It depends on the weather.' },
      { incorrect: 'I am interested about history.', correct: 'I am interested in history.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'dipendere da -> depend on',
      note: 'The Italian preposition da can lead to of; English depend takes on.',
    },
  },
  {
    id: 'en.gram.word_order.adverb',
    category: 'grammar',
    level: 'B1',
    title: 'Adverb position',
    targetExplanation:
      'Degree adverbs usually come before the word they modify. Frequency adverbs usually come before the main verb but after be.',
    examples: [
      { incorrect: 'I very like this song.', correct: 'I really like this song.' },
      { incorrect: 'She always is late.', correct: 'She is always late.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'molto + verb -> really + verb',
      note: 'Italian molto can modify a verb directly; English normally uses really or very much.',
    },
  },
  {
    id: 'en.gram.syntax.subject',
    category: 'grammar',
    level: 'B1',
    title: 'Subject requirement',
    targetExplanation:
      'Every finite English clause needs a subject. Use it for weather, time, and impersonal statements.',
    examples: [
      {
        incorrect: 'Is important to practice every day.',
        correct: 'It is important to practice every day.',
      },
      { incorrect: 'Is raining outside.', correct: 'It is raining outside.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'impersonal verb without subject -> it + verb',
      note: 'Italian can omit the subject in impersonal sentences; English cannot.',
    },
  },
  {
    id: 'en.gram.relative_clauses',
    category: 'grammar',
    level: 'B2',
    title: 'Relative clauses',
    targetExplanation:
      'Use who for people, which for things, and that in defining clauses. Do not use that in a non-defining clause after a comma.',
    examples: [
      {
        incorrect: 'The woman which called you is my aunt.',
        correct: 'The woman who called you is my aunt.',
      },
      {
        incorrect: 'My brother, that lives in Rome, is a doctor.',
        correct: 'My brother, who lives in Rome, is a doctor.',
      },
    ],
  },
  {
    id: 'en.gram.modals.deduction',
    category: 'grammar',
    level: 'B2',
    title: 'Modals of deduction',
    targetExplanation:
      'Use must for strong certainty, might or could for possibility, and cannot for strong impossibility. Modals take the base verb without to.',
    examples: [
      {
        incorrect: "He mustn't be hungry; he just ate.",
        correct: "He can't be hungry; he just ate.",
      },
      { incorrect: 'She must to be tired.', correct: 'She must be tired.' },
    ],
  },
  {
    id: 'en.gram.inversion.negative',
    category: 'grammar',
    level: 'C1',
    title: 'Negative inversion',
    targetExplanation:
      'After negative or restrictive adverbials at the start of a clause, invert the auxiliary and the subject.',
    examples: [
      { incorrect: 'Never I have seen such a view.', correct: 'Never have I seen such a view.' },
      {
        incorrect: 'Not only she sings, but she also dances.',
        correct: 'Not only does she sing, but she also dances.',
      },
    ],
  },
  {
    id: 'en.gram.reporting_verbs',
    category: 'grammar',
    level: 'C1',
    title: 'Reporting verbs',
    targetExplanation:
      'Reporting verbs take different patterns. Check the verb: suggest plus a that-clause, explain plus object plus to someone.',
    examples: [
      {
        incorrect: 'She suggested me to take the job.',
        correct: 'She suggested that I take the job.',
      },
      { incorrect: 'They explained me the problem.', correct: 'They explained the problem to me.' },
    ],
  },
  {
    id: 'en.lex.false_friend.actually',
    category: 'lexis',
    level: 'B1',
    title: 'False friend: actually',
    targetExplanation:
      'Actually means in fact or in reality. For at the moment, use currently or at the moment.',
    examples: [
      {
        incorrect: 'Actually I live with my parents.',
        correct: 'Currently I live with my parents.',
      },
      {
        incorrect: 'Currently, the meeting starts at nine.',
        correct: 'Actually, the meeting starts at nine.',
      },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'attualmente -> actually',
      note: 'Italian attualmente looks like actually but means currently.',
    },
  },
  {
    id: 'en.lex.phrasal.look_after',
    category: 'lexis',
    level: 'B1',
    title: 'Phrasal verb: look after',
    targetExplanation:
      'Look for means search. Look after means take care of. The particle changes the meaning.',
    examples: [
      { incorrect: 'I am looking after my keys.', correct: 'I am looking for my keys.' },
      {
        incorrect: 'She looks for her younger brother.',
        correct: 'She looks after her younger brother.',
      },
    ],
  },
  {
    id: 'en.lex.collocation.make_do',
    category: 'lexis',
    level: 'B1',
    title: 'Make and do collocations',
    targetExplanation:
      'Learn make and do as fixed collocations: make a mistake, make a decision, do homework, do chores.',
    examples: [
      { incorrect: 'I did a mistake.', correct: 'I made a mistake.' },
      { incorrect: 'She made her homework.', correct: 'She did her homework.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'fare -> make or do',
      note: 'Italian fare covers both English verbs, so the collocation must be learned as a whole.',
    },
  },
  {
    id: 'en.lex.idiom.break_the_ice',
    category: 'lexis',
    level: 'B2',
    title: 'Idiom: break the ice',
    targetExplanation:
      'Break the ice means start a conversation in a new or awkward situation. Use the fixed phrase.',
    examples: [
      { incorrect: 'He broke the cold with a joke.', correct: 'He broke the ice with a joke.' },
      {
        incorrect: 'It was hard to break the freeze at first.',
        correct: 'It was hard to break the ice at first.',
      },
    ],
  },
  {
    id: 'en.lex.register.formal_informal',
    category: 'lexis',
    level: 'C1',
    title: 'Formal and informal register',
    targetExplanation:
      'Formal writing and professional speech avoid slang, reduced forms such as wanna and gimme, and direct commands.',
    examples: [
      {
        incorrect: 'Hey, gimme the report now.',
        correct: 'Could you please send me the report by Friday?',
      },
      {
        incorrect: 'I wanna talk about the contract.',
        correct: 'I would like to discuss the contract.',
      },
    ],
  },
  {
    id: 'en.prag.requests',
    category: 'pragmatics',
    level: 'A2',
    title: 'Requests',
    targetExplanation:
      'Use could or would and please to make a request sound polite. A bare imperative can sound rude.',
    examples: [
      { incorrect: 'Give me the salt.', correct: 'Could you pass me the salt, please?' },
      { incorrect: 'You open the window.', correct: 'Would you mind opening the window?' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'imperative + per favore -> could or would + please',
      note: 'An Italian imperative with per favore is often softer than the English bare imperative.',
    },
  },
  {
    id: 'en.prag.apologies',
    category: 'pragmatics',
    level: 'A2',
    title: 'Apologies',
    targetExplanation: 'Use sorry plus a clause, or apologize to someone for something.',
    examples: [
      { incorrect: 'Sorry for I am late.', correct: 'Sorry I am late.' },
      { incorrect: 'I apologize you for the delay.', correct: 'I apologize to you for the delay.' },
    ],
  },
  {
    id: 'en.prag.hedging',
    category: 'pragmatics',
    level: 'B1',
    title: 'Hedging',
    targetExplanation:
      'Hedging softens a claim with expressions such as I think, maybe, it seems, or might. It is common in polite discussion.',
    examples: [
      { incorrect: 'This is wrong.', correct: 'I think this might be wrong.' },
      {
        incorrect: 'You are mistaken.',
        correct: 'It seems to me that there may be a misunderstanding.',
      },
    ],
  },
  {
    id: 'en.prag.disagreeing_politely',
    category: 'pragmatics',
    level: 'B2',
    title: 'Polite disagreement',
    targetExplanation:
      'Acknowledge the other view first, then state your disagreement with a softer expression.',
    examples: [
      {
        incorrect: 'That is a stupid idea.',
        correct: "I see your point, but I'm not sure that would work.",
      },
      {
        incorrect: 'You are wrong.',
        correct: "I understand what you mean, although I'd look at it differently.",
      },
    ],
  },
  {
    id: 'en.prag.indirectness',
    category: 'pragmatics',
    level: 'C1',
    title: 'Indirectness',
    targetExplanation:
      'Indirect language protects the listener. Use it when the message is sensitive or the relationship matters.',
    examples: [
      { incorrect: 'Close the door.', correct: 'Would you mind closing the door?' },
      { incorrect: "I don't believe you.", correct: "I'm not entirely convinced by that." },
    ],
  },
  {
    id: 'en.phon.th_sound',
    category: 'phonology',
    level: 'A1',
    title: 'The th sound',
    targetExplanation:
      'For th, put the tongue lightly between the teeth. Do not replace it with t or d.',
    examples: [
      { incorrect: 'I tink it is true.', correct: 'I think it is true.' },
      { incorrect: 'Dis is my friend.', correct: 'This is my friend.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'th -> t or d',
      note: 'Italian has no dental fricatives, so th is often replaced by t or d.',
    },
  },
  {
    id: 'en.phon.h_sound',
    category: 'phonology',
    level: 'A1',
    title: 'The h sound',
    targetExplanation:
      'English h is pronounced at the start of words such as hungry, house, and he. Do not drop it.',
    examples: [
      { incorrect: 'I am ungry.', correct: 'I am hungry.' },
      { incorrect: 'e has a new ouse.', correct: 'He has a new house.' },
    ],
    l1Transfer: {
      nativeLang: 'it',
      pattern: 'silent h -> pronounced h',
      note: 'Italian speakers may drop h because it is silent in Italian.',
    },
  },
  {
    id: 'en.disc.connectors',
    category: 'discourse',
    level: 'B1',
    title: 'Connectors',
    targetExplanation:
      'Use one connector for each relationship. Although and but do not appear together in the same clause pair.',
    examples: [
      {
        incorrect: 'Although I was tired, but I finished the report.',
        correct: 'Although I was tired, I finished the report.',
      },
      {
        incorrect: 'I was tired, so however I finished it.',
        correct: 'I was tired; however, I finished it.',
      },
    ],
  },
  {
    id: 'en.disc.cohesion',
    category: 'discourse',
    level: 'C1',
    title: 'Cohesion',
    targetExplanation:
      'Use pronouns, substitution, and parallel structures to connect ideas without repeating the same noun.',
    examples: [
      {
        incorrect: 'The report was long. The report was useful. The report helped us decide.',
        correct: 'The report was long but useful, and it helped us decide.',
      },
      {
        incorrect: 'We met the client. We discussed the plan. We agreed the budget.',
        correct: 'We met the client, discussed the plan, and agreed the budget.',
      },
    ],
  },
];

const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

export function getRule(ruleId: string): Rule | undefined {
  return RULES_BY_ID.get(ruleId);
}

export function getRulesForLevel(level: CefrLevel): readonly Rule[] {
  return RULES.filter((rule) => rule.level === level);
}

export function getRulesForCategory(category: RuleCategory): readonly Rule[] {
  return RULES.filter((rule) => rule.category === category);
}

export function isRuleIdForCategory(ruleId: string, category: RuleCategory): boolean {
  return ruleId.startsWith(RULE_CATEGORY_PREFIX[category]);
}

export function isValidRuleId(ruleId: string): boolean {
  return RULE_CATEGORIES.some((category) => isRuleIdForCategory(ruleId, category));
}
