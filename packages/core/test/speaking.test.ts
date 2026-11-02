import { describe, expect, it } from 'vitest';

import type { PlacementResult } from '../src/assessment.js';
import { applySpeakingToResult } from '../src/speaking.js';
import type { WritingEvaluation } from '../src/writing.js';

const base: PlacementResult = {
  overallLevel: 'B1',
  overallRange: 'B1',
  confidence: 0.7,
  overallTheta: 0.2,
  objectiveTheta: 0.2,
  objectiveSe: 0.3,
  measured: [],
  unmeasured: ['listening', 'speaking', 'writing'],
  priorities: [],
};

function evaluation(level: 'A1' | 'B1' | 'C1', confidence = 0.8): WritingEvaluation {
  return {
    estimatedLevel: level,
    levelRange: [level, level],
    dimensions: {
      taskAchievement: 3,
      coherence: 3,
      range: 3,
      accuracy: 3,
      fluency: 3,
    },
    strengths: ['Clear message'],
    priorities: ['Add one reason'],
    errors: [],
    confidence,
  };
}

describe('speaking result merge', () => {
  it('adds speaking and removes it from unmeasured', () => {
    const merged = applySpeakingToResult(base, evaluation('C1', 0.9), 2);
    expect(merged.speaking?.level).toBe('C1');
    expect(merged.speaking?.nObs).toBe(2);
    expect(merged.unmeasured).not.toContain('speaking');
    expect(merged.overallTheta).toBeGreaterThan(base.overallTheta);
  });

  it('combines objective, writing and speaking weights', () => {
    const withWriting: PlacementResult = {
      ...base,
      writing: {
        level: 'B1',
        range: 'B1',
        confidence: 0.8,
        theta: 0.1,
        se: 0.2,
        score: 0.6,
        nObs: 2,
        strengths: [],
        priorities: [],
      },
      unmeasured: ['listening', 'speaking'],
    };
    const merged = applySpeakingToResult(withWriting, evaluation('B1'), 2);
    expect(merged.speaking).toBeDefined();
    expect(merged.overallLevel).toBe('B1');
    expect(merged.writing?.level).toBe('B1');
  });

  it('keeps a low speaking score from inflating the overall level', () => {
    const merged = applySpeakingToResult(base, evaluation('A1', 0.9), 2);
    expect(merged.overallTheta).toBeLessThan(base.overallTheta);
  });
});
