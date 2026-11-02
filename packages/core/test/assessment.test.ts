import { describe, expect, it } from 'vitest';

import {
  PLACEMENT_MAX_ITEMS,
  PLACEMENT_TARGETS,
  assessmentItemSchema,
  buildPlacementResult,
  createPlacementState,
  isPlacementComplete,
  recordPlacementAnswer,
  selectNextPlacementItem,
  updateSkillEstimate,
  type AssessmentItem,
  type PlacementSkill,
  type PlacementState,
} from '../src/assessment.js';
import { cefrFromTheta, cefrRangeLabel, thetaFromCefr } from '../src/skills.js';

const now = new Date('2026-11-02T10:00:00.000Z');

function makeItem(
  skill: PlacementSkill,
  index: number,
  difficultyB: number,
  conceptId = `concept-${skill}-${index}`,
): AssessmentItem {
  const id = `item-${skill}-${index}`;
  return {
    id,
    targetLang: 'en',
    type: 'cloze',
    skill,
    skillId: `skill-${skill}`,
    cefrLevel: 'B1',
    conceptId,
    difficultyB,
    prompt: `Choose the correct option for ${id}.`,
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
      { id: 'c', text: 'Option C' },
    ],
    correctOptionId: 'a',
    explanation: 'Option A is correct.',
  };
}

const difficulties: Record<PlacementSkill, number[]> = {
  grammar: [-2, -1.2, -0.4, 0.2, 1, 2],
  vocabulary: [-1.8, -0.8, 0, 0.9, 1.7],
  reading: [-1.4, -0.2, 0.8],
  listening: [-1.2, 0, 1.2],
  pragmatics: [-1, 0.3, 1.4],
};

const bank: readonly AssessmentItem[] = (
  Object.entries(difficulties) as Array<[PlacementSkill, number[]]>
).flatMap(([skill, values]) => values.map((value, index) => makeItem(skill, index, value)));

function runPlacement(state: PlacementState, pattern: (index: number) => boolean) {
  let current = state;
  let index = 0;
  while (!isPlacementComplete(current)) {
    const item = selectNextPlacementItem(current, bank);
    if (!item) break;
    const outcome = current.responses.length;
    const correct = pattern(outcome);
    current = recordPlacementAnswer(
      current,
      item,
      correct ? item.correctOptionId : 'wrong',
      now,
    ).state;
    index += 1;
    if (index > PLACEMENT_MAX_ITEMS + 5) throw new Error('placement did not terminate');
  }
  return current;
}

describe('CEFR mapping', () => {
  it('maps theta cut scores to levels', () => {
    expect(cefrFromTheta(-3)).toBe('A1');
    expect(cefrFromTheta(-1.5)).toBe('A2');
    expect(cefrFromTheta(-0.5)).toBe('B1');
    expect(cefrFromTheta(0.69)).toBe('B1');
    expect(cefrFromTheta(0.7)).toBe('B2');
    expect(cefrFromTheta(1.8)).toBe('C1');
  });

  it('shows an interval when it crosses a boundary', () => {
    expect(cefrRangeLabel(-0.4, 0.8)).toBe('B1/B2');
    expect(cefrRangeLabel(0.2, 0.6)).toBe('B1');
  });

  it('seeds theta from self-assessment', () => {
    expect(thetaFromCefr('B1')).toBe(0.1);
    const state = createPlacementState({
      targetLang: 'en',
      selfAssessment: { grammar: 'A2', reading: 'C1' },
      now,
    });
    expect(state.skills.grammar.theta).toBe(-1);
    expect(state.skills.reading.theta).toBe(2.2);
    expect(state.skills.vocabulary.theta).toBe(0);
  });
});

describe('elo updates', () => {
  it('moves theta up on a correct answer and down on a wrong one', () => {
    const item = makeItem('grammar', 0, 0);
    const base = { theta: 0, se: 1, nObs: 0 };
    const correct = updateSkillEstimate(base, item, true);
    const incorrect = updateSkillEstimate(base, item, false);
    expect(correct.theta).toBeGreaterThan(0);
    expect(incorrect.theta).toBeLessThan(0);
    expect(correct.se).toBeLessThan(base.se);
    expect(correct.nObs).toBe(1);
  });
});

