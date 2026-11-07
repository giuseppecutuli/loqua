#!/usr/bin/env node
/**
 * Local backup/restore drill.
 *
 * Dumps the local Docker Postgres database with pg_dump, restores it into a
 * throwaway database, verifies a few row counts, then drops the throwaway
 * database. This exercises the same dump/restore path used by the VPS runbook.
 */
import { spawnSync } from 'node:child_process';

import pg from 'pg';

const containerName = 'loqua-postgres';
const port = 54329;
const baseUrl =
  process.env.DATABASE_URL ?? `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
const restoreDatabase = 'loqua_restore_drill';

if (!/(?:^|[/@])(?:127\.0\.0\.1|localhost)(?::|\/)/.test(baseUrl)) {
  console.error('refusing to run a backup drill on a non-local database');
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

const sourceUrl = new URL(baseUrl);
const restoreUrl = new URL(baseUrl);
restoreUrl.pathname = `/${restoreDatabase}`;

let client;
try {
  exec(['pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '-f', '/tmp/loqua-drill.dump']);
  exec(['dropdb', '-U', 'postgres', '--if-exists', restoreDatabase]);
  exec(['createdb', '-U', 'postgres', restoreDatabase]);
  exec(['pg_restore', '-U', 'postgres', '-d', restoreDatabase, '/tmp/loqua-drill.dump']);

  client = new pg.Client({ connectionString: restoreUrl.toString() });
  await client.connect();
  const source = new pg.Client({ connectionString: sourceUrl.toString() });
  await source.connect();
  try {
    for (const table of ['users', 'learner_profiles', 'items', 'media_titles']) {
      const expected = await source.query(`SELECT count(*)::int AS n FROM public.${table}`);
      const restored = await client.query(`SELECT count(*)::int AS n FROM public.${table}`);
      if (restored.rows[0].n !== expected.rows[0].n) {
        throw new Error(`${table}: source=${expected.rows[0].n} restored=${restored.rows[0].n}`);
      }
    }
    console.log(`backup drill: dump restored into ${restoreDatabase}, row counts match`);
  } finally {
    await source.end();
  }
} catch (error) {
  console.error(`backup drill failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => undefined);
  run('docker', [
    'exec',
    containerName,
    'dropdb',
    '-U',
    'postgres',
    '--if-exists',
    restoreDatabase,
  ]);
  run('docker', ['exec', containerName, 'rm', '-f', '/tmp/loqua-drill.dump']);
}
