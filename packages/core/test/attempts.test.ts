import { describe, expect, it } from 'vitest';

import { updateEloEstimate } from '../src/assessment.js';
import { CONCEPT_MASTERY_ALPHA, applyAttempt, createConceptState } from '../src/attempts.js';
import type { SkillEstimate } from '../src/assessment.js';

const now = new Date('2026-11-02T10:00:00.000Z');
const neutralSkill: SkillEstimate = { theta: 0, se: 1, nObs: 0 };

describe('applyAttempt', () => {
  it('moves the skill estimate up on a correct answer', () => {
    const result = applyAttempt({
      skill: neutralSkill,
      concept: createConceptState('concept-1'),
      difficultyB: 0,
      correct: true,
      now,
    });

    expect(result.skill.theta).toBeGreaterThan(neutralSkill.theta);
    expect(result.skill.se).toBeLessThan(neutralSkill.se);
    expect(result.skill.nObs).toBe(1);
    expect(result.skill).toEqual(updateEloEstimate(neutralSkill, 0, true));
  });

  it('moves the skill estimate down on a wrong answer', () => {
    const result = applyAttempt({
      skill: neutralSkill,
      concept: createConceptState('concept-1'),
      difficultyB: 0,
      correct: false,
      now,
    });

    expect(result.skill.theta).toBeLessThan(neutralSkill.theta);
    expect(result.skill).toEqual(updateEloEstimate(neutralSkill, 0, false));
  });

  it('updates concept mastery with the configured EMA', () => {
    const concept = { ...createConceptState('concept-1'), mastery: 0.5 };
    const correct = applyAttempt({
      skill: neutralSkill,
      concept,
      difficultyB: 0,
      correct: true,
      now,
    });
    const incorrect = applyAttempt({
      skill: neutralSkill,
      concept,
      difficultyB: 0,
      correct: false,
      now,
    });

    expect(correct.concept.mastery).toBeGreaterThan(concept.mastery);
    expect(incorrect.concept.mastery).toBeLessThan(concept.mastery);
    expect(correct.concept.mastery).toBe(
      Math.round((concept.mastery + CONCEPT_MASTERY_ALPHA * (1 - concept.mastery)) * 10_000) /
        10_000,
    );
    expect(correct.concept.evidenceCount).toBe(1);
    expect(incorrect.concept.evidenceCount).toBe(1);
  });

  it('tracks the last error and last seen timestamps', () => {
    const correct = applyAttempt({
      skill: neutralSkill,
      concept: createConceptState('concept-1'),
      difficultyB: 0,
      correct: true,
      now,
    });
    const incorrectAt = new Date('2026-11-02T11:00:00.000Z');
    const incorrect = applyAttempt({
      skill: correct.skill,
      concept: correct.concept,
      difficultyB: 0,
      correct: false,
      now: incorrectAt,
    });

    expect(correct.concept.lastSeenAt).toBe(now.toISOString());
    expect(correct.concept.lastErrorAt).toBeNull();
    expect(incorrect.concept.lastSeenAt).toBe(incorrectAt.toISOString());
    expect(incorrect.concept.lastErrorAt).toBe(incorrectAt.toISOString());
  });

  it('keeps estimates finite and bounded over many attempts', () => {
    let skill = neutralSkill;
    let concept = { ...createConceptState('concept-1'), mastery: 0.5 };

    for (let index = 0; index < 200; index += 1) {
      const result = applyAttempt({
        skill,
        concept,
        difficultyB: index % 2 === 0 ? 1 : -1,
        correct: index % 3 !== 0,
        now: new Date(now.getTime() + index * 60_000),
      });
      skill = result.skill;
      concept = result.concept;

      expect(Number.isFinite(skill.theta)).toBe(true);
      expect(skill.se).toBeGreaterThan(0);
      expect(skill.se).toBeLessThanOrEqual(1);
      expect(concept.mastery).toBeGreaterThanOrEqual(0);
      expect(concept.mastery).toBeLessThanOrEqual(1);
    }

    expect(concept.evidenceCount).toBe(200);
  });
});
