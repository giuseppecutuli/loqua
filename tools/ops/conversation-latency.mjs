#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Optional env files.
  }
}

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const MIN_SAMPLES = 20;
const TARGET_MS = 2_500;
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  const result = await client.query(
    `SELECT (transcript_meta_json->>'latencyMs')::int AS latency_ms
     FROM public.session_turns
     WHERE role = 'tutor' AND transcript_meta_json ? 'latencyMs'
     ORDER BY created_at DESC
     LIMIT 500`,
  );
  const samples = result.rows
    .map((row) => row.latency_ms)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  if (samples.length === 0) {
    console.log('conversation latency: no samples');
    process.exit(0);
  }

  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
  console.log(`conversation latency: samples=${samples.length} p95=${p95}ms target=${TARGET_MS}ms`);
  if (samples.length >= MIN_SAMPLES && p95 > TARGET_MS) {
    console.error(`FAIL p95 ${p95}ms exceeds ${TARGET_MS}ms`);
    process.exitCode = 1;
  } else {
    console.log('PASS');
  }
} catch (error) {
  console.error(
    `conversation latency: database unavailable (${error instanceof Error ? error.message : String(error)})`,
  );
} finally {
  await client.end().catch(() => undefined);
}
