import { z } from 'zod';

import { placementDecisionsSchema } from './placement-decisions.js';
import { writingResultSchema, writingTaskSchema } from './writing.js';
import { cefrLevelSchema, skillDomainSchema } from './schemas.js';
import {
  CEFR_LEVELS,
  SKILL_DOMAINS,
  cefrFromTheta,
  cefrRangeLabel,
  isAtLeast,
  thetaFromCefr,
  type CefrLevel,
  type SkillDomain,
} from './skills.js';

export const ASSESSMENT_ITEM_TYPES = [
  'cloze',
  'transformation',
  'word_order',
  'dictation',
  'listening_mcq',
  'reading_mcq',
  'free_writing',
  'roleplay',
  'shadowing',
  'reuse_lexicon',
  'error_spotting',
] as const;

export type AssessmentItemType = (typeof ASSESSMENT_ITEM_TYPES)[number];

export const PLACEMENT_SKILLS = ['grammar', 'vocabulary', 'reading', 'pragmatics'] as const;

export type PlacementSkill = (typeof PLACEMENT_SKILLS)[number];

export const PLACEMENT_TARGETS: Record<PlacementSkill, number> = {
  grammar: 6,
  vocabulary: 5,
  reading: 4,
  pragmatics: 3,
};

export const PLACEMENT_MIN_EVIDENCE: Record<PlacementSkill, number> = {
  grammar: 3,
  vocabulary: 3,
  reading: 2,
  pragmatics: 2,
};

export const PLACEMENT_TOTAL_TARGET = 18;
export const PLACEMENT_MAX_ITEMS = 24;
export const PLACEMENT_MAX_CONSECUTIVE = 8;
export const DISCRIMINATION_SCALE = 1.2;

export const assessmentOptionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(500),
});

const assessmentItemBaseSchema = z.object({
  id: z.string().min(1).max(120),
  targetLang: z.string().min(2).max(20),
  type: z.enum(ASSESSMENT_ITEM_TYPES),
  skill: z.enum(PLACEMENT_SKILLS),
  skillId: z.string().min(1).max(120),
  cefrLevel: cefrLevelSchema,
  conceptId: z.string().min(1).max(120),
  difficultyB: z.number().finite().min(-5).max(5),
  prompt: z.string().min(1).max(2000),
  options: z.array(assessmentOptionSchema).min(2).max(5),
  correctOptionId: z.string().min(1).max(40),
  explanation: z.string().min(1).max(1500),
});

export const assessmentItemSchema = assessmentItemBaseSchema.refine(
  (item) => item.options.some((option) => option.id === item.correctOptionId),
  { message: 'correctOptionId must reference an option', path: ['correctOptionId'] },
);

export type AssessmentItem = z.infer<typeof assessmentItemSchema>;

export const placementItemSchema = assessmentItemBaseSchema.omit({
  correctOptionId: true,
  explanation: true,
});

export type PlacementItem = z.infer<typeof placementItemSchema>;

export const placementFeedbackSchema = z.object({
  correct: z.boolean(),
  correctOptionId: z.string().min(1),
  explanation: z.string().min(1),
});

export type PlacementFeedback = z.infer<typeof placementFeedbackSchema>;

const skillEstimateSchema = z.object({
  theta: z.number().finite(),
  se: z.number().positive(),
  nObs: z.number().int().nonnegative(),
});

export type SkillEstimate = z.infer<typeof skillEstimateSchema>;

const placementResponseSchema = z.object({
  itemId: z.string().min(1),
  skill: z.enum(PLACEMENT_SKILLS),
  conceptId: z.string().min(1),
  correct: z.boolean(),
  answeredAt: z.iso.datetime({ offset: false }),
});

export type PlacementResponse = z.infer<typeof placementResponseSchema>;

