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
  process.env.POWERSYNC_SETUP_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:54322/postgres';
const isLocal = /(?:^|[/@])(?:127\.0\.0\.1|localhost|host\.docker\.internal)(?::|\/)/.test(
  databaseUrl,
);
if (!isLocal && !process.argv.includes('--remote')) {
  console.error('refusing to configure PowerSync on a remote database without --remote');
  process.exit(1);
}

const password = process.env.POWERSYNC_DB_PASSWORD ?? 'powersync';
const tables = [
  'users',
  'devices',
  'learner_profiles',
  'consents',
  'settings',
  'sync_state',
  'sync_conflict_log',
  'backup_meta',
].join(', ');

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
await client.connect();

try {
  const literal = client.escapeLiteral(password);
  const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'powersync_role'");
  if ((exists.rowCount ?? 0) > 0) {
    await client.query(
      `ALTER ROLE powersync_role WITH LOGIN REPLICATION BYPASSRLS PASSWORD ${literal}`,
    );
  } else {
    await client.query(
      `CREATE ROLE powersync_role WITH LOGIN REPLICATION BYPASSRLS PASSWORD ${literal}`,
    );
  }

  await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role');
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role',
  );

  const publication = await client.query(
    "SELECT 1 FROM pg_publication WHERE pubname = 'powersync'",
  );
  if ((publication.rowCount ?? 0) > 0) {
    await client.query(`ALTER PUBLICATION powersync SET TABLE ${tables}`);
  } else {
    await client.query(`CREATE PUBLICATION powersync FOR TABLE ${tables}`);
  }

  const host = new URL(databaseUrl).host;
  console.log(`powersync: role and publication ready on ${host}`);
} finally {
  await client.end();
}
