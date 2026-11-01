import type { ZodType } from 'zod';

export type ModelTier = 'fast' | 'balanced' | 'reason' | 'stt' | 'tts';

export interface AiMeta {
  readonly provider: string;
  readonly model: string;
  readonly promptId: string;
  readonly promptVersion: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly costUsd: number;
  readonly latencyMs: number;
  readonly cached: boolean;
  readonly repairs: number;
  readonly status: 'ok' | 'cached' | 'schema_error' | 'provider_error' | 'budget_blocked';
}

export interface OutputIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export type OutputParseResult<TOutput> =
  | { readonly success: true; readonly data: TOutput }
  | { readonly success: false; readonly error: { readonly issues: readonly OutputIssue[] } };

export interface OutputParser<TOutput> {
  safeParse(value: unknown): OutputParseResult<TOutput>;
}

export interface AiRequest<TInput, TOutput> {
  readonly promptId: string;
  readonly promptVersion: number;
  readonly tier: ModelTier;
  readonly input: TInput;
  readonly schema: OutputParser<TOutput>;
  readonly cacheKey?: string;
  readonly maxRepairs?: number;
  readonly signal?: AbortSignal;
  readonly userId?: string;
}

export interface AiResult<TOutput> {
  readonly data: TOutput;
  readonly meta: AiMeta;
}

export interface PromptMessages {
  readonly system: string;
  readonly user: string;
}

export interface PromptSpec<TInput, TOutput> {
  readonly id: string;
  readonly version: number;
  readonly modelTier: ModelTier;
  readonly temperature: number;
  readonly inputSchema: ZodType<TInput>;
  readonly outputSchema: ZodType<TOutput>;
  readonly systemPrompt: string;
  readonly renderUser: (input: TInput) => string;
}

export interface ProviderRequest {
  readonly system: string;
  readonly user: string;
  readonly model: string;
  readonly tier: ModelTier;
  readonly temperature: number;
  readonly attempt: number;
  readonly previousError?: string;
  readonly signal?: AbortSignal;
}

export interface ProviderResponse {
  readonly text: string;
  readonly provider: string;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly requestId?: string;
}

export interface AiProvider {
  readonly name: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface CacheEntry {
  readonly data: unknown;
  readonly meta: AiMeta;
}

export interface AiCache {
  get(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  set(key: string, entry: CacheEntry): Promise<void> | void;
}

export interface CostLogEntry extends AiMeta {
  readonly userId: string | null;
  readonly inputHash: string;
  readonly tier: ModelTier;
}

export interface CostSink {
  record(entry: CostLogEntry): Promise<void> | void;
}

export interface BudgetGuard {
  canSpend(estimatedUsd: number): Promise<boolean> | boolean;
  record(costUsd: number): Promise<void> | void;
}
