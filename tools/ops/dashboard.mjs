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
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  const events = await client.query(
    `SELECT name, count(*)::int AS n
     FROM public.product_events
     WHERE occurred_at >= now() - interval '7 days'
     GROUP BY name ORDER BY n DESC LIMIT 20`,
  );
  const media = await client.query(
    `SELECT status, count(*)::int AS n
     FROM public.recommendations
     WHERE created_at >= now() - interval '30 days'
     GROUP BY status ORDER BY status`,
  );
  const xp = await client.query(
    `SELECT COALESCE(sum(amount), 0)::int AS xp,
            count(DISTINCT user_id)::int AS users
     FROM public.xp_events
     WHERE created_at >= now() - interval '7 days'`,
  );
  const conversations = await client.query(
    `SELECT count(*)::int AS sessions,
            COALESCE(sum(cost_usd), 0)::float AS cost_usd,
            COALESCE(avg(cost_usd), 0)::float AS avg_cost_usd
     FROM public.sessions
     WHERE kind = 'conversation' AND created_at >= now() - interval '7 days'`,
  );
  const latency = await client.query(
    `SELECT (transcript_meta_json->>'latencyMs')::int AS latency_ms
     FROM public.session_turns
     WHERE role = 'tutor' AND transcript_meta_json ? 'latencyMs'
     ORDER BY created_at DESC LIMIT 500`,
  );
  const notifications = await client.query(
    `SELECT count(*)::int AS sent
     FROM public.product_events
     WHERE name = 'notification_sent' AND occurred_at >= now() - interval '7 days'`,
  );

  const latencySamples = latency.rows
    .map((row) => row.latency_ms)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  const p95 =
    latencySamples.length === 0
      ? null
      : latencySamples[
          Math.min(latencySamples.length - 1, Math.floor(latencySamples.length * 0.95))
        ];

  console.log('loqua dashboard: last 7 days');
  console.log('--- events ---');
  for (const row of events.rows) console.log(`${row.name}: ${row.n}`);
  console.log('--- media funnel (30d) ---');
  for (const row of media.rows) console.log(`${row.status}: ${row.n}`);
  console.log('--- engagement ---');
  console.log(`xp: ${xp.rows[0]?.xp ?? 0}`);
  console.log(`active users: ${xp.rows[0]?.users ?? 0}`);
  console.log('--- conversation ---');
  console.log(`sessions: ${conversations.rows[0]?.sessions ?? 0}`);
  console.log(`cost_usd: ${Number(conversations.rows[0]?.cost_usd ?? 0).toFixed(4)}`);
  console.log(`avg_cost_usd: ${Number(conversations.rows[0]?.avg_cost_usd ?? 0).toFixed(4)}`);
  console.log(`latency samples: ${latencySamples.length}`);
  console.log(`latency p95: ${p95 === null ? 'n/a' : `${p95}ms`}`);
  console.log('--- notifications ---');
  console.log(`sent: ${notifications.rows[0]?.sent ?? 0}`);
} catch (error) {
  console.error(
    `dashboard: database unavailable (${error instanceof Error ? error.message : String(error)})`,
  );
} finally {
  await client.end().catch(() => undefined);
}
