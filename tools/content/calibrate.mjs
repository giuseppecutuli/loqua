#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  MIN_CALIBRATION_ATTEMPTS,
  calibrateItem,
  pValueFromStats,
} from '../../packages/core/src/calibration.ts';

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
const apply = process.argv.includes('--apply');
const parsed = new URL(databaseUrl);
const isLocal = /^(?:127\.0\.0\.1|localhost)$/.test(parsed.hostname);

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rows } = await client.query(
    `SELECT i.id AS item_id,
            i.difficulty_b,
            i.discrimination,
            count(*)::int AS attempts,
            count(*) FILTER (WHERE a.correct)::int AS correct
     FROM items i
     JOIN attempts a ON a.item_id = i.id
     GROUP BY i.id, i.difficulty_b, i.discrimination
     ORDER BY i.id`,
  );

  const results = rows.map((row) => {
    const pValue = pValueFromStats({ attempts: row.attempts, correct: row.correct });
    const calibration = calibrateItem({
      itemId: row.item_id,
      attempts: row.attempts,
      correct: row.correct,
      discrimination: row.discrimination,
      difficultyB: row.difficulty_b,
    });
    return { row, pValue, calibration };
  });

  console.log(
    `CALIBRATION ${apply ? 'APPLY' : 'DRY RUN'} host=${parsed.hostname} items=${results.length} min_attempts=${MIN_CALIBRATION_ATTEMPTS}`,
  );

  if (results.length === 0) {
    console.log('(no item attempts found)');
  } else {
    console.table(
      results.map(({ row, pValue, calibration }) => ({
        item: row.item_id,
        attempts: row.attempts,
        p: pValue.toFixed(3),
        old_b: Number(row.difficulty_b).toFixed(3),
        new_b: calibration.difficultyB.toFixed(3),
        retire: calibration.retire,
        flag: calibration.flag,
      })),
    );
  }

  const retiring = results.filter(({ calibration }) => calibration.retire);
  const flagged = results.filter(({ calibration }) => calibration.flag);
  console.log(`retire=${retiring.length} flag=${flagged.length} adjusted=${results.length}`);

  if (apply) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    try {
      for (const { calibration } of results) {
        await client.query(
          `UPDATE items
           SET difficulty_b = $2,
               updated_at = $3,
               retired_at = CASE WHEN $4 AND retired_at IS NULL THEN $3 ELSE retired_at END
           WHERE id = $1`,
          [calibration.itemId, calibration.difficultyB, now, calibration.retire],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`applied difficulty_b to ${results.length} items, retired ${retiring.length}`);
  } else {
    console.log('dry run: pass --apply to write difficulty_b and retired_at');
  }
} finally {
  await client.end();
}
