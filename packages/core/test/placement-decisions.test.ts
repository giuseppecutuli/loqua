import { describe, expect, it } from 'vitest';

import type {
  PlacementResponse,
  PlacementResult,
  PlacementSkillResult,
  PlacementState,
  PlacementSkill,
} from '../src/assessment.js';
import {
  CONCEPT_MASTERY_THRESHOLD,
  aggregateConceptEvidence,
  evaluatePlacementDecisions,
} from '../src/placement-decisions.js';
import type { SkillDomain } from '../src/skills.js';

const now = '2026-11-02T10:00:00.000Z';

function response(
  conceptId: string,
  skill: PlacementSkill,
  correct: boolean,
  index: number,
): PlacementResponse {
  return {
    itemId: `item-${index}`,
    skill,
    conceptId,
    correct,
    answeredAt: now,
  };
}

function stateWith(responses: readonly PlacementResponse[]): PlacementState {
  return {
    targetLang: 'en',
    startedAt: now,
    skills: {
      grammar: { theta: 0, se: 0.5, nObs: 3 },
      vocabulary: { theta: 0, se: 0.5, nObs: 3 },
      reading: { theta: 0, se: 0.5, nObs: 2 },
      listening: { theta: 0, se: 0.5, nObs: 2 },
      pragmatics: { theta: 0, se: 0.5, nObs: 2 },
    },
    responses: [...responses],
    consecutive: null,
    lastConceptIds: [],
  };
}

function measured(
  skill: SkillDomain,
  level: PlacementResult['overallLevel'],
): PlacementSkillResult {
  return {
    skill,
    measured: true,
    level,
    range: level,
    confidence: 0.7,
    theta: 0,
    se: 0.5,
    nObs: 3,
    score: 0.5,
  };
}

function resultWith(
  overallLevel: PlacementResult['overallLevel'],
  measuredSkills: readonly PlacementSkillResult[],
  confidence = 0.7,
): PlacementResult {
  return {
    overallLevel,
    overallRange: overallLevel,
    confidence,
    overallTheta: 0,
    measured: [...measuredSkills],
    unmeasured: [],
    priorities: [],
  };
}

describe('concept evidence', () => {
  it('aggregates repeated evidence with EMA and sorts by concept', () => {
    const state = stateWith([
      response('b', 'grammar', true, 1),
      response('a', 'grammar', true, 2),
      response('a', 'grammar', true, 3),
    ]);
    const evidence = aggregateConceptEvidence(state);
    expect(evidence.map((entry) => entry.conceptId)).toEqual(['a', 'b']);
    expect(evidence[0]?.nObs).toBe(2);
    expect(evidence[0]?.correct).toBe(2);
    expect(evidence[0]?.mastery).toBeGreaterThan(0.7);
    expect(evidence[1]?.mastery).toBeLessThan(evidence[0]?.mastery ?? 0);
  });

  it('marks a concept for test-out only with enough high-mastery evidence', () => {
    const state = stateWith([
      response('known', 'grammar', true, 1),
      response('known', 'grammar', true, 2),
      response('known', 'grammar', true, 3),
      response('known', 'grammar', true, 4),
      response('fragile', 'grammar', true, 5),
      response('fragile', 'grammar', false, 6),
    ]);
    const decisions = evaluatePlacementDecisions(
      state,
      resultWith('B1', [measured('grammar', 'B1')]),
    );
    expect(decisions.testOutConcepts.map((entry) => entry.conceptId)).toEqual(['known']);
    expect(decisions.testOutConcepts[0]?.mastery).toBeGreaterThanOrEqual(CONCEPT_MASTERY_THRESHOLD);
    expect(decisions.testOutConcepts.some((entry) => entry.conceptId === 'fragile')).toBe(false);
  });

  it('does not test out a single lucky answer', () => {
    const state = stateWith([response('once', 'grammar', true, 1)]);
    const decisions = evaluatePlacementDecisions(
      state,
      resultWith('B1', [measured('grammar', 'B1')]),
    );
    expect(decisions.testOutConcepts).toEqual([]);
  });
});

describe('remediation and challenge', () => {
  it('flags a measured skill a full band below the overall level', () => {
    const state = stateWith([
      response('past-simple', 'grammar', false, 1),
      response('present-perfect', 'grammar', true, 2),
    ]);
    const decisions = evaluatePlacementDecisions(
      state,
      resultWith('B2', [measured('grammar', 'B1'), measured('reading', 'B2')]),
    );
    expect(decisions.remediationSkills).toHaveLength(1);
    expect(decisions.remediationSkills[0]?.skill).toBe('grammar');
    expect(decisions.remediationSkills[0]?.gap).toBe(1);
    expect(decisions.remediationSkills[0]?.concepts[0]?.conceptId).toBe('past-simple');
  });

  it('challenges the next band only when confident and without gaps', () => {
    const state = stateWith([response('a', 'grammar', true, 1)]);
    const confident = evaluatePlacementDecisions(
      state,
      resultWith('B1', [measured('grammar', 'B1')], 0.7),
    );
    expect(confident.challengeLevel).toBe('B2');

    const lowConfidence = evaluatePlacementDecisions(
      state,
      resultWith('B1', [measured('grammar', 'B1')], 0.4),
    );
    expect(lowConfidence.challengeLevel).toBeNull();
  });

  it('does not challenge while remediation is open', () => {
    const state = stateWith([response('a', 'grammar', false, 1)]);
    const decisions = evaluatePlacementDecisions(
      state,
      resultWith('B2', [measured('grammar', 'B1')], 0.9),
    );
    expect(decisions.remediationSkills).toHaveLength(1);
    expect(decisions.challengeLevel).toBeNull();
  });
});
