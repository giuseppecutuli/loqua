import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import {
  AssemblyAiTranscriber,
  createGateway,
  DeepSeekProvider,
  InMemoryCostSink,
  InMemoryDailyBudget,
  type AiProvider,
  type ProviderRequest,
  type ProviderResponse,
} from '@loqua/ai';
import { StreamingTranscriber } from 'assemblyai';
import {
  PostgresAccountStore,
  PostgresAssessmentStore,
  PostgresMediaStore,
  PostgresNotificationStore,
  PostgresProductEventStore,
  PostgresSessionStore,
} from '@loqua/db-postgres';
import { Pool } from 'pg';
import { WebSocketServer } from 'ws';

import { createApp } from './app.js';
import { createSupabaseJwksVerifier, createSupabaseJwtVerifier } from './auth.js';
import type {
  StreamingTranscriberLike,
  StreamingTurnEvent,
} from './services/conversation/streaming.js';

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
const media = new PostgresMediaStore(pool);
const notifications = new PostgresNotificationStore(pool);
const events = new PostgresProductEventStore(pool);

const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
const transcriber = assemblyKey
  ? new AssemblyAiTranscriber({ apiKey: assemblyKey })
  : null;

const streamSecret = process.env.STREAM_TICKET_SECRET;
const createStreamingTranscriber:
  | ((opts: { languageCode: string; sampleRate: number }) => StreamingTranscriberLike)
  | undefined = assemblyKey
  ? (opts) => {
      const streaming = new StreamingTranscriber({
        apiKey: assemblyKey,
        sampleRate: opts.sampleRate,
        encoding: 'pcm_s16le',
        languageCode: opts.languageCode,
        formatTurns: true,
        vadThreshold: 0.4,
        minTurnSilence: 700,
        maxTurnSilence: 2_000,
      });

      function on(
        event: 'turn',
        listener: (event: StreamingTurnEvent) => void,
      ): void;
      function on(event: 'error', listener: (error: Error) => void): void;
      function on(
        ...args:
          | ['turn', (event: StreamingTurnEvent) => void]
          | ['error', (error: Error) => void]
      ): void {
        const [event, listener] = args;
        if (event === 'turn') {
          streaming.on('turn', (turn) => {
            listener(turn);
          });
        } else {
          streaming.on('error', (error) => {
            listener(error);
          });
        }
      }

      return {
        connect: () => streaming.connect().then(() => undefined),
        sendAudio: (audio) => {
          const buffer = audio.buffer.slice(
            audio.byteOffset,
            audio.byteOffset + audio.byteLength,
          );
          streaming.sendAudio(buffer);
        },
        on,
        close: (waitForSessionTermination) =>
          streaming.close(waitForSessionTermination),
      };
    }
  : undefined;

const webSocketServer = new WebSocketServer({ noServer: true });

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

const configuredOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:8081,http://127.0.0.1:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localOrigins =
  process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost', 'http://127.0.0.1', 'http://localhost:8081', 'http://127.0.0.1:8081'];
const corsOrigins = [...new Set([...configuredOrigins, ...localOrigins])];

const app = createApp({
  ai: gateway,
  auth: verifier,
  account,
  assessments,
  sessions,
  media,
  notifications,
  events,
  ...(transcriber
    ? {
        transcribe: (audio: Uint8Array, languageCode?: string) =>
          transcriber.transcribe({ audio, languageCode }),
      }
    : {}),
  ...(streamSecret ? { streamSecret } : {}),
  ...(createStreamingTranscriber ? { createStreamingTranscriber } : {}),
  corsOrigins,
});

const port = Number(process.env.PORT ?? '8787');
serve({ fetch: app.fetch, port, websocket: { server: webSocketServer } }, (info) => {
  process.stdout.write(`loqua api listening on http://127.0.0.1:${info.port}\n`);
});

process.on('SIGINT', () => {
  void pool.end().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void pool.end().finally(() => process.exit(0));
});
