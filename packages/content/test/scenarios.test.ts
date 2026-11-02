import { describe, expect, it } from 'vitest';

import { CEFR_LEVELS } from '@loqua/core';

import {
  CONVERSATION_REGISTERS,
  CONVERSATION_SCENARIOS,
  getConversationScenario,
} from '../src/scenarios.js';

describe('conversation scenarios', () => {
  it('defines exactly ten scenarios with unique ids', () => {
    expect(CONVERSATION_SCENARIOS).toHaveLength(10);

    const ids = new Set(CONVERSATION_SCENARIOS.map((scenario) => scenario.id));
    expect(ids.size).toBe(CONVERSATION_SCENARIOS.length);
  });

  it('covers every CEFR level from A1 to C1', () => {
    const levels = new Set(CONVERSATION_SCENARIOS.map((scenario) => scenario.level));
    expect(levels).toEqual(new Set(CEFR_LEVELS));
  });

  it('includes at least two A2/B1 and two B2/C1 scenarios', () => {
    const a2b1 = CONVERSATION_SCENARIOS.filter(
      (scenario) => scenario.level === 'A2' || scenario.level === 'B1',
    );
    const b2c1 = CONVERSATION_SCENARIOS.filter(
      (scenario) => scenario.level === 'B2' || scenario.level === 'C1',
    );

    expect(a2b1.length).toBeGreaterThanOrEqual(2);
    expect(b2c1.length).toBeGreaterThanOrEqual(2);
  });

  it('uses valid levels, registers, and target language', () => {
    for (const scenario of CONVERSATION_SCENARIOS) {
      expect(CEFR_LEVELS).toContain(scenario.level);
      expect(CONVERSATION_REGISTERS).toContain(scenario.register);
      expect(scenario.targetLang).toBe('en');
    }
  });

  it('provides three to six non-empty target phrases per scenario', () => {
    for (const scenario of CONVERSATION_SCENARIOS) {
      expect(scenario.targetPhrases.length).toBeGreaterThanOrEqual(3);
      expect(scenario.targetPhrases.length).toBeLessThanOrEqual(6);
      for (const phrase of scenario.targetPhrases) {
        expect(phrase.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('provides non-empty titles and opening lines in the target language', () => {
    for (const scenario of CONVERSATION_SCENARIOS) {
      expect(scenario.title.trim().length).toBeGreaterThan(0);
      expect(scenario.openingLine.trim().length).toBeGreaterThan(0);
      expect(scenario.setting.trim().length).toBeGreaterThan(0);
      expect(scenario.goal.trim().length).toBeGreaterThan(0);
      expect(scenario.learnerRole.trim().length).toBeGreaterThan(0);
      expect(scenario.tutorRole.trim().length).toBeGreaterThan(0);
      expect(scenario.safetyNotes.length).toBeGreaterThan(0);
    }
  });

  it('keeps maxTurns between 8 and 12', () => {
    for (const scenario of CONVERSATION_SCENARIOS) {
      expect(scenario.maxTurns).toBeGreaterThanOrEqual(8);
      expect(scenario.maxTurns).toBeLessThanOrEqual(12);
    }
  });

  it('looks up scenarios by id', () => {
    expect(getConversationScenario('en.scenario.cafe_order')?.level).toBe('A1');
    expect(getConversationScenario('en.scenario.job_interview')?.register).toBe('formal');
    expect(getConversationScenario('en.scenario.missing')).toBeUndefined();
  });
});
