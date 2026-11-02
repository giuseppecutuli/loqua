import { describe, expect, it } from 'vitest';

import { buildCurriculumPlan } from '../src/curriculum.js';

const now = new Date('2026-11-02T10:00:00.000Z');
const concepts = [
  { id: 'a1', domain: 'grammar' as const, level: 'A1' as const },
  { id: 'a2', domain: 'grammar' as const, level: 'A2' as const },
  { id: 'b1', domain: 'grammar' as const, level: 'B1' as const },
  { id: 'v1', domain: 'vocabulary' as const, level: 'A2' as const },
  { id: 'l1', domain: 'listening' as const, level: 'B1' as const },
];
const canDos = [
  { id: 'can-grammar', skill: 'grammar' as const, level: 'A2' as const, conceptIds: ['a2'] },
  { id: 'can-vocab', skill: 'vocabulary' as const, level: 'A2' as const, conceptIds: ['v1'] },
];

describe('curriculum planner', () => {
  it('builds a deterministic two-week plan and skips known concepts', () => {
    const plan = buildCurriculumPlan({
      targetLevel: 'B1',
      dailyMinutes: 20,
      concepts,
      canDos,
      weakSkills: ['grammar', 'vocabulary'],
      knownConceptIds: ['b1'],
      now,
    });
    expect(plan.days).toHaveLength(14);
    expect(plan.startDate).toBe('2026-11-02');
    expect(plan.endDate).toBe('2026-11-15');
    expect(plan.weekFocus).toEqual(['grammar', 'vocabulary']);
    expect(plan.days.map((day) => day.focusSkill)).toContain('vocabulary');
    expect(plan.days.flatMap((day) => day.conceptIds)).not.toContain('b1');
    expect(plan.days.some((day) => day.canDoIds.length > 0)).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const input = {
      targetLevel: 'B1' as const,
      dailyMinutes: 20,
      concepts,
      canDos,
      weakSkills: ['grammar'] as const,
      knownConceptIds: [],
      now,
    };
    expect(buildCurriculumPlan(input)).toEqual(buildCurriculumPlan(input));
  });
});
