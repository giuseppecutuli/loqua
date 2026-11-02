#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgresAccountStore } from '@loqua/db-postgres';
import { Pool } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // Local defaults are enough for this smoke test.
}

const databaseUrl =
  process.env.LOCAL_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const pool = new Pool({ connectionString: databaseUrl });
const store = new PostgresAccountStore(pool);

const userId = randomUUID();
const profileId = randomUUID();
const deviceId = randomUUID();
const consentId = randomUUID();
const now = new Date().toISOString();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  await pool.query(
    'INSERT INTO auth.users (id, email) VALUES ($1, $2)',
    [userId, `smoke-${userId}@example.test`],
  );
  await pool.query(
    `INSERT INTO learner_profiles
       (id, user_id, target_lang, native_lang, explanation_mode, proficiency_framework, goal,
        daily_minutes, streak_mode, timezone, interests_json, self_assessment_json,
        onboarding_completed, created_at, updated_at)
     VALUES ($1, $2, 'en', 'it', 'target_simple', 'CEFR', 'work', 20, 'flexible', 'Europe/Rome',
             $3::jsonb, $4::jsonb, true, $5, $5)`,
    [profileId, userId, JSON.stringify(['work']), JSON.stringify({ grammar: 'B1' }), now],
  );
  await pool.query(
    `INSERT INTO consents (id, user_id, kind, version, granted_at, created_at)
     VALUES ($1, $2, 'terms', '1', $3, $3)`,
    [consentId, userId, now],
  );
  await pool.query(
    `INSERT INTO devices (id, user_id, platform, name, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, 'web', 'Smoke browser', $3, $3, $3)`,
    [deviceId, userId, now],
  );
  await pool.query(
    `INSERT INTO settings (user_id, created_at, updated_at) VALUES ($1, $2, $2)`,
    [userId, now],
  );

  const snapshot = await store.getSnapshot(userId);
  assert(snapshot.profile?.id === profileId, 'profile missing from snapshot');
  assert(snapshot.consents.length === 1, 'consent missing from snapshot');
  assert(snapshot.devices.length === 1, 'device missing from snapshot');
  assert(snapshot.settings !== null, 'settings missing from snapshot');
  assert(snapshot.data.user !== null, 'user data missing from snapshot');
  console.log('PASS account snapshot');

  const devices = await store.listDevices(userId);
  assert(devices.length === 1, 'active device list mismatch');
  const revoked = await store.revokeDevice(userId, deviceId, new Date());
  assert(revoked === 'revoked', 'device was not revoked');
  assert((await store.listDevices(userId)).length === 0, 'revoked device still listed');
  console.log('PASS device list + revoke');

  const deletion = await store.requestDelete(userId, new Date());
  assert(
    new Date(deletion.scheduledHardDeleteAt).getTime() > Date.now(),
    'hard delete was not scheduled',
  );
  const afterDelete = await store.getSnapshot(userId);
  assert(afterDelete.profile === null, 'profile was not soft-deleted');
  console.log('PASS account delete scheduling');
} finally {
  await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]).catch(() => undefined);
  await pool.end();
}

console.log('smoke: postgres account store green');