export const placementStateSchema = z.object({
  targetLang: z.string().min(2).max(20),
  startedAt: z.iso.datetime({ offset: false }),
  skills: z.object({
    grammar: skillEstimateSchema,
    vocabulary: skillEstimateSchema,
    reading: skillEstimateSchema,
    pragmatics: skillEstimateSchema,
  }),
  responses: z.array(placementResponseSchema),
  consecutive: z
    .object({
      outcome: z.enum(['correct', 'incorrect']),
      count: z.number().int().positive(),
    })
    .nullable(),
  lastConceptIds: z.array(z.string().min(1)).max(2),
});

export type PlacementState = z.infer<typeof placementStateSchema>;

export const placementSkillResultSchema = z.object({
  skill: skillDomainSchema,
  measured: z.boolean(),
  level: cefrLevelSchema.nullable(),
  range: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  theta: z.number().finite(),
  se: z.number().positive(),
  nObs: z.number().int().nonnegative(),
  score: z.number().min(0).max(1),
});

export type PlacementSkillResult = z.infer<typeof placementSkillResultSchema>;

export const placementPrioritySchema = z.object({
  skill: skillDomainSchema,
  level: cefrLevelSchema,
  theta: z.number().finite(),
});

export const placementResultSchema = z.object({
  overallLevel: cefrLevelSchema.nullable(),
  overallRange: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  overallTheta: z.number().finite(),
  measured: z.array(placementSkillResultSchema),
  unmeasured: z.array(skillDomainSchema),
  priorities: z.array(placementPrioritySchema),
  decisions: placementDecisionsSchema.optional(),
  writing: writingResultSchema.optional(),
});

export type PlacementResult = z.infer<typeof placementResultSchema>;

export const placementProgressSchema = z.object({
  answered: z.number().int().nonnegative(),
  target: z.number().int().positive(),
});

export const placementStageSchema = z.enum(['objective', 'writing', 'completed']);

export const placementStartSchema = z.object({
  assessmentId: z.string().min(1),
  status: z.enum(['in_progress', 'completed', 'abandoned']),
  stage: placementStageSchema,
  item: placementItemSchema.nullable(),
  writingTask: writingTaskSchema.nullable(),
  progress: placementProgressSchema,
});

export const placementAnswerSchema = z.object({
  assessmentId: z.string().min(1),
  completed: z.boolean(),
  stage: placementStageSchema,
  feedback: placementFeedbackSchema.nullable(),
  item: placementItemSchema.nullable(),
  writingTask: writingTaskSchema.nullable(),
  result: placementResultSchema.nullable(),
  progress: placementProgressSchema,
});

export type PlacementStart = z.infer<typeof placementStartSchema>;
export type PlacementAnswer = z.infer<typeof placementAnswerSchema>;

