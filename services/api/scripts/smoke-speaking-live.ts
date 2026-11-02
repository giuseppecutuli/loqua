#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AssemblyAiTranscriber,
  createGateway,
  DeepSeekProvider,
  InMemoryCostSink,
  InMemoryDailyBudget,
} from '@loqua/ai';
import { PostgresAccountStore, PostgresAssessmentStore } from '@loqua/db-postgres';
import { Pool } from 'pg';

import { createApp } from '../src/app.js';
import { InMemorySessionRepository } from '../src/repos/session.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Host-injected environment is also supported.
  }
}

const databaseUrl =
  process.env.LOCAL_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
const deepSeekKey = process.env.DEEPSEEK_API_KEY;
if (!assemblyKey) throw new Error('ASSEMBLYAI_API_KEY is required');
if (!deepSeekKey) throw new Error('DEEPSEEK_API_KEY is required');

const userId = randomUUID();
const profileId = randomUUID();
const now = new Date().toISOString();
const audioPath = path.join(os.tmpdir(), `loqua-speaking-${userId}.wav`);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function makeAudio(): Promise<Uint8Array> {
  if (process.platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      `$s.SetOutputToWaveFile('${audioPath.replaceAll("'", "''")}')`,
      '$s.Speak("Recently I decided to change my daily routine. I used to study late at night, but I was always tired. I decided to study for twenty minutes every morning before work. At first it was difficult, but now I feel more energetic and I remember more words. I am happy with this decision because I can practise every day.")',
      '$s.Dispose()',
    ].join('; ');
    const result = spawnSync('powershell', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
    });
    if (result.status === 0) return new Uint8Array(await readFile(audioPath));
  }
  const response = await fetch('https://assembly.ai/wildfires.mp3');
  assert(response.ok, 'could not download the fallback audio sample');
  return new Uint8Array(await response.arrayBuffer());
}

const pool = new Pool({ connectionString: databaseUrl });
const account = new PostgresAccountStore(pool);
const assessments = new PostgresAssessmentStore(pool);
const sessions = new InMemorySessionRepository();
const costs = new InMemoryCostSink();
const transcriber = new AssemblyAiTranscriber({ apiKey: assemblyKey });
const ai = createGateway({
  provider: new DeepSeekProvider({ apiKey: deepSeekKey }),
  costSink: costs,
  budget: new InMemoryDailyBudget(0.5),
});
const app = createApp({
  ai,
  auth: async () => ({
    id: userId,
    email: `speaking-${userId}@example.test`,
    role: 'authenticated',
    isAnonymous: false,
  }),
  account,
  assessments,
  sessions,
  transcribe: (audio, languageCode) => transcriber.transcribe({ audio, languageCode }),
  corsOrigins: ['http://localhost:8081'],
});
const headers = {
  authorization: 'Bearer live-token',
  'content-type': 'application/json',
};

try {
  await pool.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
    userId,
    `speaking-${userId}@example.test`,
  ]);
  await pool.query(
    `INSERT INTO learner_profiles
       (id, user_id, target_lang, native_lang, explanation_mode, proficiency_framework, goal,
        daily_minutes, streak_mode, timezone, interests_json, self_assessment_json,
        onboarding_completed, created_at, updated_at)
     VALUES ($1, $2, 'en', 'it', 'target_simple', 'CEFR', 'work', 20, 'flexible', 'Europe/Rome',
             $3::jsonb, $4::jsonb, true, $5, $5)`,
    [
      profileId,
      userId,
      JSON.stringify(['work']),
      JSON.stringify({
        grammar: 'B1',
        vocabulary: 'B1',
        reading: 'B1',
        listening: 'B1',
        pragmatics: 'B1',
      }),
      now,
    ],
  );
  for (const [kind, id] of [
    ['terms', randomUUID()],
    ['privacy', randomUUID()],
    ['ai_processing', randomUUID()],
    ['voice', randomUUID()],
  ] as const) {
    await pool.query(
      `INSERT INTO consents (id, user_id, kind, version, granted_at, created_at)
       VALUES ($1, $2, $3, '1', $4, $4)`,
      [id, userId, kind, now],
    );
  }

  const started = await app.request('/v1/assessments/placement/start', {
    method: 'POST',
    headers,
  });
  assert(started.status === 201, `placement start failed: ${started.status}`);
  let body = (await started.json()) as {
    assessmentId: string;
    stage: string;
    item: { id: string; options: { id: string }[] } | null;
    writingTask: { id: string } | null;
    speakingTask: { id: string } | null;
    completed: boolean;
    result: { speaking?: { level: string } } | null;
    progress: { answered: number };
  };
  const assessmentId = body.assessmentId;

  for (let index = 0; index < 30; index += 1) {
    if (body.stage === 'writing') {
      const skipped = await app.request(`/v1/assessments/${assessmentId}/writing/skip`, {
        method: 'POST',
        headers,
      });
      assert(skipped.status === 200, `writing skip failed: ${skipped.status}`);
      body = (await skipped.json()) as typeof body;
      continue;
    }
    if (body.stage === 'speaking') {
      const audio = await makeAudio();
      const answered = await app.request(`/v1/assessments/${assessmentId}/speaking`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: body.speakingTask?.id,
          audioBase64: Buffer.from(audio).toString('base64'),
          durationSec: 30,
        }),
      });
      if (answered.status !== 200) {
        console.error('SPEAKING FAILURE', answered.status, await answered.text());
      }
      assert(answered.status === 200, `speaking request failed: ${answered.status}`);
      body = (await answered.json()) as typeof body;
      if (body.completed) break;
      continue;
    }
    if (!body.item) throw new Error(`placement stalled at ${body.stage}`);
    const answered = await app.request(`/v1/assessments/${assessmentId}/answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemId: body.item.id,
        optionId: body.item.options[index % body.item.options.length]?.id,
      }),
    });
    assert(answered.status === 200, `objective answer failed: ${answered.status}`);
    body = (await answered.json()) as typeof body;
    if (body.completed) break;
  }

  assert(body.completed, 'placement did not complete');
  assert(body.result?.speaking?.level, 'speaking result missing');
  const raw = await assessments.getAssessment(userId, assessmentId);
  assert(raw?.status === 'completed', 'assessment not persisted as completed');
  const transcripts = raw.raw.speakingTranscripts ?? [];
  assert(transcripts.length === 2, 'expected two speaking transcripts');
  assert(transcripts.every((text) => text.trim().length > 10), 'transcript is empty');

  console.log('PASS live AssemblyAI + DeepSeek speaking placement');
  console.log({
    assessmentId,
    speakingLevel: body.result.speaking.level,
    transcripts: transcripts.map((text) => `${text.slice(0, 60)}...`),
    aiCostUsd: costs.totalUsd(),
  });
} finally {
  await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]).catch(() => undefined);
  await pool.end();
  await rm(audioPath, { force: true }).catch(() => undefined);
}
