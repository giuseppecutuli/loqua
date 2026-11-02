import { updateEloEstimate, type SkillEstimate } from './assessment.js';

export const CONCEPT_MASTERY_ALPHA = 0.3;

export interface ConceptState {
  readonly conceptId: string;
  readonly mastery: number;
  readonly evidenceCount: number;
  readonly lastErrorAt: string | null;
  readonly lastSeenAt: string | null;
}

export interface ApplyAttemptInput {
  readonly skill: SkillEstimate;
  readonly concept: ConceptState;
  readonly difficultyB: number;
  readonly correct: boolean;
  readonly now: Date;
}

export interface ApplyAttemptResult {
  readonly correct: boolean;
  readonly skill: SkillEstimate;
  readonly concept: ConceptState;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createConceptState(conceptId: string): ConceptState {
  return {
    conceptId,
    mastery: 0,
    evidenceCount: 0,
    lastErrorAt: null,
    lastSeenAt: null,
  };
}

export function applyAttempt(input: ApplyAttemptInput): ApplyAttemptResult {
  const outcome = input.correct ? 1 : 0;
  const mastery = clamp(
    input.concept.mastery + CONCEPT_MASTERY_ALPHA * (outcome - input.concept.mastery),
    0,
    1,
  );
  const now = input.now.toISOString();

  return {
    correct: input.correct,
    skill: updateEloEstimate(input.skill, input.difficultyB, input.correct),
    concept: {
      conceptId: input.concept.conceptId,
      mastery: round(mastery),
      evidenceCount: input.concept.evidenceCount + 1,
      lastErrorAt: input.correct ? input.concept.lastErrorAt : now,
      lastSeenAt: now,
    },
  };
}
