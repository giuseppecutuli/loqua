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
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const client = new pg.Client({ connectionString: databaseUrl });

function modeledMinutes(objectiveItems) {
  const secondsPerItem = 22;
  const writingMinutes = 5;
  const speakingMinutes = 2 * 1.25;
  return (objectiveItems * secondsPerItem) / 60 + writingMinutes + speakingMinutes;
}

try {
  await client.connect();
  const result = await client.query(
    `SELECT EXTRACT(EPOCH FROM (completed_at - created_at)) AS seconds
     FROM public.assessments
     WHERE kind = 'placement' AND status = 'completed'
       AND completed_at IS NOT NULL AND created_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT 200`,
  );
  const samples = result.rows
    .map((row) => Number(row.seconds))
    .filter((value) => Number.isFinite(value) && value >= 60)
    .sort((left, right) => left - right);

  console.log('placement timing');
  console.log(`model 18 items: ${modeledMinutes(18).toFixed(1)} min`);
  console.log(`model 24 items: ${modeledMinutes(24).toFixed(1)} min`);
  if (samples.length === 0) {
    console.log('measured samples: none (complete a placement run to populate)');
  } else {
    const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(p * samples.length))];
    console.log(`measured samples: ${samples.length}`);
    console.log(`p50: ${(percentile(0.5) / 60).toFixed(1)} min`);
    console.log(`p95: ${(percentile(0.95) / 60).toFixed(1)} min`);
  }
} catch (error) {
  console.error(
    `placement timing: database unavailable (${error instanceof Error ? error.message : String(error)})`,
  );
  console.log(`model 18 items: ${modeledMinutes(18).toFixed(1)} min`);
  console.log(`model 24 items: ${modeledMinutes(24).toFixed(1)} min`);
  process.exitCode = 0;
} finally {
  await client.end().catch(() => undefined);
}
