import {
  assessmentEvaluationSchema,
  type AiGateway,
  type AssessmentEvaluateInput,
  type AssessmentEvaluation,
} from '@loqua/ai';
import { RULES } from '@loqua/content';
import { mergeWritingEvaluations, type WritingEvaluation } from '@loqua/core';

export function sanitizeEvaluation(evaluation: AssessmentEvaluation, text: string): WritingEvaluation {
  return {
    ...evaluation,
    errors: evaluation.errors.filter(
      (error) =>
        text.includes(error.span) &&
        error.ruleId !== null &&
        RULES.some((rule) => rule.id === error.ruleId),
    ),
  };
}

export async function evaluateSubmission(
  ai: AiGateway,
  userId: string,
  input: AssessmentEvaluateInput,
  text: string,
): Promise<WritingEvaluation | null> {
  const [first, second] = await Promise.all([
    ai.call({
      promptId: 'assessment.evaluate',
      promptVersion: 1,
      tier: 'reason',
      input,
      schema: assessmentEvaluationSchema,
      userId,
      maxRepairs: 1,
    }),
    ai.call({
      promptId: 'assessment.evaluate',
      promptVersion: 1,
      tier: 'reason',
      input,
      schema: assessmentEvaluationSchema,
      userId,
      maxRepairs: 1,
    }),
  ]);
  return mergeWritingEvaluations([
    sanitizeEvaluation(first.data, text),
    sanitizeEvaluation(second.data, text),
  ]);
}
