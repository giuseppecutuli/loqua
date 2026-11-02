import { canonicalize, sha256Hex } from '@loqua/core';

import { estimateCostUsd, MODEL_BY_TIER } from './cost.js';
import { getPrompt, type RegisteredPrompt } from './registry.js';
import type {
  AiCache,
  AiMeta,
  AiProvider,
  AiRequest,
  AiResult,
  BudgetGuard,
  CostSink,
  ModelTier,
} from './types.js';

export type GatewayErrorCode =
  | 'unknown_prompt'
  | 'invalid_input'
  | 'budget_blocked'
  | 'provider_error'
  | 'schema_error';

export class AiGatewayError extends Error {
  constructor(
    readonly code: GatewayErrorCode,
    message: string,
    readonly meta?: AiMeta,
  ) {
    super(message);
    this.name = 'AiGatewayError';
  }
}

export interface GatewayOptions {
  readonly provider: AiProvider;
  readonly cache?: AiCache;
  readonly costSink?: CostSink;
  readonly budget?: BudgetGuard;
  readonly models?: Partial<Record<ModelTier, string>>;
  readonly now?: () => number;
}

export interface AiGateway {
  call<TInput, TOutput>(request: AiRequest<TInput, TOutput>): Promise<AiResult<TOutput>>;
}

export function createGateway(options: GatewayOptions): AiGateway {
  const now = options.now ?? (() => Date.now());

  return {
    async call<TInput, TOutput>(request: AiRequest<TInput, TOutput>): Promise<AiResult<TOutput>> {
      let prompt: RegisteredPrompt;
      try {
        prompt = getPrompt(request.promptId, request.promptVersion);
      } catch {
        throw new AiGatewayError(
          'unknown_prompt',
          `Unknown prompt ${request.promptId}@${request.promptVersion}`,
        );
      }

      let input: unknown;
      try {
        input = prompt.parseInput(request.input);
      } catch (error) {
        throw new AiGatewayError(
          'invalid_input',
          error instanceof Error ? error.message : 'Invalid prompt input',
        );
      }

      const model = options.models?.[request.tier] ?? MODEL_BY_TIER[request.tier];
      const user = prompt.renderUser(input);
      const cacheKey =
        request.cacheKey ??
        (await sha256Hex(
          canonicalize({ promptId: request.promptId, promptVersion: request.promptVersion, input }),
        ));

      const cached = await options.cache?.get(cacheKey);
      if (cached) {
        const parsed = request.schema.safeParse(cached.data);
        if (parsed.success) {
          return {
            data: parsed.data,
            meta: { ...cached.meta, cached: true, status: 'cached', costUsd: 0 },
          };
        }
      }

      const estimatedTokensIn = Math.ceil(user.length / 4);
      const estimatedUsd = estimateCostUsd(model, estimatedTokensIn, 400);
      if (options.budget && !(await options.budget.canSpend(estimatedUsd))) {
        const blockedMeta: AiMeta = {
          provider: options.provider.name,
          model,
          promptId: request.promptId,
          promptVersion: request.promptVersion,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          latencyMs: 0,
          cached: false,
          repairs: 0,
          status: 'budget_blocked',
        };
        await options.costSink?.record({
          ...blockedMeta,
          userId: request.userId ?? null,
          inputHash: cacheKey,
          tier: request.tier,
        });
        throw new AiGatewayError('budget_blocked', 'Daily AI budget exceeded', blockedMeta);
      }

      const maxRepairs = request.maxRepairs ?? 2;
      const attempts = maxRepairs + 1;
      const startedAt = now();
      let tokensIn = 0;
      let tokensOut = 0;
      let costUsd = 0;
      let previousError: string | undefined;
      let providerName = options.provider.name;
      let responseModel = model;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        let response;
        try {
          response = await options.provider.complete({
            system: prompt.systemPrompt,
            user,
            model,
            tier: request.tier,
            temperature: prompt.temperature,
            attempt,
            previousError,
            signal: request.signal,
          });
        } catch (error) {
          const meta: AiMeta = {
            provider: providerName,
            model: responseModel,
            promptId: request.promptId,
            promptVersion: request.promptVersion,
            tokensIn,
            tokensOut,
            costUsd,
            latencyMs: now() - startedAt,
            cached: false,
            repairs: attempt,
            status: 'provider_error',
          };
          await options.costSink?.record({
            ...meta,
            userId: request.userId ?? null,
            inputHash: cacheKey,
            tier: request.tier,
          });
          throw new AiGatewayError(
            'provider_error',
            error instanceof Error ? error.message : 'Provider failed',
            meta,
          );
        }

        providerName = response.provider;
        responseModel = response.model;
        tokensIn += response.tokensIn;
        tokensOut += response.tokensOut;
        costUsd += estimateCostUsd(response.model, response.tokensIn, response.tokensOut);

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(response.text);
        } catch {
          previousError = 'Response is not valid JSON';
          continue;
        }

        const parsed = request.schema.safeParse(parsedJson);
        if (!parsed.success) {
          previousError = parsed.error.issues
            .slice(0, 5)
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          continue;
        }

        const meta: AiMeta = {
          provider: providerName,
          model: responseModel,
          promptId: request.promptId,
          promptVersion: request.promptVersion,
          tokensIn,
          tokensOut,
          costUsd,
          latencyMs: now() - startedAt,
          cached: false,
          repairs: attempt,
          status: 'ok',
        };
        await options.budget?.record(costUsd);
        await options.costSink?.record({
          ...meta,
          userId: request.userId ?? null,
          inputHash: cacheKey,
          tier: request.tier,
        });
        await options.cache?.set(cacheKey, { data: parsed.data, meta });
        return { data: parsed.data, meta };
      }

      const failedMeta: AiMeta = {
        provider: providerName,
        model: responseModel,
        promptId: request.promptId,
        promptVersion: request.promptVersion,
        tokensIn,
        tokensOut,
        costUsd,
        latencyMs: now() - startedAt,
        cached: false,
        repairs: maxRepairs,
        status: 'schema_error',
      };
      await options.budget?.record(costUsd);
      await options.costSink?.record({
        ...failedMeta,
        userId: request.userId ?? null,
        inputHash: cacheKey,
        tier: request.tier,
      });
      throw new AiGatewayError(
        'schema_error',
        previousError ?? 'Model output did not match the schema',
        failedMeta,
      );
    },
  };
}
