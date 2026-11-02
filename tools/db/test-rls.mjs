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

async function expectFailure(name, sql, params = []) {
  await client.query('SAVEPOINT expect_failure');
  let blocked = false;
  try {
    await client.query(sql, params);
  } catch {
    blocked = true;
  }
  await client.query('ROLLBACK TO SAVEPOINT expect_failure');
  await client.query('RELEASE SAVEPOINT expect_failure');
  check(name, blocked);
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
  await client.query(
    `INSERT INTO sessions
       (id, user_id, profile_id, target_lang, kind, status, started_at, created_at, updated_at)
     VALUES ('session-rls-a', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'en', 'lesson',
             'in_progress', now(), now(), now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO session_items
       (id, session_id, item_id, block, sort_order, rationale_code, status, created_at)
     VALUES ('session-item-rls-a', 'session-rls-a', 'item-en-g-01', 'review', 0, 'due_review',
             'pending', now())`,
  );
  await client.query(
    `INSERT INTO attempts
       (id, user_id, item_id, session_id, session_item_id, correct, score, latency_ms,
        hint_used, response_json, created_at)
     VALUES ('attempt-rls-a', $1, 'item-en-g-01', 'session-rls-a', 'session-item-rls-a',
             true, 1, 1200, false, '{}'::jsonb, now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO srs_cards
       (id, user_id, profile_id, card_type, source_type, source_id, fsrs_json, due_at, state,
        created_at, updated_at)
     VALUES ('card-rls-a', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'recognition', 'item',
             'item-en-g-01', '{}'::jsonb, now(), 'new', now(), now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO srs_reviews
       (id, card_id, user_id, rating, reviewed_at, elapsed_days, scheduled_days, duration_ms,
        created_at)
     VALUES ('review-rls-a', 'card-rls-a', $1, 3, now(), 1, 2, 900, now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO saved_phrases
       (id, user_id, profile_id, target_lang, text, normalized_text, source, created_at)
     VALUES ('phrase-rls-a', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'en',
             'Could you repeat that?', 'could you repeat that?', 'manual', now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO user_feedback
       (id, user_id, profile_id, target_type, target_id, kind, comment, status, created_at)
     VALUES ('feedback-rls-a', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'exercise',
             'item-en-g-01', 'helpful', null, 'open', now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO xp_events
       (id, user_id, profile_id, amount, reason, source_type, source_id, created_at)
     VALUES ('xp-rls-a', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 'correct_attempt',
             'item', 'item-en-g-01', now())`,
    [userA],
  );
  await client.query(
    `INSERT INTO session_turns
       (id, session_id, role, content, transcript_meta_json, created_at)
     VALUES ('turn-rls-a', 'session-rls-a', 'user', 'Hello tutor',
             '{"confidence":0.9}'::jsonb, now())`,
  );
  const ownProfiles = await client.query('SELECT count(*)::int AS n FROM learner_profiles');
  check('user A reads own profile', ownProfiles.rows[0].n === 1);
  const ownAssessment = await client.query('SELECT count(*)::int AS n FROM assessments');
  check('user A reads own assessment', ownAssessment.rows[0].n === 1);
  const ownScores = await client.query('SELECT count(*)::int AS n FROM assessment_scores');
  check('user A reads own assessment scores', ownScores.rows[0].n === 1);
  const ownConceptState = await client.query('SELECT count(*)::int AS n FROM user_concept_state');
  check('user A reads own concept state', ownConceptState.rows[0].n === 1);
  const ownSessions = await client.query('SELECT count(*)::int AS n FROM sessions');
  check('user A reads own sessions', ownSessions.rows[0].n === 1);
  const ownSessionItems = await client.query('SELECT count(*)::int AS n FROM session_items');
  check('user A reads own session items', ownSessionItems.rows[0].n === 1);
  const ownAttempts = await client.query('SELECT count(*)::int AS n FROM attempts');
  check('user A reads own attempts', ownAttempts.rows[0].n === 1);
  const ownCards = await client.query('SELECT count(*)::int AS n FROM srs_cards');
  check('user A reads own srs cards', ownCards.rows[0].n === 1);
  const ownReviews = await client.query('SELECT count(*)::int AS n FROM srs_reviews');
  check('user A reads own srs reviews', ownReviews.rows[0].n === 1);
  const ownTurns = await client.query('SELECT count(*)::int AS n FROM session_turns');
  check('user A reads own session turns', ownTurns.rows[0].n === 1);
  const ownPhrases = await client.query('SELECT count(*)::int AS n FROM saved_phrases');
  check('user A reads own saved phrases', ownPhrases.rows[0].n === 1);
  const ownFeedback = await client.query('SELECT count(*)::int AS n FROM user_feedback');
  check('user A reads own feedback', ownFeedback.rows[0].n === 1);
  const ownXp = await client.query('SELECT count(*)::int AS n FROM xp_events');
  check('user A reads own xp events', ownXp.rows[0].n === 1);

  await expectFailure(
    'user A cannot update append-only attempts',
    `UPDATE attempts SET correct = false WHERE id = 'attempt-rls-a'`,
  );
  await expectFailure(
    'user A cannot delete append-only srs reviews',
    `DELETE FROM srs_reviews WHERE id = 'review-rls-a'`,
  );

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
  const otherSessions = await client.query('SELECT count(*)::int AS n FROM sessions');
  check('user B cannot read user A sessions', otherSessions.rows[0].n === 0);
  const otherSessionItems = await client.query('SELECT count(*)::int AS n FROM session_items');
  check('user B cannot read user A session items', otherSessionItems.rows[0].n === 0);
  const otherAttempts = await client.query('SELECT count(*)::int AS n FROM attempts');
  check('user B cannot read user A attempts', otherAttempts.rows[0].n === 0);
  const otherCards = await client.query('SELECT count(*)::int AS n FROM srs_cards');
  check('user B cannot read user A srs cards', otherCards.rows[0].n === 0);
  const otherReviews = await client.query('SELECT count(*)::int AS n FROM srs_reviews');
  check('user B cannot read user A srs reviews', otherReviews.rows[0].n === 0);
  const otherTurns = await client.query('SELECT count(*)::int AS n FROM session_turns');
  check('user B cannot read user A session turns', otherTurns.rows[0].n === 0);
  const otherPhrases = await client.query('SELECT count(*)::int AS n FROM saved_phrases');
  check('user B cannot read user A saved phrases', otherPhrases.rows[0].n === 0);
  const otherFeedback = await client.query('SELECT count(*)::int AS n FROM user_feedback');
  check('user B cannot read user A feedback', otherFeedback.rows[0].n === 0);
  const otherXp = await client.query('SELECT count(*)::int AS n FROM xp_events');
  check('user B cannot read user A xp events', otherXp.rows[0].n === 0);

  const approvedItems = await client.query(
    "SELECT count(*)::int AS n FROM items WHERE review_status = 'approved'",
  );
  check('user B reads approved content', approvedItems.rows[0].n >= 18);
  const draftItems = await client.query(
    "SELECT count(*)::int AS n FROM items WHERE review_status = 'draft'",
  );
  check('user B cannot read draft content', draftItems.rows[0].n === 0);

  await expectFailure(
    'user B cannot write rows for user A',
    `INSERT INTO learner_profiles
       (id, user_id, target_lang, native_lang, goal, timezone, interests_json, onboarding_completed, created_at, updated_at)
     VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', $1, 'en', 'it', 'daily', 'Europe/Rome', '[]', true, now(), now())`,
    [userA],
  );

  await expectFailure(
    'user B cannot write scores for user A',
    `INSERT INTO assessment_scores (id, assessment_id, dimension, score, created_at)
     VALUES ('88888888-8888-4888-8888-888888888888', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
             'reading', 0.5, now())`,
  );

  await expectFailure(
    'user B cannot write content items',
    `INSERT INTO items
       (id, target_lang, type, skill_id, cefr_level, prompt_json, answer_key_json, created_at, updated_at)
     VALUES ('item-rls-write', 'en', 'cloze', 'skill-en-grammar', 'A1', '{}'::jsonb, '{}'::jsonb, now(), now())`,
  );

  await expectFailure(
    'user B cannot write sessions for user A',
    `INSERT INTO sessions
       (id, user_id, profile_id, target_lang, kind, status, created_at, updated_at)
     VALUES ('session-rls-b', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'en', 'lesson',
             'planned', now(), now())`,
    [userA],
  );

  await expectFailure(
    'user B cannot write session items for user A',
    `INSERT INTO session_items
       (id, session_id, item_id, block, sort_order, rationale_code, status, created_at)
     VALUES ('session-item-rls-b', 'session-rls-a', 'item-en-g-02', 'review', 0, 'due_review',
             'pending', now())`,
  );

  await expectFailure(
    'user B cannot write attempts for user A',
    `INSERT INTO attempts
       (id, user_id, item_id, session_id, session_item_id, correct, created_at)
     VALUES ('attempt-rls-b', $1, 'item-en-g-01', 'session-rls-a', 'session-item-rls-a', true, now())`,
    [userA],
  );

  await expectFailure(
    'user B cannot write session turns for user A',
    `INSERT INTO session_turns (id, session_id, role, content, created_at)
     VALUES ('turn-rls-b', 'session-rls-a', 'user', 'Injected turn', now())`,
  );

  await expectFailure(
    'user B cannot write srs cards for user A',
    `INSERT INTO srs_cards
       (id, user_id, profile_id, card_type, source_type, source_id, fsrs_json, due_at, state,
        created_at, updated_at)
     VALUES ('card-rls-b', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'recognition', 'item',
             'item-en-g-02', '{}'::jsonb, now(), 'new', now(), now())`,
    [userA],
  );

  await expectFailure(
    'user B cannot write srs reviews for user A',
    `INSERT INTO srs_reviews
       (id, card_id, user_id, rating, reviewed_at, created_at)
     VALUES ('review-rls-b', 'card-rls-a', $1, 2, now(), now())`,
    [userA],
  );

  await client.query("DELETE FROM session_turns WHERE id = 'turn-rls-a'");
  await asUser(userA);
  const turnSurvives = await client.query('SELECT count(*)::int AS n FROM session_turns');
  check('user B cannot delete user A session turns', turnSurvives.rows[0].n === 1);

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
