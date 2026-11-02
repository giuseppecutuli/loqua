import { z } from 'zod';

import type { PlacementResult } from './assessment.js';
import { cefrLevelSchema } from './schemas.js';
import { cefrFromTheta, cefrRangeLabel, thetaFromCefr, cefrRank } from './skills.js';
import type { WritingEvaluation } from './writing.js';

export const speakingTaskSchema = z.object({
  id: z.string().min(1),
  targetLang: z.string().min(2),
  skillId: z.string().min(1),
  prompt: z.string().min(1).max(1000),
  cefrTarget: cefrLevelSchema,
  minSeconds: z.number().int().positive(),
  maxSeconds: z.number().int().positive(),
});

export type SpeakingTask = z.infer<typeof speakingTaskSchema>;

export const speakingResultSchema = z.object({
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

export type SpeakingResult = z.infer<typeof speakingResultSchema>;

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function evaluationScore(evaluation: WritingEvaluation): number {
  const dimensions = evaluation.dimensions;
  return round(
    (dimensions.taskAchievement + dimensions.coherence + dimensions.range + dimensions.accuracy) /
      20,
  );
}

export function applySpeakingToResult(
  result: PlacementResult,
  evaluation: WritingEvaluation,
  passCount: number,
): PlacementResult {
  const objectiveTheta = result.objectiveTheta ?? result.overallTheta;
  const objectiveSe = result.objectiveSe ?? Math.max(0.15, 1 - result.confidence);
  const speakingTheta = thetaFromCefr(evaluation.estimatedLevel);
  const speakingSe = Math.max(0.15, 1 - evaluation.confidence);
  const writingTheta = result.writing ? thetaFromCefr(result.writing.level) : null;
  const writingSe = result.writing?.se ?? 0;

  const objectiveWeight = 0.55;
  const writingWeight = result.writing ? 0.15 : 0;
  const speakingWeight = 0.3;
  const totalWeight = objectiveWeight + writingWeight + speakingWeight;
  const overallTheta =
    (objectiveTheta * objectiveWeight +
      (writingTheta ?? 0) * writingWeight +
      speakingTheta * speakingWeight) /
    totalWeight;
  const overallSe = Math.max(
    0.15,
    Math.sqrt(
      (objectiveWeight * objectiveSe) ** 2 +
        (writingWeight * writingSe) ** 2 +
        (speakingWeight * speakingSe) ** 2,
    ) / totalWeight,
  );
  const levelRange =
    cefrRank(evaluation.levelRange[0]) === cefrRank(evaluation.levelRange[1])
      ? evaluation.estimatedLevel
      : `${evaluation.levelRange[0]}/${evaluation.levelRange[1]}`;

  return {
    ...result,
    objectiveTheta: round(objectiveTheta),
    objectiveSe: round(objectiveSe),
    overallLevel: cefrFromTheta(overallTheta),
    overallRange: cefrRangeLabel(overallTheta - overallSe, overallTheta + overallSe),
    overallTheta: round(overallTheta),
    confidence: round(clamp(1 - overallSe, 0, 1)),
    unmeasured: result.unmeasured.filter((skill) => skill !== 'speaking'),
    speaking: {
      level: evaluation.estimatedLevel,
      range: levelRange,
      confidence: round(evaluation.confidence),
      theta: round(speakingTheta),
      se: round(speakingSe),
      score: evaluationScore(evaluation),
      nObs: passCount,
      strengths: evaluation.strengths,
      priorities: evaluation.priorities,
    },
  };
}
