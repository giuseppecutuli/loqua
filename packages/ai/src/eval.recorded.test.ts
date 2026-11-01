import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { InMemoryCostSink } from './cost.js';
import { createGateway } from './gateway.js';
import {
  correctionInputSchema,
  correctionOutputSchema,
  type CorrectionInput,
  type CorrectionOutput,
} from './prompts/correction.evaluate.js';
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

function loadFixture(): RecordedFixture {
  const file = path.resolve(here, '../fixtures/correction.evaluate.recorded.json');
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
