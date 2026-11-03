#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PostgresAccountStore,
  PostgresAssessmentStore,
  PostgresMediaStore,
  PostgresNotificationStore,
  PostgresProductEventStore,
  PostgresSessionStore,
  type MediaGuideRecord,
  type RecommendationRecord,
  type TasteProfileRecord,
} from '@loqua/db-postgres';
import {
  aggregateConceptEvidence,
  buildPlacementResult,
  createFeedback,
  createSavedPhrase,
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
const sessionStore = new PostgresSessionStore(pool);
const notificationStore = new PostgresNotificationStore(pool);
const eventStore = new PostgresProductEventStore(pool);
const mediaStore = new PostgresMediaStore(pool);

const userId = randomUUID();
const profileId = randomUUID();
const deviceId = randomUUID();
const consentId = randomUUID();
const now = new Date().toISOString();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function exportRows(data: Record<string, unknown>, key: string): readonly Record<string, unknown>[] {
  const value = data[key];
  assert(Array.isArray(value), `export rows missing: ${key}`);
  return value.filter(
    (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
  );
}

function hasId(rows: readonly Record<string, unknown>[], id: string): boolean {
  return rows.some((row) => row.id === id);
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

  const phrase = createSavedPhrase({
    id: randomUUID(),
    userId,
    profileId,
    targetLang: 'en',
    text: 'Could you repeat that, please?',
    source: 'manual',
    now: new Date(now),
  });
  const savedPhrase = await store.upsertSavedPhrase(phrase);
  assert(savedPhrase.id === phrase.id, 'saved phrase was not persisted');
  const phrases = await store.listSavedPhrases(userId, profileId);
  assert(phrases.length === 1, 'saved phrase list mismatch');

  const feedback = createFeedback({
    id: randomUUID(),
    userId,
    profileId,
    targetType: 'exercise',
    targetId: 'item-en-g-01',
    kind: 'helpful',
    now: new Date(now),
  });
  await store.upsertFeedback(feedback);
  const feedbackRows = await store.listFeedback(userId, profileId);
  assert(feedbackRows.length === 1, 'feedback was not persisted');
  const withPhrases = await store.getSnapshot(userId);
  assert(Array.isArray(withPhrases.data.savedPhrases), 'saved phrase export missing');
  assert(Array.isArray(withPhrases.data.userFeedback), 'feedback export missing');
  console.log('PASS saved phrases + feedback');

  const generatedId = `smoke-generated-${randomUUID()}`;
  await assessmentStore.insertGeneratedItem({
    item: {
      id: generatedId,
      targetLang: 'en',
      type: 'cloze',
      skill: 'grammar',
      skillId: 'skill-en-grammar',
      cefrLevel: 'A1',
      conceptId: 'en.gram.tense.present_simple',
      difficultyB: 0,
      prompt: `Smoke generated ${generatedId}.`,
      options: [
        { id: 'a', text: 'works' },
        { id: 'b', text: 'work' },
      ],
      correctOptionId: 'a',
      explanation: 'Smoke generated item.',
    },
    ownerUserId: userId,
    profileId,
    nativeLang: 'it',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    promptId: 'content.generate',
    promptVersion: 1,
    generationReason: 'smoke',
    createdAt: now,
  });
  const generatedItems = await assessmentStore.listApprovedItems(userId, 'en');
  assert(
    generatedItems.some((item) => item.id === generatedId),
    'generated private item was not served',
  );
  console.log('PASS generated private item + RLS');

  const xpId = randomUUID();
  await sessionStore.recordAttempt({
    attempt: {
      id: randomUUID(),
      userId,
      itemId: generatedId,
      sessionId: null,
      sessionItemId: null,
      correct: true,
      score: 1,
      latencyMs: 1000,
      hintUsed: false,
      response: {},
      createdAt: now,
    },
    xpEvent: {
      id: xpId,
      userId,
      profileId,
      amount: 12,
      reason: 'correct_attempt',
      sourceType: 'item',
      sourceId: generatedId,
      createdAt: now,
    },
  });
  const xpEvents = await sessionStore.listXpEvents(userId, '1970-01-01T00:00:00.000Z');
  assert(xpEvents.some((event) => event.id === xpId), 'xp event was not persisted');
  console.log('PASS xp event persistence + RLS');

  const sessionId = `smoke-session-${randomUUID()}`;
  await sessionStore.createSession({
    id: sessionId,
    userId,
    profileId,
    targetLang: 'en',
    kind: 'lesson',
    status: 'in_progress',
    startedAt: now,
    endedAt: null,
    turns: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  const sessionItemId = `smoke-session-item-${randomUUID()}`;
  await sessionStore.addSessionItems(userId, sessionId, [
    {
      id: sessionItemId,
      sessionId,
      itemId: generatedId,
      block: 'production',
      sortOrder: 0,
      rationaleCode: 'smoke',
      rationale: {},
      status: 'pending',
      servedAt: null,
      answeredAt: null,
      createdAt: now,
    },
  ]);
  const sessionTurnId = `smoke-session-turn-${randomUUID()}`;
  await sessionStore.addSessionTurn(userId, {
    id: sessionTurnId,
    sessionId,
    role: 'user',
    content: 'Smoke conversation turn.',
    audioRef: null,
    transcriptMeta: null,
    createdAt: now,
  });
  const srsCardId = `smoke-srs-card-${randomUUID()}`;
  const srsCard = {
    id: srsCardId,
    userId,
    profileId,
    cardType: 'recognition' as const,
    sourceType: 'item' as const,
    sourceId: generatedId,
    fsrs: {},
    dueAt: now,
    state: 'new' as const,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    suspended: false,
    leech: false,
    lastReviewAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await sessionStore.upsertSrsCard(srsCard);
  await sessionStore.upsertSrsCard({ ...srsCard, updatedAt: new Date().toISOString() });
  const secondProfileId = randomUUID();
  await pool.query(
    `INSERT INTO learner_profiles
       (id, user_id, target_lang, native_lang, timezone, interests_json,
        self_assessment_json, onboarding_completed, created_at, updated_at)
     VALUES ($1, $2, 'es', 'it', 'Europe/Rome', '[]'::jsonb, '{}'::jsonb, true, $3, $3)`,
    [secondProfileId, userId, now],
  );
  await sessionStore.upsertSrsCard({
    ...srsCard,
    id: randomUUID(),
    profileId: secondProfileId,
  });
  const cardsPerProfile = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM srs_cards
     WHERE user_id = $1 AND source_type = 'item' AND source_id = $2
       AND card_type = 'recognition'`,
    [userId, generatedId],
  );
  assert(cardsPerProfile.rows[0]?.n === 2, 'srs cards are not unique per profile');
  console.log('PASS srs uniqueness includes profile');
  const srsReviewId = `smoke-srs-review-${randomUUID()}`;
  await sessionStore.recordSrsReview({
    id: srsReviewId,
    cardId: srsCardId,
    userId,
    rating: 3,
    reviewedAt: now,
    elapsedDays: 0,
    scheduledDays: 1,
    durationMs: 500,
    createdAt: now,
  });
  const errorEventId = `smoke-error-${randomUUID()}`;
  await sessionStore.addErrorEvent({
    id: errorEventId,
    userId,
    sessionId,
    source: 'exercise',
    span: 'work',
    errorType: 'agreement',
    ruleId: 'en.gram.tense.present_simple',
    severity: 'low',
    confidence: 0.8,
    shownToUser: true,
    status: 'open',
    resolvedAt: null,
    createdAt: now,
  });

  const fullExport = await store.getSnapshot(userId);
  const sessionsExport = exportRows(fullExport.data, 'sessions');
  const sessionItemsExport = exportRows(fullExport.data, 'sessionItems');
  const sessionTurnsExport = exportRows(fullExport.data, 'sessionTurns');
  const attemptsExport = exportRows(fullExport.data, 'attempts');
  const errorEventsExport = exportRows(fullExport.data, 'errorEvents');
  const srsCardsExport = exportRows(fullExport.data, 'srsCards');
  const srsReviewsExport = exportRows(fullExport.data, 'srsReviews');
  const xpEventsExport = exportRows(fullExport.data, 'xpEvents');
  const generatedItemsExport = exportRows(fullExport.data, 'generatedItems');
  assert(hasId(sessionsExport, sessionId), 'session missing from export');
  assert(hasId(sessionItemsExport, sessionItemId), 'session item missing from export');
  assert(hasId(sessionTurnsExport, sessionTurnId), 'session turn missing from export');
  assert(attemptsExport.length >= 1, 'attempt missing from export');
  assert(hasId(errorEventsExport, errorEventId), 'error event missing from export');
  assert(hasId(srsCardsExport, srsCardId), 'srs card missing from export');
  assert(hasId(srsReviewsExport, srsReviewId), 'srs review missing from export');
  assert(hasId(xpEventsExport, xpId), 'xp event missing from export');
  assert(hasId(generatedItemsExport, generatedId), 'generated item missing from export');
  console.log('PASS full account export');

  const notificationId = `smoke-${randomUUID()}`;
  await notificationStore.replaceScheduledNotifications(
    userId,
    [
      {
        id: notificationId,
        kind: 'plan_ready',
        fireAt: new Date(Date.now() + 3_600_000).toISOString(),
        payload: { deepLink: '/' },
      },
    ],
    new Date(),
  );
  const scheduled = await notificationStore.listScheduledNotifications(userId, now);
  assert(scheduled.some((entry) => entry.id === notificationId), 'notification not scheduled');
  assert(
    (await notificationStore.markNotificationSent(userId, 'plan_ready', new Date())) === true,
    'notification was not marked sent',
  );
  const sentNotifications = await notificationStore.listSentNotifications(userId, now);
  assert(
    sentNotifications.some((entry) => entry.kind === 'plan_ready'),
    'sent notification missing',
  );
  console.log('PASS notification schedule + sent state');

  await eventStore.insertProductEvents(
    userId,
    [
      {
        name: 'app_open',
        schemaVersion: 1,
        occurredAt: now,
        properties: { platform: 'web' },
      },
    ],
    new Date(),
  );
  const productEvents = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM public.product_events WHERE user_id = $1',
    [userId],
  );
  assert(productEvents.rows[0]?.n === 1, 'product event was not persisted');
  console.log('PASS product event persistence + RLS');

  const mediaId = 'movie-finding-nemo';
  const titles = await mediaStore.listApprovedTitles('en');
  assert(titles.some((title) => title.id === mediaId), 'seeded media title missing');
  const availability = await mediaStore.listAvailability([mediaId], 'IT');
  assert(availability.length > 0, 'seeded media availability missing');
  const taste: TasteProfileRecord = {
    profileId,
    formats: ['movie'],
    genres: ['comedy'],
    themes: ['humor'],
    disliked: [],
    genreWeights: { comedy: 1 },
    themeWeights: { humor: 1 },
    difficultyTolerance: 'easy',
    subtitlePref: 'target',
    accents: ['us'],
    region: 'IT',
    weeklyMinutes: 120,
    maxAgeRating: null,
    coverageOffset: 0,
    createdAt: now,
    updatedAt: now,
  };
  await mediaStore.upsertTasteProfile(taste);
  const recommendation: RecommendationRecord = {
    id: `smoke-recommendation-${randomUUID()}`,
    userId,
    profileId,
    mediaId,
    score: 0.9,
    scoreJson: { components: { levelFit: 0.95 }, reason: { whyItFits: 'Smoke' } },
    reasonText: 'Smoke recommendation',
    source: 'rule',
    status: 'shown',
    createdAt: now,
    expiresAt: null,
  };
  await mediaStore.insertRecommendations([recommendation]);
  await mediaStore.upsertRecommendationFeedback({
    id: `smoke-media-feedback-${randomUUID()}`,
    recommendationId: recommendation.id,
    userId,
    rating: 4,
    reasonCode: null,
    difficultyFeedback: 'ok',
    createdAt: now,
  });
  await mediaStore.upsertMediaProgress({
    id: `smoke-media-progress-${randomUUID()}`,
    userId,
    profileId,
    mediaId,
    status: 'watching',
    progressPct: 10,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  const guide: MediaGuideRecord = {
    id: `smoke-media-guide-${randomUUID()}`,
    mediaId,
    profileId,
    cefrLevel: 'A1',
    guideJson: { mediaId, before: ['Smoke'], during: [], after: [], spoilerFree: true },
    promptId: 'media.guide',
    promptVersion: 1,
    createdAt: now,
  };
  await mediaStore.upsertMediaGuide(guide);
  const mediaExport = await store.getSnapshot(userId);
  assert(exportRows(mediaExport.data, 'tasteProfiles').length === 1, 'taste export missing');
  assert(
    exportRows(mediaExport.data, 'recommendations').length === 1,
    'recommendation export missing',
  );
  assert(
    exportRows(mediaExport.data, 'recommendationFeedback').length === 1,
    'recommendation feedback export missing',
  );
  assert(exportRows(mediaExport.data, 'mediaProgress').length === 1, 'media progress export missing');
  assert(exportRows(mediaExport.data, 'mediaGuides').length === 1, 'media guide export missing');
  console.log('PASS media taste, recommendation, feedback, progress and guide export');

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
