import { describe, expect, it } from 'vitest';

import type { PlacementResult } from '../src/assessment.js';
import {
  applyWritingToResult,
  countWords,
  mergeWritingEvaluations,
  validateWritingResponse,
  writingScore,
  type WritingEvaluation,
  type WritingTask,
} from '../src/writing.js';

const task: WritingTask = {
  id: 'placement.writing.en.v1',
  targetLang: 'en',
  skillId: 'skill-en-writing',
  prompt: 'Write about a recent decision.',
  minWords: 5,
  maxWords: 12,
  cefrTarget: 'B1',
};

function evaluation(
  level: WritingEvaluation['estimatedLevel'],
  confidence = 0.8,
): WritingEvaluation {
  return {
    estimatedLevel: level,
    levelRange: [level, level],
    dimensions: {
      taskAchievement: 4,
      coherence: 3,
      range: 3,
      accuracy: 3,
      fluency: null,
    },
    strengths: ['Clear structure'],
    priorities: ['Use more precise verbs'],
    errors: [],
    confidence,
  };
}

const result: PlacementResult = {
  overallLevel: 'B1',
  overallRange: 'B1',
  confidence: 0.7,
  overallTheta: 0.2,
  measured: [],
  unmeasured: ['listening', 'speaking', 'writing'],
  priorities: [],
};

describe('writing validation', () => {
  it('counts words and rejects short or long responses', () => {
    expect(countWords('  one   two  ')).toBe(2);
    expect(validateWritingResponse('one two', task).ok).toBe(false);
    expect(validateWritingResponse('one two three four five', task).ok).toBe(true);

    const long = Array.from({ length: 13 }, () => 'word').join(' ');
    expect(validateWritingResponse(long, task).ok).toBe(false);
  });
});

describe('writing evaluation merge', () => {
  it('chooses the lower level and averages dimensions across passes', () => {
    const first = evaluation('B2', 0.9);
    const second: WritingEvaluation = {
      ...evaluation('B1', 0.6),
      dimensions: {
        taskAchievement: 2,
        coherence: 2,
        range: 2,
        accuracy: 2,
        fluency: null,
      },
    };
    const merged = mergeWritingEvaluations([first, second]);
    expect(merged?.estimatedLevel).toBe('B1');
    expect(merged?.confidence).toBe(0.6);
    expect(merged?.dimensions.taskAchievement).toBe(3);
    expect(merged?.levelRange).toEqual(['B1', 'B2']);
  });

  it('returns a single pass unchanged', () => {
    const pass = evaluation('B1');
    expect(mergeWritingEvaluations([pass])).toEqual(pass);
    expect(mergeWritingEvaluations([])).toBeNull();
  });

  it('maps rubric dimensions to a 0-1 score', () => {
    expect(writingScore(evaluation('B1'))).toBe(0.65);
  });
});

describe('writing result merge', () => {
  it('adds writing, removes it from unmeasured and shifts the overall level', () => {
    const merged = applyWritingToResult(result, evaluation('C1', 0.9), 2);
    expect(merged.writing?.level).toBe('C1');
    expect(merged.writing?.nObs).toBe(2);
    expect(merged.unmeasured).not.toContain('writing');
    expect(merged.overallTheta).toBeGreaterThan(result.overallTheta);
    expect(merged.overallLevel).toBe('B1');
  });

  it('keeps a low writing score from inflating the overall level', () => {
    const merged = applyWritingToResult(result, evaluation('A1', 0.9), 2);
    expect(merged.writing?.level).toBe('A1');
    expect(merged.overallTheta).toBeLessThan(result.overallTheta);
  });
});
