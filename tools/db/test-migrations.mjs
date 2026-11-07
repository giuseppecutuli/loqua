#!/usr/bin/env node
/**
 * Migration compatibility check.
 *
 * Creates a throwaway local database, applies every migration except the newest,
 * inserts a small fixture at the old schema version, then applies the newest
 * migration and verifies the fixture survived. The main database is untouched.
 * Uses the same local Docker Postgres as `pnpm supabase:reset` (port 54329) and
 * refuses to run against a non-local database.
 */
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const containerName = 'loqua-postgres';
const port = 54329;
const databaseUrl =
  process.env.DATABASE_URL ?? `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
const testDatabase = 'loqua_migration_test';

if (!/(?:^|[/@])(?:127\.0\.0\.1|localhost)(?::|\/)/.test(databaseUrl)) {
  console.error('refusing to run a migration test on a non-local database');
  process.exit(1);
}

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', shell: false });
}

function exec(args) {
  const result = run('docker', ['exec', containerName, ...args]);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${args.join(' ')} failed`);
  }
  return result.stdout;
}

function ensureContainer() {
  const inspect = run('docker', ['inspect', '-f', '{{.State.Running}}', containerName]);
  if (inspect.status === 0) {
    if (inspect.stdout.trim() !== 'true') {
      const started = run('docker', ['start', containerName]);
      if (started.status !== 0) throw new Error(started.stderr || 'docker start failed');
    }
    return;
  }
  throw new Error(`container ${containerName} is not available; run pnpm supabase:reset first`);
}

ensureContainer();

const testUrl = new URL(databaseUrl);
testUrl.pathname = `/${testDatabase}`;
let client;

try {
  exec(['dropdb', '-U', 'postgres', '--if-exists', testDatabase]);
  exec(['createdb', '-U', 'postgres', testDatabase]);

  client = new pg.Client({ connectionString: testUrl.toString() });
  await client.connect();
  await client.query((await readFile(path.join(here, 'bootstrap.sql'), 'utf8')).toString());

  const migrationsDir = path.join(root, 'supabase', 'migrations');
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
  if (files.length < 2) throw new Error('not enough migrations to test a previous version');

  const previous = files.slice(0, -1);
  const latest = files[files.length - 1];
  for (const file of previous) {
    const sql = (await readFile(path.join(migrationsDir, file), 'utf8')).toString();
    await client.query(sql);
  }

  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO public.users (id, ui_locale, created_at, updated_at)
     VALUES ('00000000-0000-7000-8000-000000000001', 'it', $1, $1)`,
    [now],
  );

  await client.query((await readFile(path.join(migrationsDir, latest), 'utf8')).toString());

  const survived = await client.query(
    `SELECT id, ui_locale FROM public.users WHERE id = '00000000-0000-7000-8000-000000000001'`,
  );
  if (survived.rowCount !== 1) {
    throw new Error(`fixture lost after applying ${latest}`);
  }

  console.log(
    `migration test: ${previous.length} previous + ${latest} applied in ${testDatabase}, fixture preserved`,
  );
} catch (error) {
  console.error(`migration test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => undefined);
  run('docker', ['exec', containerName, 'dropdb', '-U', 'postgres', '--if-exists', testDatabase]);
}
