#!/usr/bin/env node
import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const failures = [];

function check(name, condition) {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL ${name}`);
  }
}

async function asUser(userId) {
  await client.query('RESET ROLE');
  await client.query('SET ROLE authenticated');
  await client.query('SELECT set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
}

try {
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO auth.users (id, email) VALUES ($1, 'a@example.test'), ($2, 'b@example.test')
     ON CONFLICT (id) DO NOTHING`,
    [userA, userB],
  );

  await asUser(userA);
  await client.query(
    `INSERT INTO learner_profiles
       (id, user_id, target_lang, native_lang, goal, timezone, interests_json, onboarding_completed, created_at, updated_at)
     VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $1, 'en', 'it', 'work', 'Europe/Rome', '["work"]', true, now(), now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO devices (id, user_id, platform, name, created_at, updated_at)
     VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', $1, 'web', 'Browser A', now(), now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO consents (id, user_id, kind, version, granted_at, created_at)
     VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1, 'terms', '1', now(), now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO settings (user_id, created_at, updated_at) VALUES ($1, now(), now())`,
    [userA],
  );
  const ownProfiles = await client.query('SELECT count(*)::int AS n FROM learner_profiles');
  check('user A reads own profile', ownProfiles.rows[0].n === 1);

  await asUser(userB);
  const otherProfiles = await client.query('SELECT count(*)::int AS n FROM learner_profiles');
  check('user B cannot read user A profiles', otherProfiles.rows[0].n === 0);
  const otherDevices = await client.query('SELECT count(*)::int AS n FROM devices');
  check('user B cannot read user A devices', otherDevices.rows[0].n === 0);
  const otherConsents = await client.query('SELECT count(*)::int AS n FROM consents');
  check('user B cannot read user A consents', otherConsents.rows[0].n === 0);
  const otherSettings = await client.query('SELECT count(*)::int AS n FROM settings');
  check('user B cannot read user A settings', otherSettings.rows[0].n === 0);

  let blocked = false;
  try {
    await client.query(
      `INSERT INTO learner_profiles
         (id, user_id, target_lang, native_lang, goal, timezone, interests_json, onboarding_completed, created_at, updated_at)
       VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', $1, 'en', 'it', 'daily', 'Europe/Rome', '[]', true, now(), now())`,
      [userA],
    );
  } catch {
    blocked = true;
  }
  check('user B cannot write rows for user A', blocked);

  await client.query('ROLLBACK');
} catch (error) {
  failures.push('setup');
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  await client.query('ROLLBACK').catch(() => undefined);
} finally {
  await client.end().catch(() => undefined);
}

if (failures.length > 0) {
  console.error(`RLS: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('RLS: two-user isolation green');
