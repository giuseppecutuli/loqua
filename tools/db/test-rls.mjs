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

  await client.query(
    `INSERT INTO items
       (id, target_lang, native_lang, type, skill_id, cefr_level, prompt_json, answer_key_json,
        difficulty_b, review_status, created_at, updated_at)
     VALUES ('item-rls-draft', 'en', 'it', 'cloze', 'skill-en-grammar', 'A1',
             '{"prompt":"draft","options":[{"id":"a","text":"a"},{"id":"b","text":"b"}]}'::jsonb,
             '{"correctOptionId":"a"}'::jsonb, 0, 'draft', now(), now())
     ON CONFLICT (id) DO NOTHING`,
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
  await client.query(
    `INSERT INTO assessments
       (id, user_id, profile_id, kind, target_lang, raw_json, status, created_at)
     VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', $1,
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'placement', 'en', '{}'::jsonb,
             'in_progress', now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO assessment_scores (id, assessment_id, dimension, score, created_at)
     VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
             'grammar', 0.5, now())`,
  );
  await client.query(
    `INSERT INTO level_events
       (id, user_id, profile_id, from_level, to_level, reason, detail_json, created_at)
     VALUES ('99999999-9999-4999-8999-999999999999', $1,
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A2', 'B1', 'placement', '{}'::jsonb, now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO user_skill_state
       (user_id, skill_id, theta, se, n_obs, mastery, created_at, updated_at)
     VALUES ($1, 'skill-en-grammar', 0.5, 0.6, 3, 0.62, now(), now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO user_concept_state
       (user_id, concept_id, mastery, evidence_count, created_at, updated_at)
     VALUES ($1, 'concept-en-present-simple', 0.7, 2, now(), now())`,
    [userA],
  );
  const ownProfiles = await client.query('SELECT count(*)::int AS n FROM learner_profiles');
  check('user A reads own profile', ownProfiles.rows[0].n === 1);
  const ownAssessment = await client.query('SELECT count(*)::int AS n FROM assessments');
  check('user A reads own assessment', ownAssessment.rows[0].n === 1);
  const ownScores = await client.query('SELECT count(*)::int AS n FROM assessment_scores');
  check('user A reads own assessment scores', ownScores.rows[0].n === 1);
  const ownConceptState = await client.query('SELECT count(*)::int AS n FROM user_concept_state');
  check('user A reads own concept state', ownConceptState.rows[0].n === 1);

  await asUser(userB);
  const otherProfiles = await client.query('SELECT count(*)::int AS n FROM learner_profiles');
  check('user B cannot read user A profiles', otherProfiles.rows[0].n === 0);
  const otherDevices = await client.query('SELECT count(*)::int AS n FROM devices');
  check('user B cannot read user A devices', otherDevices.rows[0].n === 0);
  const otherConsents = await client.query('SELECT count(*)::int AS n FROM consents');
  check('user B cannot read user A consents', otherConsents.rows[0].n === 0);
  const otherSettings = await client.query('SELECT count(*)::int AS n FROM settings');
  check('user B cannot read user A settings', otherSettings.rows[0].n === 0);
  const otherAssessments = await client.query('SELECT count(*)::int AS n FROM assessments');
  check('user B cannot read user A assessments', otherAssessments.rows[0].n === 0);
  const otherScores = await client.query('SELECT count(*)::int AS n FROM assessment_scores');
  check('user B cannot read user A assessment scores', otherScores.rows[0].n === 0);
  const otherEvents = await client.query('SELECT count(*)::int AS n FROM level_events');
  check('user B cannot read user A level events', otherEvents.rows[0].n === 0);
  const otherSkillState = await client.query('SELECT count(*)::int AS n FROM user_skill_state');
  check('user B cannot read user A skill state', otherSkillState.rows[0].n === 0);
  const otherConceptState = await client.query('SELECT count(*)::int AS n FROM user_concept_state');
  check('user B cannot read user A concept state', otherConceptState.rows[0].n === 0);

  const approvedItems = await client.query(
    "SELECT count(*)::int AS n FROM items WHERE review_status = 'approved'",
  );
  check('user B reads approved content', approvedItems.rows[0].n >= 18);
  const draftItems = await client.query(
    "SELECT count(*)::int AS n FROM items WHERE review_status = 'draft'",
  );
  check('user B cannot read draft content', draftItems.rows[0].n === 0);

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

  let scoreBlocked = false;
  try {
    await client.query(
      `INSERT INTO assessment_scores (id, assessment_id, dimension, score, created_at)
       VALUES ('88888888-8888-4888-8888-888888888888', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
               'reading', 0.5, now())`,
    );
  } catch {
    scoreBlocked = true;
  }
  check('user B cannot write scores for user A', scoreBlocked);

  let itemBlocked = false;
  try {
    await client.query(
      `INSERT INTO items
         (id, target_lang, type, skill_id, cefr_level, prompt_json, answer_key_json, created_at, updated_at)
       VALUES ('item-rls-write', 'en', 'cloze', 'skill-en-grammar', 'A1', '{}'::jsonb, '{}'::jsonb, now(), now())`,
    );
  } catch {
    itemBlocked = true;
  }
  check('user B cannot write content items', itemBlocked);

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
