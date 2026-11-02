import { describe, expect, it } from 'vitest';

import { InMemoryCache } from './cache.js';
import { InMemoryCostSink, InMemoryDailyBudget } from './cost.js';
import { AiGatewayError, createGateway } from './gateway.js';
import {
  correctionEvaluatePrompt,
  correctionOutputSchema,
  type CorrectionOutput,
} from './prompts/correction.evaluate.js';
import type { AiProvider, ProviderRequest, ProviderResponse } from './types.js';

const input = {
  targetLang: 'en',
  nativeLang: 'it',
  explanationMode: 'target_simple' as const,
  proficiencyFramework: 'CEFR',
  cefrLevel: 'B1' as const,
  learnerText: 'I have went to the store yesterday.',
};

const validOutput = {
  corrections: [
    {
      span: 'have went',
      errorType: 'tense',
      ruleId: 'en.gram.tense.present_perfect',
      severity: 'medium' as const,
      confidence: 0.95,
      explanation: 'Use the simple past with a finished time.',
    },
  ],
};

class ScriptedProvider implements AiProvider {
  readonly name = 'scripted';
  readonly requests: ProviderRequest[] = [];
  private index = 0;

  constructor(private readonly texts: readonly string[]) {}

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    this.requests.push(request);
    const text = this.texts[Math.min(this.index, this.texts.length - 1)] ?? '{}';
    this.index += 1;
    return {
      text,
      provider: 'scripted',
      model: request.model,
      tokensIn: 100,
      tokensOut: 40,
    };
  }
}

function createTestGateway(provider: AiProvider, options: { budget?: InMemoryDailyBudget } = {}) {
  const cache = new InMemoryCache();
  const costs = new InMemoryCostSink();
  const gateway = createGateway({
    provider,
    cache,
    costSink: costs,
    budget: options.budget,
    now: () => 1000,
  });
  return { gateway, cache, costs };
}

describe('AI gateway', () => {
  it('validates output and logs cost', async () => {
    const provider = new ScriptedProvider([JSON.stringify(validOutput)]);
    const { gateway, costs } = createTestGateway(provider);

    const result = await gateway.call({
      promptId: 'correction.evaluate',
      promptVersion: 2,
      tier: 'fast',
      input,
      schema: correctionOutputSchema,
      userId: 'user-1',
    });

    expect(result.data.corrections).toHaveLength(1);
    expect(result.meta.repairs).toBe(0);
    expect(result.meta.costUsd).toBeGreaterThan(0);
    expect(costs.entries).toHaveLength(1);
    expect(costs.entries[0]?.userId).toBe('user-1');
  });

  it('repairs invalid output at most twice', async () => {
    const provider = new ScriptedProvider([
      '{"corrections":[{"span":"have went"}]}',
      JSON.stringify(validOutput),
    ]);
    const { gateway, costs } = createTestGateway(provider);

    const result = await gateway.call({
      promptId: 'correction.evaluate',
      promptVersion: 2,
      tier: 'fast',
      input,
      schema: correctionOutputSchema,
    });

    expect(result.meta.repairs).toBe(1);
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.previousError).toContain('ruleId');
    expect(costs.entries[0]?.status).toBe('ok');
  });

  it('fails after two repairs', async () => {
    const provider = new ScriptedProvider(['{}', '{}', '{}']);
    const { gateway } = createTestGateway(provider);

    await expect(
      gateway.call({
        promptId: 'correction.evaluate',
        promptVersion: 2,
        tier: 'fast',
        input,
        schema: correctionOutputSchema,
      }),
    ).rejects.toBeInstanceOf(AiGatewayError);

    expect(provider.requests).toHaveLength(3);
  });

  it('blocks when the daily budget is exhausted', async () => {
    const provider = new ScriptedProvider([JSON.stringify(validOutput)]);
    const budget = new InMemoryDailyBudget(0);
    const { gateway, costs } = createTestGateway(provider, { budget });

    await expect(
      gateway.call({
        promptId: 'correction.evaluate',
        promptVersion: 2,
        tier: 'fast',
        input,
        schema: correctionOutputSchema,
      }),
    ).rejects.toMatchObject({ code: 'budget_blocked' });

    expect(costs.entries[0]?.status).toBe('budget_blocked');
  });

  it('serves cache hits without calling the provider again', async () => {
    const provider = new ScriptedProvider([JSON.stringify(validOutput)]);
    const { gateway } = createTestGateway(provider);
    const request = {
      promptId: 'correction.evaluate',
      promptVersion: 2,
      tier: 'fast' as const,
      input,
      schema: correctionOutputSchema,
    };

    const first = await gateway.call(request);
    const second = await gateway.call(request);

    expect(first.meta.cached).toBe(false);
    expect(second.meta.cached).toBe(true);
    expect(second.meta.costUsd).toBe(0);
    expect(provider.requests).toHaveLength(1);
  });

  it('keeps learner text delimited and treats it as data', () => {
    const rendered = correctionEvaluatePrompt.renderUser(input);
    expect(rendered).toContain('<learner_text>');
    expect(rendered).toContain('</learner_text>');
    expect(correctionEvaluatePrompt.systemPrompt).toContain('untrusted data');
    expect(correctionEvaluatePrompt.systemPrompt.toLowerCase()).not.toContain('english');
  });

  it('rejects corrections without a valid namespaced rule id', () => {
    const parsed = correctionOutputSchema.safeParse({
      corrections: [{ ...validOutput.corrections[0], ruleId: 'bad-rule' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('narrows the output type', () => {
    const output: CorrectionOutput = validOutput;
    expect(output.corrections[0]?.ruleId.startsWith('en.')).toBe(true);
  });
});

