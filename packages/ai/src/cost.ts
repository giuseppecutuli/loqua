import type { BudgetGuard, CostLogEntry, CostSink, ModelTier } from './types.js';

const PRICING_PER_MILLION: Record<string, { readonly input: number; readonly output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'assemblyai-universal': { input: 0, output: 0 },
  'browser-speech': { input: 0, output: 0 },
};

export const MODEL_BY_TIER: Record<ModelTier, string> = {
  fast: 'gemini-2.5-flash-lite',
  balanced: 'gemini-2.5-flash',
  reason: 'gemini-2.5-pro',
  stt: 'assemblyai-universal',
  tts: 'browser-speech',
};

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICING_PER_MILLION[model];
  if (!price) return 0;
  const cost = (tokensIn / 1_000_000) * price.input + (tokensOut / 1_000_000) * price.output;
  return Number(cost.toFixed(8));
}

export class InMemoryCostSink implements CostSink {
  readonly entries: CostLogEntry[] = [];

  record(entry: CostLogEntry): void {
    this.entries.push(entry);
  }

  totalUsd(): number {
    return this.entries.reduce((total, entry) => total + entry.costUsd, 0);
  }
}

export class InMemoryDailyBudget implements BudgetGuard {
  private readonly spendByDay = new Map<string, number>();

  constructor(
    private readonly limitUsd: number,
    private readonly dayKey: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  canSpend(estimatedUsd: number): boolean {
    const current = this.spendByDay.get(this.dayKey()) ?? 0;
    return current + estimatedUsd <= this.limitUsd;
  }

  record(costUsd: number): void {
    const key = this.dayKey();
    this.spendByDay.set(key, (this.spendByDay.get(key) ?? 0) + costUsd);
  }
}
