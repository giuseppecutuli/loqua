import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { InMemoryCostSink } from './cost.js';
import { createGateway } from './gateway.js';
import {
  assessmentEvaluateInputSchema,
  assessmentEvaluationSchema,
  type AssessmentEvaluateInput,
  type AssessmentEvaluation,
} from './prompts/assessment.evaluate.js';
import {
  correctionInputSchema,
  correctionOutputSchema,
  type CorrectionInput,
  type CorrectionOutput,
} from './prompts/correction.evaluate.js';
import {
  conversationTurnInputSchema,
  conversationTurnOutputSchema,
  type ConversationTurnInput,
  type ConversationTurnOutput,
} from './prompts/conversation.turn.js';
import type { AiProvider, ProviderRequest, ProviderResponse } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

interface RecordedFixture {
  readonly promptId: string;
  readonly promptVersion: number;
  readonly input: unknown;
  readonly responses: readonly {
    readonly text: string;
    readonly tokensIn: number;
    readonly tokensOut: number;
  }[];
}

function loadFixture(name = 'correction.evaluate.recorded.json'): RecordedFixture {
  const file = path.resolve(here, `../fixtures/${name}`);
  return JSON.parse(readFileSync(file, 'utf8')) as RecordedFixture;
}

class RecordedProvider implements AiProvider {
  readonly name = 'recorded';

  constructor(private readonly fixture: RecordedFixture) {}

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const response = this.fixture.responses[request.attempt] ?? this.fixture.responses[0];
    if (!response) throw new Error('recorded fixture has no responses');
    return {
      text: response.text,
      provider: 'recorded',
      model: request.model,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
    };
  }
}

describe('recorded eval: correction.evaluate', () => {
  it('passes the golden output through schema validation', async () => {
    const fixture = loadFixture();
    const input: CorrectionInput = correctionInputSchema.parse(fixture.input);
    const costs = new InMemoryCostSink();
    const gateway = createGateway({ provider: new RecordedProvider(fixture), costSink: costs });

    const result = await gateway.call<CorrectionInput, CorrectionOutput>({
      promptId: fixture.promptId,
      promptVersion: fixture.promptVersion,
      tier: 'fast',
      input,
      schema: correctionOutputSchema,
    });

    expect(result.data.corrections.length).toBeGreaterThan(0);
    for (const correction of result.data.corrections) {
      expect(correction.confidence).toBeGreaterThanOrEqual(0.7);
      expect(correction.ruleId).toMatch(/^[a-z]{2,3}\./);
      expect(result.data.corrections.some((entry) => entry.span.length > 0)).toBe(true);
    }
    expect(result.meta.repairs).toBe(0);
    expect(costs.entries).toHaveLength(1);
  });
});

describe('recorded eval: assessment.evaluate', () => {
  it('validates a writing rubric response with exact spans', async () => {
    const fixture = loadFixture('assessment.evaluate.recorded.json');
    const input: AssessmentEvaluateInput = assessmentEvaluateInputSchema.parse(fixture.input);
    const costs = new InMemoryCostSink();
    const gateway = createGateway({ provider: new RecordedProvider(fixture), costSink: costs });

    const result = await gateway.call<AssessmentEvaluateInput, AssessmentEvaluation>({
      promptId: fixture.promptId,
      promptVersion: fixture.promptVersion,
      tier: 'reason',
      input,
      schema: assessmentEvaluationSchema,
    });

    expect(result.data.estimatedLevel).toMatch(/^[ABC][12]$/);
    expect(result.data.dimensions.fluency).toBeNull();
    for (const error of result.data.errors) {
      expect(input.responseText).toContain(error.span);
      expect(error.ruleId === null || input.ruleIds.includes(error.ruleId)).toBe(true);
    }
    expect(costs.entries).toHaveLength(1);
  });
});

describe('recorded eval: conversation.turn', () => {
  it('validates a tutor reply with an optional hint', async () => {
    const fixture = loadFixture('conversation.turn.recorded.json');
    const input: ConversationTurnInput = conversationTurnInputSchema.parse(fixture.input);
    const costs = new InMemoryCostSink();
    const gateway = createGateway({ provider: new RecordedProvider(fixture), costSink: costs });

    const result = await gateway.call<ConversationTurnInput, ConversationTurnOutput>({
      promptId: fixture.promptId,
      promptVersion: fixture.promptVersion,
      tier: 'fast',
      input,
      schema: conversationTurnOutputSchema,
    });

    expect(result.data.reply.length).toBeGreaterThan(0);
    expect(result.data.hint === undefined || result.data.hint.length > 0).toBe(true);
    expect(result.meta.repairs).toBe(0);
    expect(costs.entries).toHaveLength(1);

    expect(conversationTurnOutputSchema.safeParse({ reply: 'Sure, tell me more.' }).success).toBe(
      true,
    );
    expect(conversationTurnOutputSchema.safeParse({ reply: '' }).success).toBe(false);
  });
});