export interface CreatePlacementStateInput {
  readonly targetLang: string;
  readonly selfAssessment?: Partial<Record<SkillDomain, CefrLevel>>;
  readonly now: Date;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function cefrRange(level: CefrLevel): readonly CefrLevel[] {
  const index = CEFR_LEVELS.indexOf(level);
  return CEFR_LEVELS.slice(0, index + 1);
}

export function probabilityCorrect(theta: number, difficultyB: number): number {
  const z = (theta - difficultyB) / DISCRIMINATION_SCALE;
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function masteryFromTheta(theta: number): number {
  return probabilityCorrect(theta, 0);
}

function emptySkills(
  selfAssessment?: Partial<Record<SkillDomain, CefrLevel>>,
): PlacementState['skills'] {
  const grammar = selfAssessment?.grammar;
  const vocabulary = selfAssessment?.vocabulary;
  const reading = selfAssessment?.reading;
  const pragmatics = selfAssessment?.pragmatics;
  return {
    grammar: { theta: grammar ? thetaFromCefr(grammar) : 0, se: 1, nObs: 0 },
    vocabulary: { theta: vocabulary ? thetaFromCefr(vocabulary) : 0, se: 1, nObs: 0 },
    reading: { theta: reading ? thetaFromCefr(reading) : 0, se: 1, nObs: 0 },
    pragmatics: { theta: pragmatics ? thetaFromCefr(pragmatics) : 0, se: 1, nObs: 0 },
  };
}

export function createPlacementState(input: CreatePlacementStateInput): PlacementState {
  return {
    targetLang: input.targetLang,
    startedAt: input.now.toISOString(),
    skills: emptySkills(input.selfAssessment),
    responses: [],
    consecutive: null,
    lastConceptIds: [],
  };
}

export function updateEloEstimate(
  estimate: SkillEstimate,
  difficultyB: number,
  correct: boolean,
): SkillEstimate {
  const expected = probabilityCorrect(estimate.theta, difficultyB);
  const k = Math.max(0.12, 0.4 / (1 + estimate.nObs / 10));
  const nObs = estimate.nObs + 1;
  return {
    theta: round(estimate.theta + k * ((correct ? 1 : 0) - expected)),
    se: round(Math.max(0.15, 1 / Math.sqrt(nObs + 1))),
    nObs,
  };
}

export function updateSkillEstimate(
  estimate: SkillEstimate,
  item: AssessmentItem,
  correct: boolean,
): SkillEstimate {
  return updateEloEstimate(estimate, item.difficultyB, correct);
}

function withSkill(
  skills: PlacementState['skills'],
  skill: PlacementSkill,
  estimate: SkillEstimate,
): PlacementState['skills'] {
  return {
    grammar: skill === 'grammar' ? estimate : skills.grammar,
    vocabulary: skill === 'vocabulary' ? estimate : skills.vocabulary,
    reading: skill === 'reading' ? estimate : skills.reading,
    pragmatics: skill === 'pragmatics' ? estimate : skills.pragmatics,
  };
}

export interface RecordPlacementAnswerResult {
  readonly state: PlacementState;
  readonly correct: boolean;
}

export function recordPlacementAnswer(
  state: PlacementState,
  item: AssessmentItem,
  optionId: string,
  now: Date,
): RecordPlacementAnswerResult {
  const correct = optionId === item.correctOptionId;
  const outcome: 'correct' | 'incorrect' = correct ? 'correct' : 'incorrect';
  const estimate = updateSkillEstimate(state.skills[item.skill], item, correct);
  const lastConceptIds = [...state.lastConceptIds, item.conceptId].slice(-2);
  const consecutive =
    state.consecutive?.outcome === outcome
      ? { outcome, count: state.consecutive.count + 1 }
      : { outcome, count: 1 };

  return {
    correct,
    state: {
      ...state,
      skills: withSkill(state.skills, item.skill, estimate),
      responses: [
        ...state.responses,
        {
          itemId: item.id,
          skill: item.skill,
          conceptId: item.conceptId,
          correct,
          answeredAt: now.toISOString(),
        },
      ],
      consecutive,
      lastConceptIds,
    },
  };
}

function answeredCounts(state: PlacementState): Record<PlacementSkill, number> {
  return {
    grammar: state.responses.filter((response) => response.skill === 'grammar').length,
    vocabulary: state.responses.filter((response) => response.skill === 'vocabulary').length,
    reading: state.responses.filter((response) => response.skill === 'reading').length,
    pragmatics: state.responses.filter((response) => response.skill === 'pragmatics').length,
  };
}

export function isPlacementComplete(state: PlacementState): boolean {
  if (state.responses.length >= PLACEMENT_MAX_ITEMS) return true;
  if (state.consecutive && state.consecutive.count >= PLACEMENT_MAX_CONSECUTIVE) return true;

  const counts = answeredCounts(state);
  const hasMinimumEvidence = PLACEMENT_SKILLS.every(
    (skill) => counts[skill] >= PLACEMENT_MIN_EVIDENCE[skill],
  );
  if (!hasMinimumEvidence) return false;

  const preciseEnough = PLACEMENT_SKILLS.every((skill) => state.skills[skill].se < 0.35);
  return state.responses.length >= PLACEMENT_TOTAL_TARGET || preciseEnough;
}

function repeatedConcept(state: PlacementState): string | null {
  if (state.lastConceptIds.length < 2) return null;
  const first = state.lastConceptIds[0];
  const second = state.lastConceptIds[1];
  return first && second && first === second ? first : null;
}

export function selectNextPlacementItem(
  state: PlacementState,
  items: readonly AssessmentItem[],
): AssessmentItem | null {
  const served = new Set(state.responses.map((response) => response.itemId));
  const available = items.filter(
    (item) => item.targetLang === state.targetLang && !served.has(item.id),
  );
  if (available.length === 0) return null;

  const counts = answeredCounts(state);
  const deficits = PLACEMENT_SKILLS.map((skill, index) => ({
    skill,
    index,
    deficit: PLACEMENT_TARGETS[skill] - counts[skill],
  }))
    .filter((entry) => entry.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit || a.index - b.index);

  const repeated = repeatedConcept(state);

  for (const entry of deficits) {
    const skillItems = available.filter((item) => item.skill === entry.skill);
    if (skillItems.length === 0) continue;

    const withoutRepeat = repeated
      ? skillItems.filter((item) => item.conceptId !== repeated)
      : skillItems;
    const pool = withoutRepeat.length > 0 ? withoutRepeat : skillItems;
    const theta = state.skills[entry.skill].theta;
    const inWindow = pool.filter((item) => Math.abs(item.difficultyB - theta) <= 0.6);
    const ranked = (inWindow.length > 0 ? inWindow : pool)
      .slice()
      .sort(
        (a, b) =>
          Math.abs(a.difficultyB - theta) - Math.abs(b.difficultyB - theta) ||
          a.id.localeCompare(b.id),
      );
    const selected = ranked[0];
    if (selected) return selected;
  }

  return null;
}

function measuredSkill(state: PlacementState, skill: PlacementSkill): PlacementSkillResult {
  const estimate = state.skills[skill];
  const count = state.responses.filter((response) => response.skill === skill).length;
  const measured = count >= PLACEMENT_MIN_EVIDENCE[skill];
  const level = cefrFromTheta(estimate.theta);
  const range = cefrRangeLabel(estimate.theta - estimate.se, estimate.theta + estimate.se);
  return {
    skill,
    measured,
    level: measured ? level : null,
    range: measured ? range : null,
    confidence: measured ? round(clamp(1 - estimate.se, 0, 1)) : 0,
    theta: round(estimate.theta),
    se: round(estimate.se),
    nObs: count,
    score: measured ? round(masteryFromTheta(estimate.theta)) : 0,
  };
}

export function buildPlacementResult(state: PlacementState): PlacementResult {
  const measured = PLACEMENT_SKILLS.map((skill) => measuredSkill(state, skill));
  const withEvidence = measured.filter((entry) => entry.measured);
  const totalObs = withEvidence.reduce((sum, entry) => sum + entry.nObs, 0);
  const weightedTheta =
    totalObs === 0
      ? 0
      : withEvidence.reduce((sum, entry) => sum + entry.theta * entry.nObs, 0) / totalObs;
  const overallSe = totalObs === 0 ? 1 : Math.max(0.15, 1 / Math.sqrt(totalObs + 1));
  const overallLevel = withEvidence.length === 0 ? null : cefrFromTheta(weightedTheta);
  const unmeasured = SKILL_DOMAINS.filter(
    (domain) => !withEvidence.some((entry) => entry.skill === domain),
  );
  const priorities = withEvidence
    .slice()
    .sort((a, b) => a.theta - b.theta || a.skill.localeCompare(b.skill))
    .slice(0, 3)
    .flatMap((entry) => {
      if (!entry.level) return [];
      return [{ skill: entry.skill, level: entry.level, theta: entry.theta }];
    });

  return {
    overallLevel,
    overallRange:
      overallLevel === null
        ? null
        : cefrRangeLabel(weightedTheta - overallSe, weightedTheta + overallSe),
    confidence: withEvidence.length === 0 ? 0 : round(clamp(1 - overallSe, 0, 1)),
    overallTheta: round(weightedTheta),
    measured,
    unmeasured,
    priorities,
  };
}

export function placementLevelAtLeast(level: CefrLevel, required: CefrLevel): boolean {
  return isAtLeast(level, required);
}
