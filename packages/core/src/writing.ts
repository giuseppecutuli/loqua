import { z } from 'zod';

import type { PlacementResult } from './assessment.js';
import { cefrLevelSchema } from './schemas.js';
import {
  cefrRank,
  cefrFromTheta,
  cefrRangeLabel,
  thetaFromCefr,
  type CefrLevel,
} from './skills.js';
import { err, ok, type Result } from './result.js';

export const WRITING_MIN_WORDS = 40;
export const WRITING_MAX_WORDS = 180;

export const writingTaskSchema = z.object({
  id: z.string().min(1),
  targetLang: z.string().min(2),
  skillId: z.string().min(1),
  prompt: z.string().min(1).max(1000),
  minWords: z.number().int().positive(),
  maxWords: z.number().int().positive(),
  cefrTarget: cefrLevelSchema,
});

export type WritingTask = z.infer<typeof writingTaskSchema>;

export const writingDimensionsSchema = z.object({
  taskAchievement: z.number().min(0).max(5),
  coherence: z.number().min(0).max(5),
  range: z.number().min(0).max(5),
  accuracy: z.number().min(0).max(5),
  fluency: z.number().min(0).max(5).nullable(),
});

export type WritingDimensions = z.infer<typeof writingDimensionsSchema>;

export const writingErrorSchema = z.object({
  span: z.string().min(1).max(400),
  errorType: z.string().min(1).max(60),
  ruleId: z.string().nullable(),
  suggestion: z.string().min(1).max(400),
  explanationText: z.string().min(1).max(600),
  severity: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
});

export const writingEvaluationSchema = z.object({
  estimatedLevel: cefrLevelSchema,
  levelRange: z.tuple([cefrLevelSchema, cefrLevelSchema]),
  dimensions: writingDimensionsSchema,
  strengths: z.array(z.string().min(1).max(300)).max(3),
  priorities: z.array(z.string().min(1).max(300)).max(3),
  errors: z.array(writingErrorSchema).max(5),
  confidence: z.number().min(0).max(1),
});

export type WritingEvaluation = z.infer<typeof writingEvaluationSchema>;

export const writingResultSchema = z.object({
  level: cefrLevelSchema,
  range: z.string(),
  confidence: z.number().min(0).max(1),
  theta: z.number().finite(),
  se: z.number().positive(),
  score: z.number().min(0).max(1),
  nObs: z.number().int().positive(),
  strengths: z.array(z.string()),
  priorities: z.array(z.string()),
});

export type WritingResult = z.infer<typeof writingResultSchema>;

export type WritingValidationError = 'too_short' | 'too_long';

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function validateWritingResponse(
  text: string,
  task: WritingTask,
): Result<{ readonly wordCount: number }, WritingValidationError> {
  const wordCount = countWords(text);
  if (wordCount < task.minWords) return err('too_short');
  if (wordCount > task.maxWords) return err('too_long');
  return ok({ wordCount });
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(first: number, second: number): number {
  return round((first + second) / 2, 1);
}

function averageNullable(first: number | null, second: number | null): number | null {
  if (first === null && second === null) return null;
  if (first === null) return second;
  if (second === null) return first;
  return average(first, second);
}

function lowerLevel(first: CefrLevel, second: CefrLevel): CefrLevel {
  return cefrRank(first) <= cefrRank(second) ? first : second;
}

export function mergeWritingEvaluations(
  passes: readonly WritingEvaluation[],
): WritingEvaluation | null {
  const [first, second] = passes;
  if (!first) return null;
  if (!second) return first;

  const lower = lowerLevel(first.estimatedLevel, second.estimatedLevel);
  const rangeStart = lowerLevel(first.levelRange[0], second.levelRange[0]);
  const rangeEnd =
    cefrRank(first.levelRange[1]) >= cefrRank(second.levelRange[1])
      ? first.levelRange[1]
      : second.levelRange[1];

  return {
    estimatedLevel: lower,
    levelRange: [rangeStart, rangeEnd],
    dimensions: {
      taskAchievement: average(first.dimensions.taskAchievement, second.dimensions.taskAchievement),
      coherence: average(first.dimensions.coherence, second.dimensions.coherence),
      range: average(first.dimensions.range, second.dimensions.range),
      accuracy: average(first.dimensions.accuracy, second.dimensions.accuracy),
      fluency: averageNullable(first.dimensions.fluency, second.dimensions.fluency),
    },
    strengths: first.strengths,
    priorities: first.priorities,
    errors: first.errors,
    confidence: Math.min(first.confidence, second.confidence),
  };
}

export function writingScore(evaluation: WritingEvaluation): number {
  const dimensions = evaluation.dimensions;
  return round(
    (dimensions.taskAchievement + dimensions.coherence + dimensions.range + dimensions.accuracy) /
      20,
  );
}

export function applyWritingToResult(
  result: PlacementResult,
  evaluation: WritingEvaluation,
  passCount: number,
): PlacementResult {
  const writingTheta = thetaFromCefr(evaluation.estimatedLevel);
  const writingSe = Math.max(0.15, 1 - evaluation.confidence);
  const objectiveSe = Math.max(0.15, 1 - result.confidence);
  const objectiveWeight = 0.55;
  const writingWeight = 0.15;
  const totalWeight = objectiveWeight + writingWeight;

  const overallTheta = result.overallLevel
    ? (result.overallTheta * objectiveWeight + writingTheta * writingWeight) / totalWeight
    : writingTheta;
  const overallSe = Math.max(
    0.15,
    Math.sqrt((objectiveWeight * objectiveSe) ** 2 + (writingWeight * writingSe) ** 2) /
      totalWeight,
  );
  const levelRange =
    cefrRank(evaluation.levelRange[0]) === cefrRank(evaluation.levelRange[1])
      ? evaluation.estimatedLevel
      : `${evaluation.levelRange[0]}/${evaluation.levelRange[1]}`;

  return {
    ...result,
    overallLevel: cefrFromTheta(overallTheta),
    overallRange: cefrRangeLabel(overallTheta - overallSe, overallTheta + overallSe),
    overallTheta: round(overallTheta),
    confidence: round(clamp(1 - overallSe, 0, 1)),
    unmeasured: result.unmeasured.filter((skill) => skill !== 'writing'),
    writing: {
      level: evaluation.estimatedLevel,
      range: levelRange,
      confidence: round(evaluation.confidence),
      theta: round(writingTheta),
      se: round(writingSe),
      score: writingScore(evaluation),
      nObs: passCount,
      strengths: evaluation.strengths,
      priorities: evaluation.priorities,
    },
  };
}
