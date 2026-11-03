import type { CefrLevel, SkillDomain } from '@loqua/core';

export interface SkillDefinition {
  readonly id: string;
  readonly domain: SkillDomain;
  readonly name: string;
  readonly description: string;
  readonly cefrRange: readonly CefrLevel[];
}

const ALL_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const CORE_SKILLS: readonly SkillDefinition[] = [
  {
    id: 'skill-en-grammar',
    domain: 'grammar',
    name: 'Grammar',
    description: 'Control of forms, tense, aspect, and sentence structure in the target language.',
    cefrRange: ALL_LEVELS,
  },
  {
    id: 'skill-en-vocabulary',
    domain: 'vocabulary',
    name: 'Vocabulary',
    description: 'Range, precision, collocation, and register of words and fixed expressions.',
    cefrRange: ALL_LEVELS,
  },
  {
    id: 'skill-en-listening',
    domain: 'listening',
    name: 'Listening',
    description: 'Understanding speech at increasing speed, length, and implicit meaning.',
    cefrRange: ALL_LEVELS,
  },
  {
    id: 'skill-en-speaking',
    domain: 'speaking',
    name: 'Speaking',
    description: 'Spoken interaction, fluency, intelligibility, and adjustment of emphasis.',
    cefrRange: ALL_LEVELS,
  },
  {
    id: 'skill-en-reading',
    domain: 'reading',
    name: 'Reading',
    description: 'Reading signs, messages, articles, and demanding texts for gist and stance.',
    cefrRange: ALL_LEVELS,
  },
  {
    id: 'skill-en-writing',
    domain: 'writing',
    name: 'Writing',
    description: 'Writing personal details, connected sentences, structured texts, and reports.',
    cefrRange: ALL_LEVELS,
  },
  {
    id: 'skill-en-pragmatics',
    domain: 'pragmatics',
    name: 'Pragmatics',
    description: 'Greetings, requests, hedging, polite disagreement, and indirect meaning.',
    cefrRange: ALL_LEVELS,
  },
];

const SKILLS_BY_ID = new Map(CORE_SKILLS.map((skill) => [skill.id, skill]));
const SKILLS_BY_DOMAIN = new Map(CORE_SKILLS.map((skill) => [skill.domain, skill]));

export function skillIdFor(targetLang: string, domain: SkillDomain): string {
  return `skill-${targetLang}-${domain}`;
}

export function getSkill(skillId: string): SkillDefinition | undefined {
  return SKILLS_BY_ID.get(skillId);
}

export function getSkillByDomain(domain: SkillDomain): SkillDefinition | undefined {
  return SKILLS_BY_DOMAIN.get(domain);
}
