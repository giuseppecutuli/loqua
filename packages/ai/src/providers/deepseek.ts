import { z } from 'zod';

import type { AiProvider, ModelTier, ProviderRequest, ProviderResponse } from '../types.js';

const deepSeekResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
  error: z
    .object({
      message: z.string(),
      type: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
});

export interface DeepSeekProviderOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

function modelForTier(tier: ModelTier, override?: string): string {
  if (override) return override;
  if (tier === 'reason') return 'deepseek-reasoner';
  return 'deepseek-chat';
}

export class DeepSeekProvider implements AiProvider {
  readonly name = 'deepseek';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: DeepSeekProviderOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.deepseek.com').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const model = modelForTier(request.tier, this.options.model);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = request.signal ?? controller.signal;

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          temperature: request.temperature,
          stream: false,
          ...(model === 'deepseek-chat'
            ? { response_format: { type: 'json_object' } }
            : {}),
        }),
        signal,
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new Error('DeepSeek returned invalid JSON', { cause: error });
      }

      const parsed = deepSeekResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(
          `DeepSeek response shape invalid: ${parsed.error.issues
            .slice(0, 3)
            .map((issue) => issue.message)
            .join('; ')}`,
        );
      }

      if (parsed.data.error) {
        throw new Error(`DeepSeek error: ${parsed.data.error.message}`);
      }

      const choice = parsed.data.choices[0];
      if (!choice) throw new Error('DeepSeek returned no choices');

      return {
        text: choice.message.content,
        provider: this.name,
        model: parsed.data.model ?? model,
        tokensIn: parsed.data.usage?.prompt_tokens ?? 0,
        tokensOut: parsed.data.usage?.completion_tokens ?? 0,
        requestId: parsed.data.id,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('DeepSeek request timed out', { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
