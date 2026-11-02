import { describe, expect, it } from 'vitest';

import { CEFR_LEVELS, SKILL_DOMAINS } from '@loqua/core';

import { CORE_SKILLS, getSkill, getSkillByDomain } from '../src/skills.js';

describe('core skills', () => {
  it('defines the seven core skills once each', () => {
    expect(CORE_SKILLS).toHaveLength(SKILL_DOMAINS.length);
    expect(new Set(CORE_SKILLS.map((skill) => skill.domain))).toEqual(new Set(SKILL_DOMAINS));
    expect(new Set(CORE_SKILLS.map((skill) => skill.id)).size).toBe(CORE_SKILLS.length);
  });

  it('covers A1-C1 for every skill', () => {
    for (const skill of CORE_SKILLS) {
      expect(skill.cefrRange).toEqual(CEFR_LEVELS);
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });

  it('looks up skills by id and domain', () => {
    expect(getSkill('skill-en-speaking')?.domain).toBe('speaking');
    expect(getSkill('skill-en-missing')).toBeUndefined();
    expect(getSkillByDomain('pragmatics')?.id).toBe('skill-en-pragmatics');
  });
});
