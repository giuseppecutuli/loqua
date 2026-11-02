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
if (!process.env.DATABASE_URL) {
  console.error('db ping: DATABASE_URL is not set');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('db ping: DATABASE_URL is not set');
  process.exit(1);
}

const parsed = new URL(databaseUrl);
const isLocal = /^(?:127\.0\.0\.1|localhost)$/.test(parsed.hostname);
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  const tables = await client.query(
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'",
  );
  const rlsTables = await client.query(
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true",
  );
  const authUsers = await client.query('SELECT count(*)::int AS n FROM auth.users');
  console.log(
    `db ping: host=${parsed.hostname} public_tables=${tables.rows[0].n} rls_tables=${rlsTables.rows[0].n} auth_users=${authUsers.rows[0].n}`,
  );
} finally {
  await client.end();
}
