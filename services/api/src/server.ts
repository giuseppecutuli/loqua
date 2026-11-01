import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import {
  createGateway,
  InMemoryCostSink,
  InMemoryDailyBudget,
  type AiProvider,
  type ProviderRequest,
  type ProviderResponse,
} from '@loqua/ai';

import { createApp } from './app.js';
import { createSupabaseJwksVerifier, createSupabaseJwtVerifier } from './auth.js';
import { InMemoryAccountRepository } from './repos/account.js';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch {
  // Environment variables may be injected by the host instead.
}

class UnconfiguredProvider implements AiProvider {
  readonly name = 'unconfigured';

  async complete(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new Error('No AI provider configured');
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const verifier = jwtSecret
  ? createSupabaseJwtVerifier(jwtSecret)
  : supabaseUrl
    ? createSupabaseJwksVerifier({ url: supabaseUrl })
    : null;

if (!verifier) {
  process.stderr.write('SUPABASE_URL or SUPABASE_JWT_SECRET is required\n');
  process.exit(1);
}

const budgetUsd = Number(process.env.AI_DAILY_BUDGET_USD ?? '0.50');
const gateway = createGateway({
  provider: new UnconfiguredProvider(),
  costSink: new InMemoryCostSink(),
  budget: new InMemoryDailyBudget(Number.isFinite(budgetUsd) ? budgetUsd : 0.5),
});

const app = createApp({
  ai: gateway,
  auth: verifier,
  account: new InMemoryAccountRepository(),
});

const port = Number(process.env.PORT ?? '8787');
serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`loqua api listening on http://127.0.0.1:${info.port}\n`);
});
