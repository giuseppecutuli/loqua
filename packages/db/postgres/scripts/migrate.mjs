#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Optional env files.
  }
}

const migrationsDir = path.join(root, 'supabase', 'migrations');
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const isLocal = /(?:^|[/@])(?:127\.0\.0\.1|localhost)(?::|\/)/.test(databaseUrl);
if (!isLocal && !process.argv.includes('--remote')) {
  console.error('refusing to migrate a remote database without --remote');
  process.exit(1);
}

const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort((left, right) => left.localeCompare(right));

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._loqua_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await client.query('SELECT filename FROM public._loqua_migrations')).rows.map(
      (row) => row.filename,
    ),
  );

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO public._loqua_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      count += 1;
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(
        `migration ${file} failed: ${error instanceof Error ? error.message : error}`,
        { cause: error },
      );
    }
  }

  console.log(`migrations: ${count} applied, ${files.length - count} already present`);
} finally {
  await client.end();
}
