#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgresAccountStore, PostgresAssessmentStore } from '@loqua/db-postgres';
import {
  aggregateConceptEvidence,
  buildPlacementResult,
  createPlacementState,
  isPlacementComplete,
  recordPlacementAnswer,
  selectNextPlacementItem,
  type AssessmentItem,
} from '@loqua/core';
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
const assessmentStore = new PostgresAssessmentStore(pool);

const userId = randomUUID();
const profileId = randomUUID();
const deviceId = randomUUID();
const consentId = randomUUID();
const now = new Date().toISOString();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  await pool.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
    userId,
    `smoke-${userId}@example.test`,
  ]);
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
  await pool.query(`INSERT INTO settings (user_id, created_at, updated_at) VALUES ($1, $2, $2)`, [
    userId,
    now,
  ]);

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

  const items = await assessmentStore.listApprovedItems(userId, 'en');
  assert(items.length >= 18, 'placement bank is missing approved items');
  let state = createPlacementState({
    targetLang: 'en',
    selfAssessment: { grammar: 'B1', vocabulary: 'B1', reading: 'B1', pragmatics: 'B1' },
    now: new Date(now),
  });
  const served: Record<string, AssessmentItem> = {};
  let currentItem = selectNextPlacementItem(state, items);
  assert(currentItem !== null, 'placement did not select a first item');
  served[currentItem.id] = currentItem;
  const assessmentId = randomUUID();
  await assessmentStore.createAssessment({
    id: assessmentId,
    userId,
    profileId,
    targetLang: 'en',
    status: 'in_progress',
    overallLevel: null,
    confidence: null,
    raw: { state, items: served, currentItemId: currentItem.id, stage: 'objective' },
    createdAt: now,
    completedAt: null,
  });
  const active = await assessmentStore.findActivePlacement(userId, profileId);
  assert(active?.id === assessmentId, 'active placement not found');
  console.log('PASS placement start + resume');

  let answered = 0;
  while (!isPlacementComplete(state) && currentItem) {
    const wrongOption = currentItem.options.find(
      (option) => option.id !== currentItem.correctOptionId,
    );
    const optionId =
      answered % 5 === 4 && wrongOption ? wrongOption.id : currentItem.correctOptionId;
    const outcome = recordPlacementAnswer(state, currentItem, optionId, new Date(now));
    state = outcome.state;
    answered += 1;
    const nextItem = selectNextPlacementItem(state, items);
    if (!nextItem) break;
    served[nextItem.id] = nextItem;
    currentItem = nextItem;
  }
  assert(answered >= 8, 'placement did not produce enough evidence');
  const result = buildPlacementResult(state);
  assert(result.overallLevel !== null, 'placement produced no overall level');
  const concepts = aggregateConceptEvidence(state).map((entry) => ({
    userId,
    conceptId: entry.conceptId,
    mastery: entry.mastery,
    evidenceCount: entry.nObs,
    lastSeenAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  }));
  const completedAt = new Date().toISOString();
  await assessmentStore.completeAssessment({
    assessment: {
      id: assessmentId,
      userId,
      profileId,
      targetLang: 'en',
      status: 'completed',
      overallLevel: result.overallLevel,
      confidence: result.confidence,
      raw: { state, items: served, currentItemId: null, stage: 'completed', result },
      createdAt: now,
      completedAt,
    },
    scores: result.measured
      .filter((entry) => entry.measured)
      .map((entry) => ({
        id: randomUUID(),
        assessmentId,
        dimension: entry.skill,
        score: entry.score,
        confidence: entry.confidence,
        notes: entry.range,
        createdAt: completedAt,
      })),
    levelEvents: [
      {
        id: randomUUID(),
        userId,
        profileId,
        skillId: null,
        fromLevel: null,
        toLevel: result.overallLevel,
        reason: 'placement',
        detail: { overallTheta: result.overallTheta },
        createdAt: completedAt,
      },
    ],
    concepts,
    skills: result.measured
      .filter((entry) => entry.measured)
      .flatMap((entry) => {
        const item = Object.values(served).find((candidate) => candidate.skill === entry.skill);
        if (!item) return [];
        return [
          {
            userId,
            skillId: item.skillId,
            theta: entry.theta,
            se: entry.se,
            nObs: entry.nObs,
            mastery: entry.score,
            lastSeenAt: completedAt,
            createdAt: completedAt,
            updatedAt: completedAt,
          },
        ];
      }),
  });
  const finished = await assessmentStore.getAssessment(userId, assessmentId);
  assert(finished?.status === 'completed', 'placement was not completed');
  const counts = await pool.query<{ scores: number; events: number; states: number }>(
    `SELECT
       (SELECT count(*)::int FROM assessment_scores WHERE assessment_id = $1) AS scores,
       (SELECT count(*)::int FROM level_events WHERE user_id = $2 AND reason = 'placement') AS events,
       (SELECT count(*)::int FROM user_skill_state WHERE user_id = $2) AS states,
       (SELECT count(*)::int FROM user_concept_state WHERE user_id = $2) AS concepts`,
    [assessmentId, userId],
  );
  assert(counts.rows[0]?.scores === 5, 'assessment scores were not persisted');
  assert(counts.rows[0]?.events === 1, 'level event was not persisted');
  assert(counts.rows[0]?.states === 5, 'skill states were not persisted');
  assert((counts.rows[0]?.concepts ?? 0) > 0, 'concept states were not persisted');
  console.log('PASS placement completion + scores + skill state');

  const progress = await assessmentStore.getProgress(userId, profileId);
  assert(progress.latest?.overallLevel === result.overallLevel, 'progress overall level missing');
  assert(progress.skills.length === 5, 'progress skill states missing');
  assert(progress.events.length >= 1, 'progress events missing');
  assert(progress.latest.priorities.length === 3, 'progress priorities missing');
  console.log('PASS progress snapshot');

  const exported = await store.getSnapshot(userId);
  assert(Array.isArray(exported.data.assessments), 'assessment export missing');
  assert(exported.data.assessments.length === 1, 'assessment export mismatch');
  assert(Array.isArray(exported.data.assessmentScores), 'assessment score export missing');
  assert(Array.isArray(exported.data.levelEvents), 'level event export missing');
  assert(Array.isArray(exported.data.userSkillState), 'skill state export missing');
  assert(Array.isArray(exported.data.userConceptState), 'concept state export missing');
  console.log('PASS assessment export');

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
