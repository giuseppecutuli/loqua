#!/usr/bin/env node
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

if (!/(?:^|[/@])(?:127\.0\.0\.1|localhost)(?::|\/)/.test(databaseUrl)) {
  console.error('refusing to reset a non-local database');
  process.exit(1);
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });
}

function ensureContainer() {
  const inspect = run('docker', ['inspect', '-f', '{{.State.Running}}', containerName]);
  if (inspect.status === 0) {
    if (inspect.stdout.trim() !== 'true') {
      const started = run('docker', ['start', containerName]);
      if (started.status !== 0) throw new Error(started.stderr || 'docker start failed');
    }
    return 'existing';
  }

  const created = run('docker', [
    'run',
    '-d',
    '--name',
    containerName,
    '-e',
    'POSTGRES_PASSWORD=postgres',
    '-e',
    'POSTGRES_DB=postgres',
    '-p',
    `127.0.0.1:${port}:5432`,
    'postgres:18-alpine',
  ]);
  if (created.status !== 0) throw new Error(created.stderr || 'docker run failed');
  return 'started';
}

async function connect() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const client = new pg.Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(
    `could not connect to postgres: ${lastError instanceof Error ? lastError.message : lastError}`,
  );
}

const status = ensureContainer();
const client = await connect();

try {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO postgres');
  await client.query((await readFile(path.join(here, 'bootstrap.sql'), 'utf8')).toString());
  await client.query('TRUNCATE auth.users CASCADE');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._loqua_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.join(root, 'supabase', 'migrations');
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const sql = (await readFile(path.join(migrationsDir, file), 'utf8')).toString();
    try {
      await client.query(sql);
      await client.query('INSERT INTO public._loqua_migrations (filename) VALUES ($1)', [file]);
    } catch (error) {
      throw new Error(`${file} failed: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }

  const seedPath = path.join(root, 'supabase', 'seed', 'seed.sql');
  try {
    await client.query((await readFile(seedPath, 'utf8')).toString());
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      // Seed is optional.
    } else {
      throw error;
    }
  }

  console.log(`supabase reset: ${status} container, ${files.length} migrations applied`);
} finally {
  await client.end();
}
