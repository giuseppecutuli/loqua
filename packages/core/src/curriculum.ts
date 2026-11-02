import type { CefrLevel, SkillDomain } from './skills.js';
import { cefrRank } from './skills.js';

export interface CurriculumConcept {
  readonly id: string;
  readonly domain: SkillDomain;
  readonly level: CefrLevel;
}

export interface CurriculumCanDo {
  readonly id: string;
  readonly skill: SkillDomain;
  readonly level: CefrLevel;
  readonly conceptIds: readonly string[];
}

export type CurriculumBlock = 'input' | 'review' | 'production';

export interface CurriculumDay {
  readonly date: string;
  readonly focusSkill: SkillDomain;
  readonly block: CurriculumBlock;
  readonly minutes: number;
  readonly conceptIds: readonly string[];
  readonly canDoIds: readonly string[];
}

export interface CurriculumPlan {
  readonly startDate: string;
  readonly endDate: string;
  readonly targetLevel: CefrLevel;
  readonly weekFocus: readonly SkillDomain[];
  readonly days: readonly CurriculumDay[];
}

export interface BuildCurriculumInput {
  readonly targetLevel: CefrLevel;
  readonly dailyMinutes: number;
  readonly concepts: readonly CurriculumConcept[];
  readonly canDos: readonly CurriculumCanDo[];
  readonly weakSkills: readonly SkillDomain[];
  readonly knownConceptIds: readonly string[];
  readonly now: Date;
  readonly days?: number;
}

const DEFAULT_FOCUS: readonly SkillDomain[] = [
  'grammar',
  'vocabulary',
  'listening',
  'reading',
  'pragmatics',
  'writing',
  'speaking',
];
const BLOCKS: readonly CurriculumBlock[] = ['input', 'review', 'production'];

function addDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildCurriculumPlan(input: BuildCurriculumInput): CurriculumPlan {
  const days = input.days ?? 14;
  const targetRank = cefrRank(input.targetLevel);
  const known = new Set(input.knownConceptIds);
  const focus = (input.weakSkills.length > 0 ? input.weakSkills : DEFAULT_FOCUS)
    .filter((skill, index, values) => values.indexOf(skill) === index)
    .slice(0, 3);

  const eligible = input.concepts
    .filter(
      (concept) =>
        cefrRank(concept.level) <= targetRank && !known.has(concept.id),
    )
    .sort(
      (left, right) =>
        cefrRank(right.level) - cefrRank(left.level) ||
        focus.indexOf(left.domain) - focus.indexOf(right.domain) ||
        left.id.localeCompare(right.id),
    );

  const planDays: CurriculumDay[] = [];
  for (let index = 0; index < days; index += 1) {
    const focusSkill = focus[index % focus.length] ?? 'grammar';
    const block = BLOCKS[index % BLOCKS.length] ?? 'input';
    const forSkill = eligible.filter((concept) => concept.domain === focusSkill);
    const pool = forSkill.length > 0 ? forSkill : eligible;
    const start = pool.length > 0 ? (index * 2) % pool.length : -1;
    const conceptIds =
      start >= 0
        ? [pool[start], pool[(start + 1) % pool.length]]
            .filter((concept): concept is CurriculumConcept => concept !== undefined)
            .map((concept) => concept.id)
        : [];
    const canDoIds = input.canDos
      .filter(
        (canDo) =>
          canDo.skill === focusSkill &&
          cefrRank(canDo.level) <= targetRank &&
          canDo.conceptIds.some((conceptId) => conceptIds.includes(conceptId)),
      )
      .slice(0, 2)
      .map((canDo) => canDo.id);
    planDays.push({
      date: dateOnly(addDays(input.now, index)),
      focusSkill,
      block,
      minutes: input.dailyMinutes,
      conceptIds,
      canDoIds,
    });
  }

  return {
    startDate: dateOnly(input.now),
    endDate: dateOnly(addDays(input.now, days - 1)),
    targetLevel: input.targetLevel,
    weekFocus: focus,
    days: planDays,
  };
}