describe('adaptive selection', () => {
  it('is deterministic and fills the blueprint deficits', () => {
    const state = createPlacementState({ targetLang: 'en', now });
    const first = selectNextPlacementItem(state, bank);
    const second = selectNextPlacementItem(state, bank);
    expect(first?.id).toBe(second?.id);
    expect(first?.skill).toBe('grammar');

    let current = state;
    for (let index = 0; index < 2; index += 1) {
      const item = selectNextPlacementItem(current, bank);
      if (!item) throw new Error('missing grammar item');
      expect(item.skill).toBe('grammar');
      current = recordPlacementAnswer(current, item, item.correctOptionId, now).state;
    }
    expect(selectNextPlacementItem(current, bank)?.skill).toBe('vocabulary');
  });

  it('avoids three items on the same concept in a row', () => {
    const repeated = makeItem('grammar', 20, 0, 'concept-repeat');
    const repeatedTwo = makeItem('grammar', 21, 0.1, 'concept-repeat');
    const different = makeItem('grammar', 22, 0.2, 'concept-other');
    let state = createPlacementState({ targetLang: 'en', now });
    state = recordPlacementAnswer(state, repeated, repeated.correctOptionId, now).state;
    state = recordPlacementAnswer(state, repeatedTwo, repeatedTwo.correctOptionId, now).state;
    const next = selectNextPlacementItem(state, [repeated, repeatedTwo, different]);
    expect(next?.id).toBe(different.id);
  });

  it('never selects text or word-order items for placement', () => {
    const state = createPlacementState({ targetLang: 'en', now });
    const textItem: AssessmentItem = {
      ...makeItem('grammar', 900, 0),
      id: 'text-placement-item',
      type: 'transformation',
      answerMode: 'text',
      options: [{ id: 'a', text: 'I went home.' }],
      correctOptionId: 'a',
    };
    expect(selectNextPlacementItem(state, [textItem])).toBeNull();
    const legacyTextItem = { ...textItem, answerMode: undefined };
    expect(selectNextPlacementItem(state, [legacyTextItem])).toBeNull();
  });

  it('returns null when the pool is exhausted', () => {
    const state = createPlacementState({ targetLang: 'en', now });
    expect(selectNextPlacementItem(state, [])).toBeNull();
    expect(selectNextPlacementItem(state, [makeItem('grammar', 0, 0)])).not.toBeNull();
  });
});

describe('placement completion and result', () => {
  it('completes after the 18-item blueprint without a long streak', () => {
    const state = createPlacementState({
      targetLang: 'en',
      selfAssessment: {
        grammar: 'B1',
        vocabulary: 'B1',
        reading: 'B1',
        listening: 'B1',
        pragmatics: 'B1',
      },
      now,
    });
    const completed = runPlacement(state, (index) => index % 5 !== 4);
    expect(completed.responses.length).toBe(18);
    expect(isPlacementComplete(completed)).toBe(true);
    const counts = completed.responses.reduce(
      (acc, response) => {
        acc[response.skill] += 1;
        return acc;
      },
      { grammar: 0, vocabulary: 0, reading: 0, listening: 0, pragmatics: 0 },
    );
    expect(counts).toEqual(PLACEMENT_TARGETS);
  });

  it('stops after eight identical answers', () => {
    let state = createPlacementState({ targetLang: 'en', now });
    for (let index = 0; index < 8; index += 1) {
      const item = selectNextPlacementItem(state, bank);
      if (!item) throw new Error('missing item');
      state = recordPlacementAnswer(state, item, 'wrong', now).state;
    }
    expect(isPlacementComplete(state)).toBe(true);
    expect(state.responses.length).toBe(8);
  });

  it('reports measured and unmeasured skills with priorities', () => {
    const state = createPlacementState({
      targetLang: 'en',
      selfAssessment: { grammar: 'B1', vocabulary: 'B1', reading: 'B1', pragmatics: 'B1' },
      now,
    });
    const completed = runPlacement(state, (index) => index % 5 !== 4);
    const result = buildPlacementResult(completed);
    expect(result.overallLevel).not.toBeNull();
    expect(result.measured.filter((entry) => entry.measured)).toHaveLength(5);
    expect(result.unmeasured).toEqual(['speaking', 'writing']);
    expect(result.priorities).toHaveLength(3);
    expect(result.confidence).toBeGreaterThan(0);
    for (const entry of result.measured) {
      expect(entry.level === null || entry.range).toBeTruthy();
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(1);
    }
  });

  it('reports not measured when evidence is too thin', () => {
    let state = createPlacementState({ targetLang: 'en', now });
    const first = selectNextPlacementItem(state, bank);
    if (!first) throw new Error('missing item');
    state = recordPlacementAnswer(state, first, first.correctOptionId, now).state;
    const result = buildPlacementResult(state);
    expect(result.measured.every((entry) => entry.measured === false)).toBe(true);
    expect(result.overallLevel).toBeNull();
    expect(result.unmeasured).toContain('grammar');
  });

  it('rejects an item whose correct answer is not an option', () => {
    const item = makeItem('grammar', 0, 0);
    const parsed = assessmentItemSchema.safeParse({ ...item, correctOptionId: 'missing' });
    expect(parsed.success).toBe(false);
  });
});
