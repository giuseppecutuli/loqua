import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import {
  createGateway,
  DeepSeekProvider,
  InMemoryCostSink,
  InMemoryDailyBudget,
  type AiProvider,
  type ProviderRequest,
  type ProviderResponse,
} from '@loqua/ai';
import {
  PostgresAccountStore,
  PostgresAssessmentStore,
  PostgresSessionStore,
} from '@loqua/db-postgres';
import { Pool } from 'pg';

import { createApp } from './app.js';
import { createSupabaseJwksVerifier, createSupabaseJwtVerifier } from './auth.js';

for (const file of ['../../../.env.local', '../../../.env']) {
  try {
    process.loadEnvFile(fileURLToPath(new URL(file, import.meta.url)));
  } catch {
    // Environment variables may be injected by the host instead.
  }
}

class UnconfiguredProvider implements AiProvider {
  readonly name = 'unconfigured';

  async complete(_request: ProviderRequest): Promise<ProviderResponse> {
    throw new Error('No AI provider configured');
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const verifier = supabaseUrl
  ? createSupabaseJwksVerifier({
      url: supabaseUrl,
      jwksUrl: process.env.SUPABASE_JWKS_URL,
    })
  : jwtSecret
    ? createSupabaseJwtVerifier(jwtSecret)
    : null;

if (!verifier) {
  process.stderr.write('SUPABASE_URL or SUPABASE_JWT_SECRET is required\n');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(1);
}

const isLocalDatabase = /(?:^|[/@])(?:127\.0\.0\.1|localhost|host\.docker\.internal)(?::|\/)/.test(
  databaseUrl,
);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDatabase ? undefined : { rejectUnauthorized: false },
});
const account = new PostgresAccountStore(pool);
const assessments = new PostgresAssessmentStore(pool);
const sessions = new PostgresSessionStore(pool);

const deepSeekKey = process.env.DEEPSEEK_API_KEY;
const provider = deepSeekKey
  ? new DeepSeekProvider({
      apiKey: deepSeekKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL,
      model: process.env.DEEPSEEK_MODEL,
    })
  : new UnconfiguredProvider();

const budgetUsd = Number(process.env.AI_DAILY_BUDGET_USD ?? '0.50');
const gateway = createGateway({
  provider,
  costSink: new InMemoryCostSink(),
  budget: new InMemoryDailyBudget(Number.isFinite(budgetUsd) ? budgetUsd : 0.5),
});

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:8081,http://127.0.0.1:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = createApp({
  ai: gateway,
  auth: verifier,
  account,
  assessments,
  sessions,
  corsOrigins,
});

const port = Number(process.env.PORT ?? '8787');
serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`loqua api listening on http://127.0.0.1:${info.port}\n`);
});

process.on('SIGINT', () => {
  void pool.end().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void pool.end().finally(() => process.exit(0));
});
